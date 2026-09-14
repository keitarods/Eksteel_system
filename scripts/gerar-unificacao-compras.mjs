import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const migrationSql=`begin;
-- Requer cmv-ecommerce.sql. Pausar gravações durante a configuração.
lock table public.produtos,public.vendas,public.pedidos_fabricacao in share row exclusive mode;
alter table public.pedidos_fabricacao add column if not exists compra_payload jsonb;
alter table public.vendas add column if not exists cmv_reconciliado_em timestamptz;

-- Recupera somente o custo inicial ausente. Não insere reposições nem muda estoque.
with custos as (
 select produto_id,sum(valor_total)/sum(qtd_fabricada) as custo
 from public.pedidos_fabricacao where qtd_fabricada>0 and valor_total>0 and data <= (now() at time zone 'America/Sao_Paulo')::date
 group by produto_id
)
update public.produtos p set custo_medio=c.custo,custo_medio_estimado=true from custos c
where p.id=c.produto_id and coalesce(p.custo_medio,0)<=0;

-- Repara apenas CMV vazio; conserva as quantidades gravadas na migração anterior.
-- Operação administrativa sob lock: desativa somente o gatilho específico de CMV.
alter table public.vendas disable trigger cmv_venda;
with componentes as (
 select v.id,coalesce(jsonb_agg(
   i || jsonb_build_object('custo_unitario', coalesce(nullif((i->>'custo_unitario')::numeric,0),
     anterior.custo, nullif(p.custo,0),nullif(p.custo_medio,0)),
     'estimado',true,'origem','conciliacao_entradas_legacy') order by n
 ),'[]'::jsonb) as itens
 from public.vendas v cross join lateral jsonb_array_elements(v.cmv_componentes) with ordinality as j(i,n)
 left join public.produtos p on p.id=(i->>'produto_id')::uuid
 left join lateral (
   select sum(f.valor_total)/sum(f.qtd_fabricada) as custo from public.pedidos_fabricacao f
   where f.produto_id=p.id and f.data<=v.data and f.qtd_fabricada>0 and f.valor_total>0
 ) anterior on true
 where v.cmv_total is null group by v.id
), apurado as (
 select c.id,c.itens,(select case when count(*)=0 or count(*) filter(where coalesce((i->>'custo_unitario')::numeric,0)<=0 or coalesce((i->>'quantidade')::numeric,0)<=0)>0 then null
 else round(sum((i->>'custo_unitario')::numeric*(i->>'quantidade')::numeric),2) end from jsonb_array_elements(c.itens) i) total from componentes c
)
update public.vendas v set cmv_componentes=a.itens,cmv_total=a.total,cmv_estimado=true,cmv_reconciliado_em=now()
from apurado a where v.id=a.id and v.cmv_total is null and a.total is not null;
alter table public.vendas enable trigger cmv_venda;

create or replace function public.registrar_compra_produto(p_id uuid,p_produto_id uuid,p_quantidade numeric,p_valor_total numeric,p_itens jsonb default '[]'::jsonb,p_observacao text default '')
returns public.pedidos_fabricacao language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_fabricacao; item jsonb; total numeric:=0; payload jsonb; nome_produto text;
begin
 if auth.uid() is null or not exists(select 1 from public.usuarios_empresa where usuario_id=auth.uid() and papel in ('admin','socio')) then raise exception 'Usuário sem permissão'; end if;
 if p_id is null or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>200 then raise exception 'Itens inválidos'; end if;
 payload:=jsonb_build_object('produto',p_produto_id,'quantidade',p_quantidade,'valor',p_valor_total,'itens',p_itens,'observacao',coalesce(p_observacao,''));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into pedido from public.pedidos_fabricacao where id=p_id;
 if found then
   if pedido.compra_payload is distinct from payload or pedido.criado_por<>auth.uid() then raise exception 'Chave já utilizada em outra compra'; end if;
   return pedido;
 end if;
 for item in select value from jsonb_array_elements(p_itens) loop
   if coalesce(item->>'nome_peca','')='' or coalesce((item->>'qtd_pc')::numeric,0)<=0 or (item->>'preco_unitario')::numeric is null or (item->>'preco_unitario')::numeric<0 then raise exception 'Componente sem quantidade/preço válido'; end if;
   total:=total+(item->>'qtd_pc')::numeric*p_quantidade*(item->>'preco_unitario')::numeric;
 end loop;
 if jsonb_array_length(p_itens)>0 and round(total,2)<>round(p_valor_total,2) then raise exception 'Total não corresponde aos componentes'; end if;
 -- Esta função faz a única entrada no estoque; o registro antigo é histórico/documento.
 perform public.registrar_reposicao_produto(p_id,p_produto_id,p_quantidade,p_valor_total,p_observacao);
 select nome into nome_produto from public.produtos where id=p_produto_id;
 insert into public.pedidos_fabricacao(id,criado_por,produto_id,produto_nome,qtd_fabricada,data,valor_total,observacao,compra_payload)
 values(p_id,auth.uid(),p_produto_id,nome_produto,p_quantidade,(now() at time zone 'America/Sao_Paulo')::date,p_valor_total,coalesce(p_observacao,''),payload) returning * into pedido;
 for item in select value from jsonb_array_elements(p_itens) loop
  insert into public.itens_fabricacao(pedido_id,nome_peca,qtd_pc,qtd_total,fornecedor_nome,preco_unitario,preco_total)
  values(p_id,item->>'nome_peca',(item->>'qtd_pc')::numeric,(item->>'qtd_pc')::numeric*p_quantidade,coalesce(item->>'fornecedor_nome',''),(item->>'preco_unitario')::numeric,(item->>'qtd_pc')::numeric*p_quantidade*(item->>'preco_unitario')::numeric);
 end loop;
 return pedido;
end;
$$;
revoke all on function public.registrar_compra_produto(uuid,uuid,numeric,numeric,jsonb,text) from public,anon;
grant execute on function public.registrar_compra_produto(uuid,uuid,numeric,numeric,jsonb,text) to authenticated;

create or replace function public.proteger_compra_cmv() returns trigger language plpgsql set search_path='' as $$
begin
 if OLD.compra_payload is not null then
   if TG_OP='DELETE' then raise exception 'Compra recebida já integrada ao CMV. Concilie o estorno antes de excluir'; end if;
   if NEW.valor_total is distinct from OLD.valor_total or NEW.qtd_fabricada is distinct from OLD.qtd_fabricada or NEW.produto_id is distinct from OLD.produto_id or NEW.compra_payload is distinct from OLD.compra_payload then raise exception 'Custo e quantidade integrados ao CMV não podem ser alterados diretamente'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
drop trigger if exists proteger_compra_cmv on public.pedidos_fabricacao;
create trigger proteger_compra_cmv before update or delete on public.pedidos_fabricacao for each row execute function public.proteger_compra_cmv();
notify pgrst,'reload schema';
commit;
`;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const p=resolve('supabase/local/unificar-compras-cmv.sql');mkdirSync(dirname(p),{recursive:true});writeFileSync(p,migrationSql);console.log('Gerado: '+p);}
