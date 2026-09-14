import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const migrationSql = `begin;
-- Migração de custo/estoque: executar com o sistema sem sessões antigas gravando vendas.
lock table public.produtos, public.vendas in share row exclusive mode;
alter table public.produtos add column if not exists custo_medio numeric;
alter table public.produtos add column if not exists custo_medio_estimado boolean not null default true;
update public.produtos set custo_medio = nullif(custo, 0) where custo_medio is null and custo > 0;
alter table public.vendas add column if not exists cmv_total numeric;
alter table public.vendas add column if not exists cmv_estimado boolean not null default true;
alter table public.vendas add column if not exists cmv_componentes jsonb;
alter table public.vendas add column if not exists cmv_registrado_em timestamptz;

create table if not exists public.reposicoes_produtos (
 id uuid primary key, produto_id uuid not null references public.produtos(id),
 quantidade numeric not null check (quantidade > 0), valor_total numeric not null check (valor_total > 0),
 custo_medio_apos numeric, saldo_apos numeric, observacao text not null default '',
 criado_por uuid not null, criado_em timestamptz not null default now()
);
alter table public.reposicoes_produtos enable row level security;
drop policy if exists reposicoes_leitura on public.reposicoes_produtos;
create policy reposicoes_leitura on public.reposicoes_produtos for select to authenticated using (
 exists(select 1 from public.usuarios_empresa u where u.usuario_id=auth.uid() and u.papel in ('admin','socio'))
);
revoke all on public.reposicoes_produtos from anon,authenticated;
grant select on public.reposicoes_produtos to authenticated;

create or replace function public.cmv_composicao(p_produto uuid,p_kit uuid,p_quantidade numeric,p_cadastro boolean)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('produto_id', c.produto_id,'quantidade',c.qtd,
 'custo_unitario', case when p_cadastro then nullif(p.custo,0) else coalesce(p.custo_medio,nullif(p.custo,0)) end,
 'estimado', case when p_cadastro then true else p.custo_medio_estimado end) order by c.produto_id),'[]'::jsonb)
 from (
 select p_produto as produto_id, p_quantidade as qtd where p_kit is null and p_produto is not null
 union all
 select produto_id,sum(quantidade)*p_quantidade from public.kit_itens where kit_id=p_kit group by produto_id
 ) c left join public.produtos p on p.id=c.produto_id;
$$;
revoke all on function public.cmv_composicao(uuid,uuid,numeric,boolean) from public,anon,authenticated;

-- Congela a estimativa histórica sem movimentar o estoque existente.
update public.vendas set cmv_componentes=public.cmv_composicao(produto_id,kit_id,quantidade,true),
 cmv_estimado=true,cmv_registrado_em=now() where cmv_registrado_em is null;
update public.vendas v set cmv_total=(select case when count(*)=0 or count(*) filter(where (i->>'custo_unitario')::numeric is null or (i->>'custo_unitario')::numeric<=0 or (i->>'quantidade')::numeric<=0)>0 then null
 else round(sum((i->>'quantidade')::numeric*(i->>'custo_unitario')::numeric),2) end from jsonb_array_elements(v.cmv_componentes) i)
 where cmv_total is null;

create or replace function public.registrar_reposicao_produto(p_id uuid,p_produto_id uuid,p_quantidade numeric,p_valor_total numeric,p_observacao text default '')
returns public.reposicoes_produtos language plpgsql security definer set search_path='' as $$
declare p public.produtos; r public.reposicoes_produtos; media numeric; estimado boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.usuarios_empresa where usuario_id=auth.uid() and papel in ('admin','socio')) then raise exception 'Usuário sem permissão'; end if;
 if p_id is null or p_produto_id is null or p_quantidade is null or p_valor_total is null or p_quantidade<=0 or p_quantidade>100000000 or p_valor_total<=0 or p_valor_total>1000000000 or length(coalesce(p_observacao,''))>2000 then raise exception 'Quantidade, valor ou observação inválidos'; end if;
 -- Mesma chave em uma tentativa repetida não duplica a entrada.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into r from public.reposicoes_produtos where id=p_id;
 if found then
   if r.produto_id<>p_produto_id or r.quantidade<>p_quantidade or r.valor_total<>p_valor_total or r.observacao<>coalesce(p_observacao,'') or r.criado_por<>auth.uid() then raise exception 'Chave já usada em outra reposição'; end if;
   return r;
 end if;
 select * into p from public.produtos where id=p_produto_id for update;
 if not found or not p.ativo then raise exception 'Produto inexistente ou inativo'; end if;
 if p.estoque_atual<0 then raise exception 'Concilie o estoque negativo antes de repor'; end if;
 if p.estoque_atual>0 and (coalesce(p.custo_medio,nullif(p.custo,0)) is null or coalesce(p.custo_medio,nullif(p.custo,0))<=0) then raise exception 'Informe o custo cadastral do saldo inicial antes de repor'; end if;
 media := ((p.estoque_atual*coalesce(p.custo_medio,nullif(p.custo,0),0))+p_valor_total)/(p.estoque_atual+p_quantidade);
 estimado := p.estoque_atual>0 and p.custo_medio_estimado;
 update public.produtos set estoque_atual=estoque_atual+p_quantidade,custo_medio=media,custo_medio_estimado=estimado where id=p.id;
 insert into public.reposicoes_produtos(id,produto_id,quantidade,valor_total,custo_medio_apos,saldo_apos,observacao,criado_por)
 values(p_id,p.id,p_quantidade,p_valor_total,media,p.estoque_atual+p_quantidade,coalesce(p_observacao,''),auth.uid()) returning * into r;
 return r;
end;
$$;
revoke all on function public.registrar_reposicao_produto(uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.registrar_reposicao_produto(uuid,uuid,numeric,numeric,text) to authenticated;

create or replace function public.cmv_movimentar_venda()
returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; p public.produtos; qtd numeric; unitario numeric; componentes jsonb := '[]'::jsonb;
begin
 if TG_OP='UPDATE' then
   if NEW.produto_id is distinct from OLD.produto_id or NEW.kit_id is distinct from OLD.kit_id or NEW.quantidade is distinct from OLD.quantidade then
     raise exception 'Para alterar produto, kit ou quantidade, exclua a venda e registre novamente. O estoque será estornado.';
   end if;
   NEW.cmv_total:=OLD.cmv_total; NEW.cmv_componentes:=OLD.cmv_componentes; NEW.cmv_estimado:=OLD.cmv_estimado or NEW.data is distinct from OLD.data; NEW.cmv_registrado_em:=OLD.cmv_registrado_em;
   return NEW;
 end if;
 if TG_OP='DELETE' then
   if OLD.cmv_componentes is null or jsonb_array_length(OLD.cmv_componentes)=0 then raise exception 'Venda histórica sem composição: concilie antes de excluir'; end if;
   for item in select value from jsonb_array_elements(OLD.cmv_componentes) order by value->>'produto_id' loop
     select * into p from public.produtos where id=(item->>'produto_id')::uuid for update;
     if not found then raise exception 'Produto histórico não disponível para estornar estoque'; end if;
     qtd:=(item->>'quantidade')::numeric; unitario:=(item->>'custo_unitario')::numeric;
     update public.produtos set estoque_atual=estoque_atual+qtd,
       custo_medio=case when unitario is null or (estoque_atual>0 and custo_medio is null) then null else (coalesce(estoque_atual*custo_medio,0)+qtd*unitario)/(estoque_atual+qtd) end,
       custo_medio_estimado=custo_medio_estimado or OLD.cmv_estimado
     where id=p.id;
   end loop;
   return OLD;
 end if;
 if NEW.data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Registre somente vendas já realizadas'; end if;
 if NEW.quantidade is null or NEW.quantidade<=0 or NEW.quantidade>100000000 then raise exception 'Quantidade inválida'; end if;
 if NEW.produto_id is not null and NEW.kit_id is not null then raise exception 'Informe produto ou kit, não os dois'; end if;
 NEW.cmv_componentes:=public.cmv_composicao(NEW.produto_id,NEW.kit_id,NEW.quantidade,false);
 if jsonb_array_length(NEW.cmv_componentes)=0 then raise exception 'Produto ou composição de kit não disponível'; end if;
 -- Bloqueia os produtos sempre na mesma ordem; relê o custo após adquirir os locks.
 for item in select value from jsonb_array_elements(NEW.cmv_componentes) order by value->>'produto_id' loop
   select * into p from public.produtos where id=(item->>'produto_id')::uuid for update;
   qtd:=(item->>'quantidade')::numeric;
   if not found or qtd is null or qtd<=0 or p.estoque_atual<qtd then raise exception 'Estoque insuficiente ou composição inválida'; end if;
   componentes:=componentes || jsonb_build_array(jsonb_build_object('produto_id',p.id,'quantidade',qtd,'custo_unitario',coalesce(p.custo_medio,nullif(p.custo,0)),'estimado',p.custo_medio_estimado));
 end loop;
 NEW.cmv_componentes:=componentes;
 NEW.cmv_estimado:=NEW.data < (now() at time zone 'America/Sao_Paulo')::date;
 NEW.cmv_total:=0;
 for item in select value from jsonb_array_elements(NEW.cmv_componentes) loop
   qtd:=(item->>'quantidade')::numeric; unitario:=(item->>'custo_unitario')::numeric;
   if unitario is null or unitario<=0 then NEW.cmv_total:=null; else NEW.cmv_total:=NEW.cmv_total+qtd*unitario; end if;
   NEW.cmv_estimado:=NEW.cmv_estimado or coalesce((item->>'estimado')::boolean,true);
   update public.produtos set estoque_atual=estoque_atual-qtd where id=(item->>'produto_id')::uuid;
 end loop;
 NEW.cmv_total:=round(NEW.cmv_total,2); NEW.cmv_registrado_em:=now();
 return NEW;
end;
$$;
revoke all on function public.cmv_movimentar_venda() from public,anon,authenticated;
drop trigger if exists cmv_venda on public.vendas;
create trigger cmv_venda before insert or update or delete on public.vendas for each row execute function public.cmv_movimentar_venda();
notify pgrst,'reload schema';
commit;
`;
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const path=resolve('supabase/local/cmv-ecommerce.sql');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,migrationSql);console.log(`Gerado: ${path}`);
}
