import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { migrationSql } from './gerar-estoque-materias-primas.mjs';
import { recuperarCustosSql } from './recuperar-custos-historicos.mjs';

const normalizar = v => String(v ?? '').normalize('NFC').trim().toLocaleLowerCase('pt-BR');
const numero = v => {
 if (v === null || v === undefined || !Number.isFinite(Number(v))) throw Error('Número ausente/inválido');
 return Number(v);
};
const uuid = chave => {
 const h = createHash('sha256').update(chave).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
};
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const soma = (map, id, qtd) => map.set(id, (map.get(id) ?? 0) + qtd);
const igual = (a,b) => a.size === b.size && [...a].every(([id,q]) => Math.abs(q-(b.get(id) ?? NaN)) < 1e-9);

export function prepararConciliacao(snapshot) {
 const t = snapshot.tabelas;
 if (t.movimentos_estoque.length) throw Error('Já existem movimentos: exige nova conciliação incremental, não conversão inicial');
 if (t.pedidos_compra.length || t.pedido_compra_itens.length) throw Error('Compras de matérias-primas existentes exigem conciliação específica');
 const porNome = new Map();
 for (const m of t.materias_primas) {
  const key = normalizar(m.nome); porNome.set(key, [...(porNome.get(key) ?? []), m]);
 }
 const composicoes = new Map();
 for (const c of t.componentes_produto) {
  if (!c.materia_prima_id || !t.materias_primas.some(m => m.id === c.materia_prima_id) || numero(c.quantidade) <= 0) throw Error('Composição inválida');
  const map = composicoes.get(c.produto_id) ?? new Map();
  soma(map, c.materia_prima_id, numero(c.quantidade)); composicoes.set(c.produto_id, map);
 }
 const entradas = [], vendas = [], produtos = new Set(), pendencias = [], pedidos = [];
 if (!Array.isArray(t.fornecedores)) throw Error('Capture também os fornecedores para converter os documentos de compra');
 for (const p of [...t.pedidos_fabricacao].sort((a,b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))) {
  if (numero(p.qtd_fabricada) <= 0) throw Error('Compra histórica sem quantidade positiva');
  const bom = composicoes.get(p.produto_id);
  if (!bom?.size) throw Error(`Produto ${p.produto_id} sem composição`);
  produtos.add(p.produto_id);
  const itens = t.itens_fabricacao.filter(i => i.pedido_id === p.id);
  const agrupados = new Map(), historica = new Map(), porFornecedor = new Map();
  let valorPedido = 0;
  for (const i of itens) {
   const matches = porNome.get(normalizar(i.nome_peca));
   if (matches?.length !== 1) throw Error(`Item ${i.id} sem matéria-prima única`);
   const m = matches[0];
   const fornecedores = t.fornecedores.filter(f => normalizar(f.nome) === normalizar(i.fornecedor_nome));
   if (fornecedores.length !== 1) throw Error(`Item ${i.id} sem fornecedor único`);
   const fornecedor = fornecedores[0];
   const qtd = numero(i.qtd_total), custo = numero(i.preco_unitario);
   if (qtd <= 0 || custo < 0 || Math.abs(qtd-numero(i.qtd_pc)*numero(p.qtd_fabricada)) > 1e-8 || Math.abs(qtd*custo-numero(i.preco_total)) > .010001) throw Error(`Item ${i.id} inconsistente`);
   soma(historica,m.id,numero(i.qtd_pc));
   const atual = agrupados.get(m.id) ?? { quantidade: 0, valor: 0 };
   atual.quantidade += qtd; atual.valor += qtd*custo; agrupados.set(m.id, atual); valorPedido += qtd*custo;
   const documento = porFornecedor.get(fornecedor.id) ?? {
    id:uuid(`conciliacao-v1:pedido:${p.id}:${fornecedor.id}`), origem:p.id, fornecedor:fornecedor.id,
    data:p.data, criado_por:p.criado_por, valor_total:0, itens:[]
   };
   documento.itens.push({ id:uuid(`conciliacao-v1:item:${i.id}`), origem:i.id, material:m.id, descricao:m.nome, quantidade:qtd, custo, valor_total:qtd*custo });
   documento.valor_total += qtd*custo; porFornecedor.set(fornecedor.id,documento);
  }
  if (itens.length && (!igual(historica,bom) || Math.abs(valorPedido-numero(p.valor_total)) > .010001)) throw Error(`Composição/total divergente no pedido ${p.id}`);
  if (!itens.length) {
   for (const [id,q] of bom) agrupados.set(id, { quantidade: q*numero(p.qtd_fabricada), valor: null });
   pendencias.push({ pedido_id:p.id, produto_id:p.produto_id, valor_total:p.valor_total, motivo:'Quantidade inferida da composição atual; custo não distribuído' });
  }
  if (itens.length) {
   for (const documento of porFornecedor.values()) {
    pedidos.push(documento);
    const materiais = new Map();
    for (const item of documento.itens) {
     const atual = materiais.get(item.material) ?? { quantidade:0,valor:0 };
     atual.quantidade += item.quantidade; atual.valor += item.valor_total; materiais.set(item.material,atual);
    }
    for (const [material,item] of materiais) entradas.push({ id:uuid(`conciliacao-v1:compra:${documento.id}:${material}`), referencia:documento.id, origem:p.id, material, quantidade:item.quantidade, custo:item.valor/item.quantidade, data:p.data, criado_por:p.criado_por, inferida:false });
   }
  } else {
   for (const [material,item] of agrupados) entradas.push({ id:uuid(`conciliacao-v1:compra:${p.id}:${material}`), referencia:p.id, origem:p.id, material, quantidade:item.quantidade, custo:null, data:p.data, criado_por:p.criado_por, inferida:true });
  }
 }
 for (const r of t.reposicoes_produtos) {
  const pedido = t.pedidos_fabricacao.find(p => p.id === r.id);
  if (!pedido || pedido.produto_id !== r.produto_id || Math.abs(numero(pedido.qtd_fabricada)-numero(r.quantidade)) > 1e-9 || Math.abs(numero(pedido.valor_total)-numero(r.valor_total)) > .01) throw Error('Reposição sem documento correspondente: não é seguro ignorar nem duplicar');
 }
 for (const v of [...t.vendas].sort((a,b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))) {
  if (v.materia_prima_consumo !== null && v.materia_prima_consumo !== undefined) throw Error('Venda já conciliada ou integrada');
  if (!Array.isArray(v.cmv_componentes) || !v.cmv_componentes.length) throw Error('Venda histórica sem composição congelada');
  const materiais = new Map();
  for (const c of v.cmv_componentes) {
   if (c.estoque_origem === 'materia_prima') throw Error('Venda já utiliza matérias-primas');
   const bom = composicoes.get(c.produto_id);
   if (!bom?.size || numero(c.quantidade) <= 0) throw Error('Composição da venda indisponível');
   produtos.add(c.produto_id);
   for (const [id,qtd] of bom) soma(materiais,id,qtd*numero(c.quantidade));
  }
  vendas.push({ id:v.id, data:v.data, criado_por:v.criado_por, materiais:[...materiais].map(([material,quantidade]) => ({ material,quantidade,id:uuid(`conciliacao-v1:venda:${v.id}:${material}`) })) });
 }
 const saldos = t.materias_primas.map(m => {
  const compras = entradas.filter(e => e.material === m.id);
  const conhecidas = compras.filter(e=>e.custo !== null);
  const recebido = compras.reduce((s,e) => s+e.quantidade,0);
  const consumo = vendas.flatMap(v => v.materiais).filter(e => e.material === m.id).reduce((s,e) => s+e.quantidade,0);
  if (recebido-consumo < -1e-8) throw Error(`Saldo negativo em ${m.codigo}: ${recebido-consumo}. Não será criado saldo inicial fictício`);
  return { id:m.id,codigo:m.codigo,nome:m.nome,entradas:recebido,saidas:consumo,saldo:recebido-consumo,custo:!conhecidas.length ? null : conhecidas.reduce((s,e)=>s+e.quantidade*e.custo,0)/conhecidas.reduce((s,e)=>s+e.quantidade,0) };
 });
 // Respeita a configuração do cadastro, independentemente do nome do material.
 const materiaisApoio=t.materias_primas.filter(m => m.influencia_saldo === false && [...composicoes.values()].some(bom=>bom.has(m.id))).map(m=>m.id);
 return { entradas,vendas,pedidos,produtos:[...produtos],saldos,pendencias,materiaisApoio };
}

