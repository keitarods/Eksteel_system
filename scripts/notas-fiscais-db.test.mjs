import { migrationSql } from './gerar-notas-fiscais.mjs';
export function testarNotasFiscais(sql,id,check,rejects) {
 // Estrutura mínima do Storage para testar as políticas em PostgreSQL isolado.
 sql(`create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;`);
 sql(migrationSql); sql(migrationSql);
 sql(`begin;
 insert into public.pedidos_compra(id,status,data,valor_total) values('${id(850)}','pendente',current_date,0);
 insert into public.vendas(id,produto_id,quantidade) values('${id(851)}','${id(3)}',1);
 set local role authenticated;
 insert into storage.objects(bucket_id,name) values('notas-fiscais','compras/${id(850)}/${id(852)}/nota.xml'),('notas-fiscais','vendas/${id(851)}/${id(853)}/nota.pdf');
 ${check(`(select count(*) from storage.objects)=2`,'Notas legítimas não acessíveis')}
 ${rejects(`insert into storage.objects(bucket_id,name) values('notas-fiscais','compras/${id(999)}/abc/nota.pdf')`,'Permitiu nota de pedido inexistente')}
 ${rejects(`insert into storage.objects(bucket_id,name) values('notas-fiscais','outro/${id(850)}/abc/nota.pdf')`,'Permitiu tipo inválido')}
 update storage.objects set name='alterado';
 ${check(`not exists(select 1 from storage.objects where name='alterado')`,'Permitiu sobrescrita')}
 reset role; update public.usuarios_empresa set papel='pendente'; set local role authenticated;
 ${check(`(select count(*) from storage.objects)=0`,'Pendente leu notas')}
 ${rejects(`insert into storage.objects(bucket_id,name) values('notas-fiscais','compras/${id(850)}/abc/nota.pdf')`,'Pendente anexou nota')}
 reset role; update public.usuarios_empresa set papel='socio'; set local role authenticated;
 delete from storage.objects;
 ${check(`(select count(*) from storage.objects)=0`,'Não removeu notas')}
 rollback;`);
 console.log('OK: bucket privado, notas de compra/venda, RLS, pedidos inexistentes e bloqueio de sobrescrita.');
}
