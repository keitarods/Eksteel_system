import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { migrationSql } from './gerar-cmv-ecommerce.mjs';
const container=`eksteel-cmv-test-${randomUUID()}`;
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
 create table public.vendas(id uuid primary key default gen_random_uuid(),produto_id uuid,kit_id uuid,quantidade numeric,data date default ((now() at time zone 'America/Sao_Paulo')::date),desconto numeric default 0);
 insert into public.produtos values('00000000-0000-0000-0000-000000000001','Legado',true,20,10),('00000000-0000-0000-0000-000000000002','Novo',true,10,0);
 insert into public.vendas(id,produto_id,quantidade) values('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',3);
 alter table public.produtos enable row level security;alter table public.vendas enable row level security;
 grant select,insert,update,delete on public.vendas to authenticated;grant select on public.produtos to authenticated;
 create policy operador on public.vendas for all to authenticated using(true) with check(true);
 create policy leitura on public.produtos for select to authenticated using(true);
 `);
 sql(migrationSql);sql(migrationSql);
 sql(`do $$begin
 if not exists(select 1 from public.vendas where cmv_total=60 and cmv_estimado) then raise exception 'Legado não congelado';end if;
 if (select estoque_atual from public.produtos where nome='Legado')<>10 then raise exception 'Backfill mudou estoque';end if;
 end$$;
 set role authenticated;
 select public.registrar_reposicao_produto('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10,200,'Compra 1');
 select public.registrar_reposicao_produto('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10,200,'Compra 1');
 select public.registrar_reposicao_produto('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',10,300,'Compra 2');
 insert into public.vendas(id,produto_id,quantidade,data) values('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',3,(now() at time zone 'America/Sao_Paulo')::date);
 reset role;
 do $$begin
 if not exists(select 1 from public.produtos where nome='Novo' and estoque_atual=17 and custo_medio=25 and not custo_medio_estimado) then raise exception 'Média/saldo/idempotência incorretos';end if;
 if not exists(select 1 from public.vendas where id='20000000-0000-0000-0000-000000000002' and cmv_total=75 and not cmv_estimado) then raise exception 'CMV da venda incorreto';end if;
 end$$;
 set role authenticated;
 select public.registrar_reposicao_produto('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',10,500,'Compra posterior');
 update public.vendas set desconto=5,cmv_total=1 where id='20000000-0000-0000-0000-000000000002';
 reset role;
 do $$begin
 if (select cmv_total from public.vendas where id='20000000-0000-0000-0000-000000000002')<>75 then raise exception 'Histórico alterado';end if;
 begin update public.vendas set quantidade=4 where id='20000000-0000-0000-0000-000000000002';raise exception 'Alteração de consumo aceita' using errcode='XX000';exception when raise_exception then null;end;
 begin insert into public.vendas(produto_id,quantidade) values('00000000-0000-0000-0000-000000000002',999);raise exception 'Estoque negativo aceito' using errcode='XX000';exception when raise_exception then null;end;
 if (select estoque_atual from public.produtos where nome='Novo')<>27 then raise exception 'Falha não reverteu estoque';end if;
 end$$;
 set role authenticated;
 delete from public.vendas where id='20000000-0000-0000-0000-000000000002';
 reset role;
 do $$begin
 if not exists(select 1 from public.produtos where nome='Novo' and estoque_atual=30 and abs(custo_medio-(1000.0/30))<0.000001) then raise exception 'Estorno não devolveu custo/quantidade';end if;
 end$$;
 insert into public.kit_itens(kit_id,produto_id,quantidade) values('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',2);
 insert into public.vendas(id,kit_id,quantidade) values('20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',1);
 update public.kit_itens set quantidade=9;
 delete from public.vendas where id='20000000-0000-0000-0000-000000000003';
 do $$begin
 if (select estoque_atual from public.produtos where nome='Novo')<>30 then raise exception 'Composição histórica não preservada';end if;
 if has_table_privilege('authenticated','public.reposicoes_produtos','insert') then raise exception 'Reposição fora da função permitida';end if;
 end$$;
 update public.usuarios_empresa set papel='pendente';
 do $$begin
 begin perform public.registrar_reposicao_produto(gen_random_uuid(),'00000000-0000-0000-0000-000000000002',1,10,'');raise exception 'Pendente autorizado' using errcode='XX000';exception when raise_exception then null;end;
 end$$;
 `);
 console.log('OK: legado estimado, idempotência, média 25, CMV 75, RLS, estoque, imutabilidade, rollback, estorno e kit.');
}finally{try{docker(['rm','-f',container]);}catch{}}
