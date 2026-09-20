import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { corrigirCustosSql } from './recuperar-custos-historicos.mjs';
import { prepararConciliacao, gerarSql } from './gerar-conciliacao-materiais.mjs';
import { migrationSql as base } from './gerar-cmv-ecommerce.mjs';
import { migrationSql as compras } from './gerar-unificacao-compras.mjs';

// Testa cópia local da captura; não contém credenciais nem acessa o Supabase.
const snapshot=JSON.parse(readFileSync(process.argv[2] ?? 'supabase/local/conciliacao/snapshot-atual.json','utf8'));
const plano=prepararConciliacao(snapshot);
const container=`eksteel-conciliacao-${randomUUID()}`;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000});
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],input);
const lit=v=>`'${String(v).replaceAll("'","''")}'`;
const check=(condition,message)=>`do $$begin if not (${condition}) then raise exception ${lit(message)}; end if; end$$;`;
const emptySchemas={
 pedidos_compra:'id uuid primary key,criado_por uuid,fornecedor_id uuid,data date,status text,valor_total numeric,observacao text,atualizado_por uuid,atualizado_em timestamptz,estoque_integrado boolean default false,estoque_payload jsonb',
 pedido_compra_itens:'id uuid primary key default gen_random_uuid(),pedido_compra_id uuid,descricao text,quantidade numeric,valor_unitario numeric not null,valor_total numeric not null',
 movimentos_estoque:"id uuid primary key default gen_random_uuid(),materia_prima_id uuid,produto_id uuid,quantidade numeric not null,saldo_apos numeric not null check(saldo_apos>=0),tipo text not null,referencia_id uuid,motivo text not null,data date not null,criado_em timestamptz default now(),criado_por uuid not null default auth.uid()"
};
function schema(nome,rows) {
 if (!rows.length) { if (!emptySchemas[nome]) throw Error(`Schema vazio desconhecido ${nome}`); return emptySchemas[nome]; }
 return [...new Set(rows.flatMap(Object.keys))].map(k=>{
  const val=rows.map(r=>r[k]).find(v=>v!==null && v!==undefined);
  let type=typeof val==='number' ? 'numeric' : typeof val==='boolean' ? 'boolean' : typeof val==='object' ? 'jsonb' : 'text';
  if (k==='id' || k.endsWith('_id') || ['criado_por','atualizado_por'].includes(k)) type='uuid';
  if (['compra_payload','cmv_componentes','materia_prima_consumo'].includes(k)) type='jsonb';
  if (k==='data') type='date';
  if (k.endsWith('_em') || k.endsWith('_at')) type='timestamptz';
  return `${k} ${type}${k==='id' ? ' primary key default gen_random_uuid()' : ''}`;
 }).join(',');
}
try {
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 const actor=snapshot.tabelas.vendas[0].criado_por;
 sql(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select ${lit(actor)}::uuid$$;
 create table public.usuarios_empresa(usuario_id uuid,papel text); insert into public.usuarios_empresa values(auth.uid(),'admin');
 ${Object.entries(snapshot.tabelas).map(([nome,rows])=>`create table public.${nome}(${schema(nome,rows)});`).join('\n')}`);
 sql(base); sql(compras);
 sql(`alter table public.vendas disable trigger cmv_venda;
 ${Object.entries(snapshot.tabelas).filter(([,rows])=>rows.length).map(([nome,rows])=>`insert into public.${nome} select * from jsonb_populate_recordset(null::public.${nome},${lit(snapshot.tabelas_exatas?.[nome] ?? JSON.stringify(rows))}::jsonb);`).join('\n')}
 alter table public.vendas enable trigger cmv_venda;`);
 if(snapshot.tabelas_exatas) {
  const arredondado=structuredClone(snapshot); delete arredondado.tabelas_exatas;
  assert.throws(()=>sql(gerarSql(arredondado,plano)),/mudou/,'Captura float64 deve reproduzir o falso alerta de precisão');
 }
 const first=snapshot.tabelas.itens_fabricacao[0];
 sql(`update public.itens_fabricacao set preco_unitario=preco_unitario+1 where id=${lit(first.id)};`);
 assert.throws(()=>sql(gerarSql(snapshot,plano)),/mudou/,'Alteração de origem precisa bloquear importação');
 sql(`update public.itens_fabricacao set preco_unitario=${first.preco_unitario} where id=${lit(first.id)};`);
 const errado=structuredClone(plano); errado.saldos[0].saldo+=1;
 assert.throws(()=>sql(gerarSql(snapshot,errado)),/Saldo final divergente/,'Erro ao final deve reverter tudo');
 sql(check('not exists(select 1 from public.movimentos_estoque)','Rollback deixou movimentos'));
 sql(check("not exists(select 1 from information_schema.columns where table_schema='public' and table_name='materias_primas' and column_name='custo_medio')",'Rollback deixou schema de custo'));
 sql(`create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
 sql(gerarSql(snapshot,plano));
 sql(check(`(select count(*) from public.pedidos_compra)=${plano.pedidos.length}`,'Número de pedidos importados divergente'));
 sql(check(`(select count(*) from public.pedido_compra_itens)=${plano.pedidos.reduce((s,p)=>s+p.itens.length,0)}`,'Número de itens importados divergente'));
 for (const pedido of plano.pedidos) {
  sql(check(`(select status='recebido' and estoque_integrado and fornecedor_id=${lit(pedido.fornecedor)}::uuid and abs(valor_total-${pedido.valor_total})<0.00000001 from public.pedidos_compra where id=${lit(pedido.id)})`,'Compra não preservou fornecedor/valor/status'));
  for (const item of pedido.itens) {
   sql(check(`(select materia_prima_id=${lit(item.material)}::uuid and quantidade=${item.quantidade} and abs(valor_unitario-${item.custo})<0.00000001 from public.pedido_compra_itens where id=${lit(item.id)})`,'Item não preservou quantidade/custo/vínculo'));
   sql(check(`exists(select 1 from public.movimentos_estoque where referencia_id=${lit(pedido.id)} and materia_prima_id=${lit(item.material)} and tipo='compra')`,'Entrada não vinculada ao novo documento'));
  }
 }
 for(const m of plano.saldos) {
  sql(check(`abs(public.saldo_material(${lit(m.id)})-${m.saldo})<0.00000001`,`Saldo errado ${m.codigo}`));
  sql(check(`(select ${m.custo===null ? 'custo_medio is null' : `abs(custo_medio-${m.custo})<0.00000001`} from public.materias_primas where id=${lit(m.id)})`,`Custo errado ${m.codigo}`));
 }
 for(const v of snapshot.tabelas.vendas) {
  sql(check(`(select cmv_total is not distinct from ${v.cmv_total ?? 'null'} and cmv_estimado is not distinct from ${v.cmv_estimado} from public.vendas where id=${lit(v.id)})`,'CMV original alterado'));
 }
 // Simula banco já conciliado, sem usuário autenticado no SQL Editor.
 const recuperado=sql("select materia_prima_id from public.movimentos_estoque where tipo='ajuste_custo' limit 1").trim();
 assert.ok(recuperado,'Fixture deve recuperar uma média histórica');
 sql(`delete from public.movimentos_estoque where tipo='ajuste_custo' and materia_prima_id=${lit(recuperado)}; update public.materias_primas set custo_medio=null where id=${lit(recuperado)};`);
 sql(corrigirCustosSql);
 sql(check(`exists(select 1 from public.movimentos_estoque e join public.materias_primas m on m.id=e.materia_prima_id where e.tipo='ajuste_custo' and m.id=${lit(recuperado)} and e.criado_por=m.criado_por and m.custo_medio is not null)`,'Recuperação sem auth.uid não preservou autor do cadastro'));
 sql(`create or replace function auth.uid() returns uuid language sql as $$select ${lit(actor)}::uuid$$;`);
 const captura=()=>sql("select jsonb_agg(to_jsonb(t) order by t.id) from public.movimentos_estoque t;");
 const antes=captura(); sql(gerarSql(snapshot,plano)); assert.equal(captura(),antes,'Reexecução duplicou/alterou movimentos');
 sql(check(`(select count(*) from public.pedidos_compra)=${plano.pedidos.length}`,'Reexecução duplicou compras'));
 const venda=plano.vendas.find(v=>v.materiais.some(m=>plano.saldos.find(s=>s.id===m.material).custo===null)) ?? plano.vendas[0];
 sql(`delete from public.vendas where id=${lit(venda.id)};`);
 for(const m of venda.materiais) sql(check(`abs(public.saldo_material(${lit(m.material)})-${plano.saldos.find(s=>s.id===m.material).saldo+m.quantidade})<0.00000001`,'Estorno não devolveu o consumo registrado'));
 sql(check(`not exists(select 1 from public.produtos where id in (${plano.produtos.map(lit).join(',')}) and estoque_atual<>0)`,'Estorno duplicou saldo físico'));
 const aposEstorno=captura(); sql(gerarSql(snapshot,plano)); assert.equal(captura(),aposEstorno,'Reexecução recriou venda excluída');
 // Uma nova venda dos carrinhos deve ser possível mesmo com embalagem inativa.
 const apoioInativo=snapshot.tabelas.materias_primas.find(m=>!m.ativo);
 assert.ok(apoioInativo,'Fixture deve conter apoio inativo');
 sql(check(`(select influencia_saldo from public.materias_primas where id=${lit(apoioInativo.id)})`,'Importação alterou a regra cadastrada pelo nome'));
 sql(`update public.materias_primas set influencia_saldo=false where id=${lit(apoioInativo.id)};`);
 const candidato=snapshot.tabelas.produtos.find(p=>{
  const comps=snapshot.tabelas.componentes_produto.filter(c=>c.produto_id===p.id);
  return comps.some(c=>c.materia_prima_id===apoioInativo.id) && comps.filter(c=>c.materia_prima_id!==apoioInativo.id && !plano.materiaisApoio.includes(c.materia_prima_id)).every(c=>plano.saldos.find(s=>s.id===c.materia_prima_id).saldo>=c.quantidade);
 });
 assert.ok(candidato,'Fixture deve conter produto com disponibilidade de componentes essenciais');
 const novaVenda=randomUUID();
 sql(`insert into public.vendas(id,produto_id,quantidade,data) values(${lit(novaVenda)},${lit(candidato.id)},1,current_date);`);
 sql(check(`(select (i->>'faltante')::numeric>0 from public.vendas v,jsonb_array_elements(v.materia_prima_consumo) i where v.id=${lit(novaVenda)} and i->>'materia_prima_id'=${lit(apoioInativo.id)})`,'Apoio inativo não gerou alerta na venda'));
 sql(`delete from public.vendas where id=${lit(novaVenda)};`);
 const duplicado=structuredClone(snapshot); duplicado.tabelas.materias_primas.push({...duplicado.tabelas.materias_primas[0],id:randomUUID()});
 assert.throws(()=>prepararConciliacao(duplicado),/única/);
 const negativo=structuredClone(snapshot); negativo.tabelas.vendas[0].cmv_componentes[0].quantidade=100000;
 assert.throws(()=>prepararConciliacao(negativo),/Saldo negativo/);
 const compraCancelavel=plano.pedidos.find(p=>p.itens.every(i=>plano.saldos.find(s=>s.id===i.material).saldo>=i.quantidade));
 assert.ok(compraCancelavel,'Fixture deve conter uma compra integralmente estornável');
 const antesCancelar=new Map(compraCancelavel.itens.map(i=>[i.material,Number(sql(`select public.saldo_material(${lit(i.material)});`).trim())]));
 sql(`update public.pedidos_compra set status='cancelado' where id=${lit(compraCancelavel.id)};`);
 for(const i of compraCancelavel.itens) sql(check(`public.saldo_material(${lit(i.material)})=${antesCancelar.get(i.material)-i.quantidade}`,'Cancelamento não estornou entrada importada'));
 console.log('OK: pedidos recebidos por fornecedor, 48 itens vinculados, origem alterada, rollback integral, 27 saldos/custos, CMV preservado, reexecução, nova venda com apoio faltante, estornos de venda e compra, nomes ambíguos e saldo negativo.');
} catch(error) {
 console.error(error.stderr?.toString() || error.message); process.exitCode=1;
} finally { try { docker(['rm','-f',container]); } catch {} }