export function gerarSql(snapshot, plano) {
 const lote = 'conversao-inicial-materias-primas-v1';
 const hash = createHash('sha256').update(JSON.stringify(snapshot.tabelas_exatas ?? snapshot.tabelas)).digest('hex');
 const estrutura = migrationSql.trim().replace(/^begin;/i,'').replace(/commit;\s*$/i,'');
 const payload = literal(JSON.stringify({snapshot,plano}));
 return `-- Conversão administrativa solicitada: compras históricas menos vendas.
-- Executar no SQL Editor com lançamentos pausados. Tudo é aplicado em uma transação.
-- Cria pedidos de matérias-primas por compra original/fornecedor, sem novas despesas.
-- CMVs antigos são preservados. Pedidos sem itens ficam pendentes de custo/documentação.
-- Compras sem itens: quantidades pela composição cadastrada, custos desconhecidos.
-- Todas as entradas são importadas antes das saídas; datas de origem são preservadas.
-- Custo de abertura é referência ponderada estimada, não reconstrução cronológica.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
set local standard_conforming_strings=on;
select pg_advisory_xact_lock(hashtextextended(${literal(lote)},0));
create table if not exists public.conciliacoes_materiais_legacy (
 id text primary key, origem_hash text not null, dados jsonb not null,
 executado_em timestamptz not null default now(), executado_por text not null default current_user
);
alter table public.conciliacoes_materiais_legacy enable row level security;
revoke all on public.conciliacoes_materiais_legacy from public,anon,authenticated;
do $conciliacao$
declare
 dados jsonb := ${payload}::jsonb;
 tabela text; linhas jsonb; registro jsonb; esperado jsonb; e jsonb; v jsonb; item jsonb; pedido jsonb;
 quantidade_atual bigint; divergencias bigint; saldo numeric; custo numeric; consumo jsonb;
 material uuid; hash_anterior text;
begin
 -- JSON bruto da API preserva numeric do PostgreSQL, inclusive dentro de snapshots.
 -- JSON.parse/JSON.stringify em JavaScript arredondam esses valores para float64.
 if dados->'snapshot' ? 'tabelas_exatas' then
  dados:=jsonb_set(dados,'{snapshot,tabelas}',
   (select jsonb_object_agg(key,value::jsonb) from jsonb_each_text(dados->'snapshot'->'tabelas_exatas')));
 end if;
 select origem_hash into hash_anterior from public.conciliacoes_materiais_legacy where id=${literal(lote)};
 if found then
  if hash_anterior<>${literal(hash)} then raise exception 'Outro snapshot já foi conciliado. Não reaplique com dados diferentes'; end if;
  raise notice 'Conciliação já aplicada; nenhum movimento repetido'; return;
 end if;
 lock table public.produtos,public.vendas,public.materias_primas,public.componentes_produto,
 public.pedidos_fabricacao,public.itens_fabricacao,public.reposicoes_produtos,public.pedidos_compra,
 public.pedido_compra_itens,public.movimentos_estoque,public.kits,public.kit_itens,public.fornecedores in share row exclusive mode;
 -- Rejeita qualquer alteração posterior à captura, inclusive exclusão/inclusão de linhas.
 for tabela,linhas in select key,value from jsonb_each(dados->'snapshot'->'tabelas') loop
  execute format('select count(*) from public.%I',tabela) into quantidade_atual;
  if quantidade_atual<>jsonb_array_length(linhas) then raise exception 'Tabela % mudou desde a captura; gere nova conciliação',tabela; end if;
  for esperado in select value from jsonb_array_elements(linhas) loop
   execute format('select to_jsonb(t) from public.%I t where id=$1',tabela) into registro using (esperado->>'id')::uuid;
   if registro is null or not registro @> esperado then raise exception 'Registro % da tabela % mudou; gere nova conciliação',esperado->>'id',tabela; end if;
  end loop;
 end loop;
 -- Instala os campos/funções de custo antes de importar. Não exige segunda execução manual.
 execute ${literal(estrutura)};
 -- A influência no saldo é definida pelo cadastro e preservada nesta importação.
 -- Documentos recebidos serão preenchidos pela mesma importação de movimentos abaixo.
 -- Desativa somente o gatilho de integração nesta transação administrativa sob lock.
 alter table public.pedidos_compra disable trigger integrar_compra_materiais;
 for pedido in select value from jsonb_array_elements(dados->'plano'->'pedidos') loop
  insert into public.pedidos_compra(id,criado_por,fornecedor_id,data,status,valor_total,observacao,estoque_integrado,estoque_payload)
  values((pedido->>'id')::uuid,(pedido->>'criado_por')::uuid,(pedido->>'fornecedor')::uuid,(pedido->>'data')::date,'pendente',(pedido->>'valor_total')::numeric,
   'Importação histórica de matérias-primas. Origem: compra de produto ' || (pedido->>'origem') || '. Sem nova despesa ou rateio no balancete.',false,
   jsonb_build_object('origem',${literal(lote)},'pedido_fabricacao_id',pedido->>'origem','itens_originais',pedido->'itens'));
  for item in select value from jsonb_array_elements(pedido->'itens') loop
   insert into public.pedido_compra_itens(id,pedido_compra_id,materia_prima_id,descricao,quantidade,valor_unitario,valor_total)
   values((item->>'id')::uuid,(pedido->>'id')::uuid,(item->>'material')::uuid,item->>'descricao',(item->>'quantidade')::numeric,(item->>'custo')::numeric,(item->>'valor_total')::numeric);
  end loop;
  update public.pedidos_compra set status='recebido',estoque_integrado=true where id=(pedido->>'id')::uuid;
 end loop;
 alter table public.pedidos_compra enable trigger integrar_compra_materiais;
 for e in select value from jsonb_array_elements(dados->'plano'->'entradas') loop
  material:=(e->>'material')::uuid;
  saldo:=public.saldo_material(material);
  if e->>'custo' is null then
   -- Não reaproveita um preço antigo para uma compra sem detalhamento de custo.
   update public.materias_primas set custo_medio=null,custo_medio_estimado=true where id=material;
  end if;
  insert into public.movimentos_estoque(id,materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,criado_por,custo_informado,custo_origem_estimado)
  values((e->>'id')::uuid,material,(e->>'quantidade')::numeric,saldo+(e->>'quantidade')::numeric,'compra',(e->>'referencia')::uuid,(e->>'data')::date,
   'Conciliação inicial: compra histórica. Autor original preservado. ' || case when (e->>'inferida')::boolean then 'Quantidade pela composição cadastrada; custo pendente.' else 'Quantidade e preço dos itens originais; média de abertura estimada.' end,
   (e->>'criado_por')::uuid,(e->>'custo')::numeric,true);
 end loop;
 execute ${literal(recuperarCustosSql)};
 alter table public.vendas disable trigger cmv_venda;
 for v in select value from jsonb_array_elements(dados->'plano'->'vendas') loop
  consumo:='[]'::jsonb;
  for item in select value from jsonb_array_elements(v->'materiais') order by value->>'material' loop
   material:=(item->>'material')::uuid;
   saldo:=public.saldo_material(material);
   select custo_medio into custo from public.materias_primas where id=material;
   insert into public.movimentos_estoque(id,materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,criado_por)
   values((item->>'id')::uuid,material,-(item->>'quantidade')::numeric,saldo-(item->>'quantidade')::numeric,'venda',(v->>'id')::uuid,(v->>'data')::date,
    'Conciliação inicial: consumo da venda histórica pela composição conferida. Autor original preservado; CMV original mantido.',(v->>'criado_por')::uuid);
   consumo:=consumo || jsonb_build_array(jsonb_build_object('materia_prima_id',material,'nome',(select nome from public.materias_primas where id=material),
    'quantidade',(item->>'quantidade')::numeric,'necessario',(item->>'quantidade')::numeric,'faltante',0,'custo_unitario',custo,'custo_estimado',true,'origem',${literal(lote)}));
  end loop;
  update public.vendas set materia_prima_consumo=consumo,
   cmv_componentes=(select jsonb_agg(c.value || jsonb_build_object('estoque_origem','materia_prima','estoque_conciliacao',${literal(lote)}) order by c.n)
     from jsonb_array_elements(cmv_componentes) with ordinality c(value,n))
  where id=(v->>'id')::uuid;
 end loop;
 alter table public.vendas enable trigger cmv_venda;
 -- Elimina a duplicação do antigo saldo físico nos produtos convertidos, com histórico.
 for item in select value from jsonb_array_elements(dados->'plano'->'produtos') loop
  select to_jsonb(p) into registro from public.produtos p where id=(item#>>'{}')::uuid;
  saldo:=(registro->>'estoque_atual')::numeric;
  if saldo<>0 then
   insert into public.movimentos_estoque(produto_id,quantidade,saldo_apos,tipo,data,motivo,criado_por)
   values((registro->>'id')::uuid,-saldo,0,'ajuste',(now() at time zone 'America/Sao_Paulo')::date,
    'Conversão para matérias-primas: saldo físico anterior arquivado; saldo disponível apurado por compras menos vendas. Autor do cadastro preservado.',(registro->>'criado_por')::uuid);
   update public.produtos set estoque_atual=0 where id=(registro->>'id')::uuid;
  end if;
 end loop;
 for e in select value from jsonb_array_elements(dados->'plano'->'saldos') loop
  if abs(public.saldo_material((e->>'id')::uuid)-(e->>'saldo')::numeric)>0.00000001 then raise exception 'Saldo final divergente em %',e->>'codigo'; end if;
 end loop;
 -- Garante que o valor financeiro de cada venda permaneceu intacto.
 for esperado in select value from jsonb_array_elements(dados->'snapshot'->'tabelas'->'vendas') loop
  select to_jsonb(t) into registro from public.vendas t where id=(esperado->>'id')::uuid;
  if (registro-'cmv_componentes'-'materia_prima_consumo') is distinct from (esperado-'cmv_componentes'-'materia_prima_consumo') then raise exception 'Uma venda teve campos financeiros ou cadastrais alterados'; end if;
 end loop;
 insert into public.conciliacoes_materiais_legacy(id,origem_hash,dados) values(${literal(lote)},${literal(hash)},dados);
end;
$conciliacao$;
notify pgrst,'reload schema';
commit;
select codigo,nome,saldo,custo_medio,custo_medio_estimado from public.saldos_materias_primas order by codigo;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const origem=resolve(process.argv[2] ?? 'supabase/local/conciliacao/snapshot-atual.json');
 const snapshot=JSON.parse(readFileSync(origem,'utf8'));
 const plano=prepararConciliacao(snapshot);
 const pasta=dirname(origem);
 writeFileSync(resolve(pasta,'plano.json'),JSON.stringify(plano,null,2),{mode:0o600});
 writeFileSync(resolve(pasta,'aplicar-conciliacao.sql'),gerarSql(snapshot,plano),{mode:0o600});
 console.log(JSON.stringify({pedidosCompra:plano.pedidos.length,itensCompra:plano.pedidos.reduce((s,p)=>s+p.itens.length,0),entradas:plano.entradas.length,vendas:plano.vendas.length,saidas:plano.vendas.reduce((s,v)=>s+v.materiais.length,0),custosPendentes:plano.pendencias.length,arquivo:resolve(pasta,'aplicar-conciliacao.sql')},null,2));
}
