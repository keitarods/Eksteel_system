import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {migrationSql as base} from './gerar-cmv-ecommerce.mjs';
import {migrationSql} from './gerar-unificacao-compras.mjs';
const container=`eksteel-unificacao-${randomUUID()}`;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000});
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input);
try{
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 sql(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-0000-0000-000000000001'::uuid$$;
 create table public.usuarios_empresa(usuario_id uuid,papel text);insert into public.usuarios_empresa values(auth.uid(),'socio');
 create table public.produtos(id uuid primary key,nome text,ativo boolean default true,custo numeric,estoque_atual numeric default 0);
 create table public.kit_itens(id uuid default gen_random_uuid(),kit_id uuid,produto_id uuid,quantidade numeric);
 create table public.vendas(id uuid primary key default gen_random_uuid(),produto_id uuid,kit_id uuid,quantidade numeric,data date default ((now() at time zone 'America/Sao_Paulo')::date));
 create table public.pedidos_fabricacao(id uuid primary key default gen_random_uuid(),produto_id uuid,produto_nome text,qtd_fabricada numeric,data date,valor_total numeric,observacao text,criado_por uuid);
 create table public.itens_fabricacao(id uuid default gen_random_uuid(),pedido_id uuid,nome_peca text,qtd_pc numeric,qtd_total numeric,fornecedor_nome text,preco_unitario numeric,preco_total numeric);
 insert into public.produtos values('00000000-0000-0000-0000-000000000001','P1',true,0,10),('00000000-0000-0000-0000-000000000002','P2',true,0,5);
 insert into public.pedidos_fabricacao(produto_id,qtd_fabricada,valor_total,data) values('00000000-0000-0000-0000-000000000001',10,200,current_date-10),('00000000-0000-0000-0000-000000000002',10,300,current_date-1);
 insert into public.vendas(id,produto_id,quantidade,data) values('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',2,current_date-5),('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',2,current_date-5),('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',1,current_date-3);
 grant select,insert,update,delete on public.vendas to authenticated;
 `);
 sql(base);
 sql(`alter table public.vendas disable trigger cmv_venda;update public.vendas set cmv_total=17 where id='20000000-0000-0000-0000-000000000003';alter table public.vendas enable trigger cmv_venda;`);
 sql(migrationSql);sql(migrationSql);
 sql(`do $$begin
 if (select sum(estoque_atual) from public.produtos)<>15 or exists(select 1 from public.reposicoes_produtos) then raise exception 'Conciliação duplicou estoque';end if;
 if (select cmv_total from public.vendas where id='20000000-0000-0000-0000-000000000001')<>40 then raise exception 'Entrada anterior não aproveitada';end if;
 if (select cmv_total from public.vendas where id='20000000-0000-0000-0000-000000000002')<>60 then raise exception 'Estimativa disponível não aproveitada';end if;
 if (select cmv_total from public.vendas where id='20000000-0000-0000-0000-000000000003')<>17 then raise exception 'CMV já calculado alterado';end if;
 if (select count(*) from public.vendas where cmv_reconciliado_em is not null and cmv_estimado)<>2 then raise exception 'Conciliação sem marcação estimada';end if;
 end$$;
 set role authenticated;
 select public.registrar_compra_produto('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',10,300,'[]','Direta');
 select public.registrar_compra_produto('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',10,300,'[]','Direta');
 select public.registrar_compra_produto('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',2,40,'[{"nome_peca":"Componente","qtd_pc":1,"preco_unitario":20,"fornecedor_nome":"Teste"}]','Componentes');
 insert into public.vendas(produto_id,quantidade) values('00000000-0000-0000-0000-000000000001',2);
 reset role;
 do $$begin
 if not exists(select 1 from public.produtos where nome='P1' and estoque_atual=18 and custo_medio=25) then raise exception 'Compra não atualizou custo/estoque uma vez';end if;
 if (select count(*) from public.reposicoes_produtos)<>2 or (select count(*) from public.pedidos_fabricacao)<>4 or (select count(*) from public.itens_fabricacao)<>1 then raise exception 'Histórico/itens inconsistentes';end if;
 if not exists(select 1 from public.vendas where produto_id='00000000-0000-0000-0000-000000000001' and cmv_total=50) then raise exception 'Nova venda não usou compra';end if;
 begin perform public.registrar_compra_produto(gen_random_uuid(),'00000000-0000-0000-0000-000000000002',1,999,'[{"nome_peca":"C","qtd_pc":1,"preco_unitario":20}]','');raise exception 'Total incorreto aceito' using errcode='XX000';exception when raise_exception then null;end;
 if (select count(*) from public.reposicoes_produtos)<>2 then raise exception 'Compra inválida gravada parcialmente';end if;
 begin delete from public.pedidos_fabricacao where id='30000000-0000-0000-0000-000000000001';raise exception 'Exclusão incoerente aceita' using errcode='XX000';exception when raise_exception then null;end;
 end$$;
 update public.usuarios_empresa set papel='pendente';
 do $$begin begin perform public.registrar_compra_produto(gen_random_uuid(),'00000000-0000-0000-0000-000000000002',1,20,'[]','');raise exception 'Pendente autorizado' using errcode='XX000';exception when raise_exception then null;end;end$$;
 `);
 console.log('OK: CMV ausente recuperado como estimativa, estoque intacto, CMV existente preservado, compra direta/componentes, idempotência, rollback, CMV futuro e permissões.');
}finally{try{docker(['rm','-f',container]);}catch{}}
