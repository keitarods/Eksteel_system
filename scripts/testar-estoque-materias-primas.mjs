import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { migrationSql as base } from './gerar-cmv-ecommerce.mjs';
import { migrationSql as compras } from './gerar-unificacao-compras.mjs';
import { migrationSql } from './gerar-estoque-materias-primas.mjs';
const container=`eksteel-materiais-${randomUUID()}`;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000});
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input);
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const assertSql=(condition,message)=>`do $$begin if not (${condition}) then raise exception '${message}'; end if; end$$;`;
const rejects=(statement,message)=>`do $$begin begin ${statement}; raise exception '${message}' using errcode='XX000'; exception when raise_exception or check_violation or insufficient_privilege then null; end; end$$;`;
try {
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 sql(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${id(900)}'::uuid$$;
 create table public.usuarios_empresa(usuario_id uuid,papel text); insert into public.usuarios_empresa values(auth.uid(),'socio');
 create table public.produtos(id uuid primary key,nome text,codigo text,ativo boolean default true,custo numeric,estoque_atual numeric default 0);
 create table public.materias_primas(id uuid primary key,nome text,codigo text,unidade text,ativo boolean default true);
 create table public.componentes_produto(id uuid primary key default gen_random_uuid(),produto_id uuid references public.produtos,materia_prima_id uuid references public.materias_primas,nome_peca text,quantidade numeric);
 create table public.kit_itens(id uuid default gen_random_uuid(),kit_id uuid,produto_id uuid,quantidade numeric);
 create table public.vendas(id uuid primary key default gen_random_uuid(),produto_id uuid,kit_id uuid,quantidade numeric,data date default ((now() at time zone 'America/Sao_Paulo')::date));
 create table public.pedidos_fabricacao(id uuid primary key default gen_random_uuid(),produto_id uuid,produto_nome text,qtd_fabricada numeric,data date,valor_total numeric,observacao text,criado_por uuid);
 create table public.itens_fabricacao(id uuid default gen_random_uuid(),pedido_id uuid,nome_peca text,qtd_pc numeric,qtd_total numeric,fornecedor_nome text,preco_unitario numeric,preco_total numeric);
 create table public.pedidos_compra(id uuid primary key default gen_random_uuid(),criado_por uuid,fornecedor_id uuid,data date,status text,valor_total numeric,observacao text,atualizado_por uuid,atualizado_em timestamptz);
 create table public.pedido_compra_itens(id uuid primary key default gen_random_uuid(),pedido_compra_id uuid references public.pedidos_compra on delete cascade,materia_prima_id uuid references public.materias_primas,descricao text,quantidade numeric,valor_unitario numeric,valor_total numeric);
 grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;
 grant select,insert,update,delete on public.vendas,public.produtos,public.materias_primas,public.componentes_produto,public.pedidos_compra,public.pedido_compra_itens to authenticated;
 insert into public.produtos(id,nome,custo,estoque_atual) values('${id(1)}','P1',10,7),('${id(2)}','P2',20,0),('${id(3)}','Pronto',30,5);
 insert into public.materias_primas(id,nome,unidade) values('${id(11)}','Chapa','un'),('${id(12)}','Embalagem','un');
 insert into public.componentes_produto(produto_id,materia_prima_id,nome_peca,quantidade) values('${id(1)}','${id(11)}','Chapa',2),('${id(2)}','${id(11)}','Chapa',3),('${id(1)}','${id(12)}','Embalagem',1);
 insert into public.kit_itens(kit_id,produto_id,quantidade) values('${id(20)}','${id(1)}',1),('${id(20)}','${id(2)}',1);
 insert into public.pedidos_compra(id,status,data,valor_total) values('${id(40)}','recebido',current_date-1,999);
 insert into public.pedido_compra_itens(pedido_compra_id,materia_prima_id,quantidade) values('${id(40)}','${id(11)}',99);
 `);
 sql(base); sql(compras); sql(migrationSql); sql(migrationSql);
 sql(assertSql(`(select count(*) from public.movimentos_estoque)=0`,'Migração duplicou estoque histórico'));
 sql(`update public.materias_primas set influencia_saldo=false where id='${id(12)}'; set role authenticated;
 select public.movimentar_estoque('${id(30)}','${id(11)}',null,'ajuste',10,current_date,'Contagem inicial',0);
 select public.movimentar_estoque('${id(30)}','${id(11)}',null,'ajuste',10,current_date,'Contagem inicial',0);
 ${rejects(`perform public.movimentar_estoque('${id(30)}','${id(11)}',null,'ajuste',20,current_date,'Contagem inicial',0)`,'Reenvio divergente aceito')}
 ${rejects(`perform public.movimentar_estoque('${id(31)}','${id(11)}',null,'ajuste',20,current_date,'Contagem desatualizada',0)`,'Ajuste obsoleto aceito')}
 insert into public.vendas(id,kit_id,quantidade) values('${id(50)}','${id(20)}',2);
 reset role;
 ${assertSql(`public.saldo_material('${id(11)}')=0`,'Kit não agregou chapa')}
 ${assertSql(`(select estoque_atual from public.produtos where id='${id(1)}')=7`,'Venda consumiu produto e matéria-prima duas vezes')}
 ${assertSql(`(select materia_prima_consumo->1->>'faltante' from public.vendas where id='${id(50)}')='2'`,'Embalagem sem saldo não gerou pendência')}
 ${assertSql(`(select cmv_total from public.vendas where id='${id(50)}') is null`,'CMV sem custo de matéria-prima usou custo cadastral')}
 set role authenticated;
 ${rejects(`insert into public.vendas(produto_id,quantidade) values('${id(1)}',1)`,'Venda sem chapa aceita')}
 update public.componentes_produto set quantidade=20 where produto_id='${id(1)}';
 delete from public.vendas where id='${id(50)}';
 reset role;
 ${assertSql(`public.saldo_material('${id(11)}')=10 and public.saldo_material('${id(12)}')=0`,'Estorno não usou snapshot')}
 update public.componentes_produto set quantidade=case when materia_prima_id='${id(11)}' then 2 else 1 end where produto_id='${id(1)}';
 set role authenticated;
 select public.movimentar_estoque('${id(36)}','${id(12)}',null,'entrada',1,current_date,'Embalagem parcial',null);
 insert into public.vendas(id,produto_id,quantidade) values('${id(52)}','${id(1)}',2);
 ${assertSql(`(select materia_prima_consumo->1->>'faltante' from public.vendas where id='${id(52)}')='1'`,'Apoio parcial sem pendência')}
 delete from public.vendas where id='${id(52)}';
 reset role;
 ${assertSql(`public.saldo_material('${id(12)}')=1`,'Estorno devolveu mais apoio que consumiu')}
 set role authenticated;
 insert into public.vendas(id,produto_id,quantidade) values('${id(51)}','${id(3)}',2);
 ${assertSql(`(select estoque_atual from public.produtos where id='${id(3)}')=3`,'Venda física não baixou estoque')}
 delete from public.vendas where id='${id(51)}';
 ${assertSql(`(select estoque_atual from public.produtos where id='${id(3)}')=5`,'Estorno físico não devolveu estoque')}
 select public.movimentar_estoque('${id(32)}',null,'${id(3)}','ajuste',8,current_date,'Inventário físico',5);
 ${rejects(`perform public.movimentar_estoque('${id(33)}',null,'${id(1)}','entrada',1,current_date,'Duplicaria estoque',7)`,'Produto composto aceitou entrada física')}
 ${rejects(`perform public.registrar_reposicao_produto('${id(34)}','${id(1)}',1,10,'Duplicaria estoque')`,'Reposição composta aceita')}
 ${rejects(`perform public.salvar_compra_materiais('${id(80)}','${id(99)}',current_date,'pendente',10,'Sem itens','[]')`,'Compra sem matéria-prima aceita')}
 ${rejects(`perform public.salvar_compra_materiais('${id(81)}','${id(99)}',current_date,'recebido',10,'Avulsa','[{"descricao":"Avulso","quantidade":1,"valor_unitario":10}]')`,'Compra avulsa aceita')}
 ${rejects(`perform public.registrar_compra_produto('${id(82)}','${id(3)}',1,10,'[]','Modelo antigo')`,'Compra de produto ainda disponível')}
 ${rejects(`perform public.registrar_reposicao_produto('${id(83)}','${id(3)}',1,10,'Modelo antigo')`,'Reposição de produto ainda disponível')}
 ${assertSql(`not exists(select 1 from public.pedidos_compra where id in ('${id(80)}','${id(81)}'))`,'Compra inválida deixou documento')}
 insert into public.pedidos_compra(id,criado_por,fornecedor_id,data,status,valor_total) values('${id(84)}',auth.uid(),'${id(99)}',current_date,'pendente',10);
 insert into public.pedido_compra_itens(pedido_compra_id,descricao,quantidade,valor_unitario,valor_total) values('${id(84)}','Linha sem vínculo',1,10,10);
 ${rejects(`update public.pedidos_compra set status='recebido' where id='${id(84)}'`,'Recebimento direto de avulso aceito')}
 select public.salvar_compra_materiais('${id(41)}','${id(99)}',current_date,'recebido',30,'Compra teste','[{"materia_prima_id":"${id(11)}","descricao":"Chapa","quantidade":3,"valor_unitario":10}]');
 reset role;
 ${assertSql(`public.saldo_material('${id(11)}')=13`,'Recebimento não somou')}
 set role authenticated;
 select public.salvar_compra_materiais('${id(41)}','${id(99)}',current_date,'recebido',30,'Compra teste','[{"materia_prima_id":"${id(11)}","descricao":"Chapa","quantidade":3,"valor_unitario":10}]');
 update public.pedidos_compra set status='recebido' where id='${id(41)}';
 ${rejects(`update public.pedido_compra_itens set quantidade=99 where pedido_compra_id='${id(41)}'`,'Item integrado editável')}
 ${rejects(`delete from public.pedidos_compra where id='${id(41)}'`,'Compra integrada excluível')}
 update public.pedidos_compra set status='cancelado' where id='${id(41)}';
 reset role;
 ${assertSql(`public.saldo_material('${id(11)}')=10`,'Cancelamento não estornou')}
 set role authenticated;
 ${rejects(`update public.pedidos_compra set status='recebido' where id='${id(41)}'`,'Compra cancelada recebeu duas vezes')}
 select public.salvar_compra_materiais('${id(43)}','${id(99)}',current_date,'pendente',20,'Pendente','[{"materia_prima_id":"${id(11)}","descricao":"Chapa","quantidade":2,"valor_unitario":10}]');
 reset role;
 ${assertSql(`public.saldo_material('${id(11)}')=10`,'Pedido pendente entrou no estoque')}
 set role authenticated;
 update public.pedidos_compra set status='recebido' where id='${id(43)}';
 select public.movimentar_estoque('${id(37)}','${id(11)}',null,'saida',11,current_date,'Consumo externo',null);
 ${rejects(`update public.pedidos_compra set status='cancelado' where id='${id(43)}'`,'Cancelamento com saldo insuficiente aceito')}
 select public.movimentar_estoque('${id(38)}','${id(11)}',null,'entrada',11,current_date,'Devolução externa',null);
 update public.pedidos_compra set status='cancelado' where id='${id(43)}';
 ${rejects(`perform public.salvar_compra_materiais('${id(42)}','${id(99)}',current_date,'recebido',999,'Inválida','[{"materia_prima_id":"${id(11)}","descricao":"Chapa","quantidade":3,"valor_unitario":10}]')`,'Total divergente aceito')}
 ${assertSql(`not exists(select 1 from public.pedidos_compra where id='${id(42)}')`,'Compra inválida gravou parcialmente')}
 ${rejects(`insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,data,motivo) values('${id(11)}',999,999,'entrada',current_date,'Bypass')`,'Movimento direto permitido')}
 insert into public.atividades_kanban(id,titulo) values('${id(70)}','Cortar chapas');
 update public.atividades_kanban set status='andamento',responsavel='Equipe',prazo=current_date+1 where id='${id(70)}';
 update public.atividades_kanban set status='concluida' where id='${id(70)}';
 ${assertSql(`(select status from public.atividades_kanban where id='${id(70)}')='concluida'`,'Kanban não persistiu')}
 reset role; update public.usuarios_empresa set papel='pendente'; set role authenticated;
 ${assertSql(`(select count(*) from public.atividades_kanban)=0 and (select count(*) from public.movimentos_estoque)=0`,'RLS expôs dados')}
 ${rejects(`perform public.movimentar_estoque('${id(35)}','${id(11)}',null,'entrada',1,current_date,'Não autorizado',null)`,'Usuário pendente movimentou estoque')}
 ${rejects(`insert into public.atividades_kanban(titulo) values('Invasão')`,'Usuário pendente criou atividade')}
 reset role; update public.usuarios_empresa set papel='socio';
 `);
 // Custeio móvel: compras de valores diferentes, composição, kits e estornos.
 sql(`begin;
 insert into public.produtos(id,nome,custo,estoque_atual) values('${id(4)}','Produto custeado',999,0);
 insert into public.materias_primas(id,nome,unidade,influencia_saldo) values('${id(13)}','Chapa custeada','kg',true),('${id(14)}','Pintura custeada','un',false);
 insert into public.componentes_produto(produto_id,materia_prima_id,nome_peca,quantidade) values('${id(4)}','${id(13)}','Chapa',2),('${id(4)}','${id(14)}','Pintura',3);
 insert into public.kit_itens(kit_id,produto_id,quantidade) values('${id(21)}','${id(4)}',1),('${id(21)}','${id(4)}',1);
 set role authenticated;
 select public.salvar_compra_materiais('${id(90)}','${id(99)}',current_date,'recebido',200,'Lote A','[{"materia_prima_id":"${id(13)}","descricao":"Chapa","quantidade":10,"valor_unitario":10},{"materia_prima_id":"${id(14)}","descricao":"Pintura","quantidade":100,"valor_unitario":1}]');
 select public.salvar_compra_materiais('${id(91)}','${id(99)}',current_date,'recebido',300,'Lote B','[{"materia_prima_id":"${id(13)}","descricao":"Chapa","quantidade":10,"valor_unitario":30}]');
 ${assertSql(`(select custo_medio from public.materias_primas where id='${id(13)}')=20`,'Custo médio não ponderou os recebimentos')}
 ${rejects(`update public.materias_primas set custo_medio=999 where id='${id(13)}'`,'Custo editável sem histórico')}
 insert into public.vendas(id,produto_id,quantidade) values('${id(150)}','${id(4)}',2);
 ${assertSql(`(select cmv_total from public.vendas where id='${id(150)}')=86 and (select cmv_estimado from public.vendas where id='${id(150)}')=false`,'CMV não somou chapa e pintura pela composição')}
 ${assertSql(`(select custo_medio from public.materias_primas where id='${id(13)}')=20`,'Saída alterou média')}
 select public.salvar_compra_materiais('${id(92)}','${id(99)}',current_date,'recebido',160,'Lote C','[{"materia_prima_id":"${id(13)}","descricao":"Chapa","quantidade":4,"valor_unitario":40}]');
 ${assertSql(`(select custo_medio from public.materias_primas where id='${id(13)}')=24`,'Média não usou saldo remanescente')}
 ${assertSql(`(select cmv_total from public.vendas where id='${id(150)}')=86`,'Compra posterior alterou CMV passado')}
 insert into public.vendas(id,kit_id,quantidade) values('${id(151)}','${id(21)}',1);
 ${assertSql(`(select cmv_total from public.vendas where id='${id(151)}')=102`,'Kit não somou custo dos produtos')}
 delete from public.vendas where id='${id(151)}';
 delete from public.vendas where id='${id(150)}';
 ${assertSql(`abs((select custo_medio from public.materias_primas where id='${id(13)}')-560::numeric/24)<0.000000001`,'Estorno não recuperou custo congelado')}
 update public.pedidos_compra set status='cancelado' where id='${id(92)}';
 ${assertSql(`abs((select custo_medio from public.materias_primas where id='${id(13)}')-20)<0.000000001`,'Cancelamento não retirou custo da entrada')}
 select public.ajustar_custo_material('${id(93)}','${id(13)}',5,20,'Conciliação inicial');
 select public.ajustar_custo_material('${id(93)}','${id(13)}',5,20,'Conciliação inicial');
 ${assertSql(`(select custo_medio from public.materias_primas where id='${id(13)}')=5 and (select saldo from public.saldos_materias_primas where id='${id(13)}')=20`,'Ajuste de custo alterou quantidade')}
 select public.movimentar_estoque('${id(94)}','${id(13)}',null,'entrada',5,current_date,'Saldo inicial valorado',null,15);
 ${assertSql(`(select custo_medio from public.materias_primas where id='${id(13)}')=7`,'Entrada manual ignorou custo')}
 select public.ajustar_custo_material('${id(95)}','${id(14)}',0,100,'Material gratuito');
 insert into public.vendas(id,produto_id,quantidade) values('${id(152)}','${id(4)}',1);
 ${assertSql(`(select cmv_total from public.vendas where id='${id(152)}')=14`,'Custo zero informado confundido com custo ausente')}
 reset role;
 ${assertSql(`(public.apurar_cmv_materiais('[{"produto_id":"${id(4)}","estoque_origem":"materia_prima"}]','[{"materia_prima_id":"${id(13)}","custo_unitario":7,"custo_estimado":false},{"materia_prima_id":"${id(14)}","custo_unitario":null,"custo_estimado":false}]')->0->>'custo_unitario')::numeric=14`,'Item não lançado bloqueou soma conhecida')}
 ${assertSql(`(public.apurar_cmv_materiais('[{"produto_id":"${id(4)}","estoque_origem":"materia_prima"}]','[{"materia_prima_id":"${id(13)}","custo_unitario":7,"custo_estimado":false},{"materia_prima_id":"${id(14)}","custo_unitario":null,"custo_estimado":false}]')->0->>'estimado')::boolean`,'Custo parcial não marcado como estimado')}

 rollback;
 `);
 const resumoAntes = sql("select jsonb_build_object('custos',(select jsonb_agg(jsonb_build_array(id,custo_medio,custo_medio_estimado,custo_apurado_em) order by id) from public.materias_primas),'movimentos',(select count(*) from public.movimentos_estoque),'saldos',(select jsonb_agg(jsonb_build_array(id,saldo) order by id) from public.saldos_materias_primas))::text");
 sql(migrationSql);
 const resumoDepois = sql("select jsonb_build_object('custos',(select jsonb_agg(jsonb_build_array(id,custo_medio,custo_medio_estimado,custo_apurado_em) order by id) from public.materias_primas),'movimentos',(select count(*) from public.movimentos_estoque),'saldos',(select jsonb_agg(jsonb_build_array(id,saldo) order by id) from public.saldos_materias_primas))::text");
 if (resumoAntes !== resumoDepois) throw new Error('Reaplicação alterou custos ou saldos existentes');
 // Duas vendas de produtos diferentes competem pela mesma chapa (10 no saldo).
 const run = promisify(execFile);
 const conc = await Promise.allSettled([1,2].map(p=>run('docker',['exec',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-c',`set role authenticated; insert into public.vendas(produto_id,quantidade) values('${id(p)}',3);`],{timeout:30000})));
 if(conc.filter(r=>r.status==='fulfilled').length!==1) throw new Error('Concorrência permitiu duas vendas ou rejeitou ambas');
 sql(assertSql(`public.saldo_material('${id(11)}')>=0`,'Concorrência gerou saldo negativo'));
 console.log('OK: migração reaplicável, saldo inicial, idempotência, ajuste obsoleto, kit compartilhado, apoio faltante, snapshots, custo médio móvel por matéria-prima, CMV de produto/kit, custo de apoio, produto físico, compra/estorno, compra obrigatoriamente por matéria-prima, funções antigas bloqueadas, rollback, RLS, Kanban e vendas concorrentes.');
} catch (e) { console.error(e.stderr?.toString() ?? e); process.exitCode=1; }
finally { try { docker(['rm','-f',container]); } catch {} }
