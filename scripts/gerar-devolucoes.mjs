import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const migrationSql = `
begin;
create table if not exists public.devolucoes (
 id uuid primary key,
 data date not null,
 pedido text not null default '',
 observacao text not null default '',
 itens jsonb not null,
 valor_total numeric(14,2) not null check(valor_total>0),
 quantidade numeric not null check(quantidade>0),
 criado_por uuid not null default auth.uid(),
 criado_em timestamptz not null default now()
);
alter table public.devolucoes add column if not exists custo_extra numeric(14,2) not null default 0 check(custo_extra>=0);
alter table public.devolucoes add column if not exists venda_id uuid references public.vendas(id) on delete restrict;
create index if not exists devolucoes_venda_id on public.devolucoes(venda_id);
create table if not exists public.devolucoes_vendas (
 devolucao_id uuid not null references public.devolucoes(id) on delete cascade,
 venda_id uuid not null references public.vendas(id) on delete restrict,
 primary key(devolucao_id,venda_id)
);
create index if not exists devolucoes_vendas_venda_id on public.devolucoes_vendas(venda_id);
insert into public.devolucoes_vendas(devolucao_id,venda_id)
 select id,venda_id from public.devolucoes where venda_id is not null on conflict do nothing;
alter table public.devolucoes_vendas enable row level security;
drop policy if exists devolucoes_vendas_leitura on public.devolucoes_vendas;
create policy devolucoes_vendas_leitura on public.devolucoes_vendas for select to authenticated using(public.estoque_autorizado());
revoke all on public.devolucoes_vendas from public,anon,authenticated;
grant select on public.devolucoes_vendas to authenticated;
create index if not exists devolucoes_data on public.devolucoes(data);
alter table public.devolucoes enable row level security;
drop policy if exists devolucoes_leitura on public.devolucoes;
create policy devolucoes_leitura on public.devolucoes for select to authenticated using(public.estoque_autorizado());
revoke all on public.devolucoes from public,anon,authenticated;
grant select on public.devolucoes to authenticated;
drop function if exists public.registrar_devolucao(uuid,date,text,text,jsonb);
drop function if exists public.registrar_devolucao(uuid,date,text,text,jsonb,uuid);
drop function if exists public.registrar_devolucao(uuid,date,text,text,jsonb,uuid,uuid[]);
create or replace function public.registrar_devolucao(p_id uuid,p_data date,p_pedido text,p_observacao text,p_itens jsonb,p_venda_id uuid default null,p_venda_ids uuid[] default '{}',p_custo_extra numeric default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare anterior public.devolucoes; item jsonb; produto public.produtos; material record;
 vendas_ids uuid[];
 qtd numeric; valor numeric; total numeric:=0; unidades numeric:=0; saldo numeric; snapshot jsonb:='[]';
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 if p_id is null or p_data is null or p_data>(now() at time zone 'America/Sao_Paulo')::date
 or p_pedido is null or length(p_pedido)>200 or p_observacao is null or length(p_observacao)>2000
 or p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Dados da devolução inválidos'; end if;
 if p_custo_extra is null or p_custo_extra not between 0 and 999999999999.99 or p_custo_extra<>round(p_custo_extra,2) then raise exception 'Custo extra inválido'; end if;
 if jsonb_array_length(p_itens) not between 1 and 100 then raise exception 'Informe de 1 a 100 itens'; end if;
 if array_position(p_venda_ids,null) is not null then raise exception 'Pedido de venda inválido'; end if;
 -- Ordenação e remoção de duplicados tornam o reenvio independente da ordem de seleção.
 select coalesce(array_agg(distinct v order by v),'{}'::uuid[]) into vendas_ids
 from unnest(coalesce(p_venda_ids,'{}'::uuid[]) || case when p_venda_id is null then '{}'::uuid[] else array[p_venda_id] end) v;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into anterior from public.devolucoes where id=p_id;
 if found then
   if anterior.criado_por<>auth.uid() or anterior.data<>p_data or anterior.pedido<>trim(p_pedido)
     or (select coalesce(array_agg(venda_id order by venda_id),'{}'::uuid[]) from public.devolucoes_vendas where devolucao_id=p_id) is distinct from vendas_ids
     or anterior.custo_extra<>p_custo_extra
     or anterior.observacao<>trim(p_observacao) or anterior.itens->'solicitacao' is distinct from p_itens then
     raise exception 'Identificador já usado em outra devolução';
   end if;
   return p_id;
 end if;
 if exists(select 1 from unnest(vendas_ids) v where not exists(select 1 from public.vendas where id=v)) then raise exception 'Pedido de venda não encontrado'; end if;
 -- Travas em ordem fixa evitam perda de saldo entre lançamentos simultâneos.
 perform 1 from public.produtos where id in(select (value->>'produto_id')::uuid from jsonb_array_elements(p_itens)) order by id for update;
 perform 1 from public.materias_primas where id in(select c.materia_prima_id from public.componentes_produto c join jsonb_array_elements(p_itens) i on c.produto_id=(i->>'produto_id')::uuid) order by id for update;
 for item in select value from jsonb_array_elements(p_itens) loop
   qtd:=(item->>'quantidade')::numeric; valor:=(item->>'valor_unitario')::numeric;
   if qtd is null or qtd not between 1 and 1000000 or qtd<>trunc(qtd) or valor is null or valor not between 0.01 and 1000000000 or valor<>round(valor,2)
     or jsonb_typeof(item->'em_boas_condicoes') is distinct from 'boolean' then raise exception 'Quantidade, valor ou condição inválida'; end if;
   select * into produto from public.produtos where id=(item->>'produto_id')::uuid;
   if not found then raise exception 'Produto não encontrado'; end if;
   total:=total+round(qtd*valor,2); unidades:=unidades+qtd;
   snapshot:=snapshot||jsonb_build_array(item||jsonb_build_object('codigo',produto.codigo,'nome',produto.nome));
   if (item->>'em_boas_condicoes')::boolean then
     if exists(select 1 from public.componentes_produto where produto_id=produto.id) then
       if exists(select 1 from public.componentes_produto where produto_id=produto.id and (materia_prima_id is null or quantidade is null or quantidade<=0)) then raise exception 'Corrija a composição do produto antes de devolver ao estoque'; end if;
       -- O estoque atual é controlado pelos componentes: retorna sua quantidade equivalente.
       for material in select m.id,sum(c.quantidade)*qtd as quantidade from public.componentes_produto c join public.materias_primas m on m.id=c.materia_prima_id where c.produto_id=produto.id group by m.id order by m.id loop
         saldo:=public.saldo_material(material.id);
         insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo)
         values(material.id,material.quantidade,saldo+material.quantidade,'entrada',p_id,p_data,'Devolução: '||coalesce(produto.codigo,produto.nome));
       end loop;
     else
       update public.produtos set estoque_atual=estoque_atual+qtd,custo_medio_estimado=true where id=produto.id returning estoque_atual into saldo;
       insert into public.movimentos_estoque(produto_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo)
       values(produto.id,qtd,saldo,'entrada',p_id,p_data,'Devolução: '||coalesce(produto.codigo,produto.nome));
     end if;
   end if;
 end loop;
 insert into public.devolucoes(id,data,pedido,observacao,itens,valor_total,quantidade,venda_id,custo_extra)
 values(p_id,p_data,trim(p_pedido),trim(p_observacao),jsonb_build_object('solicitacao',p_itens,'registrados',snapshot),total,unidades,p_venda_id,p_custo_extra);
 insert into public.devolucoes_vendas(devolucao_id,venda_id) select p_id,v from unnest(vendas_ids) v;
 return p_id;
end;
$$;
revoke all on function public.registrar_devolucao(uuid,date,text,text,jsonb,uuid,uuid[],numeric) from public,anon;
grant execute on function public.registrar_devolucao(uuid,date,text,text,jsonb,uuid,uuid[],numeric) to authenticated;
commit;
`;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 mkdirSync('supabase/local', {recursive:true});
 writeFileSync('supabase/local/devolucoes.sql', migrationSql);
 console.log('Gerado supabase/local/devolucoes.sql');
}
