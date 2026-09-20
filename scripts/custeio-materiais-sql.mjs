// Trechos incorporados ao SQL de estoque; custo médio móvel, sem arredondar as médias.
export const estruturaCustosSql = `
alter table public.materias_primas add column if not exists custo_medio numeric;
alter table public.materias_primas add column if not exists custo_medio_estimado boolean not null default true;
alter table public.materias_primas add column if not exists custo_apurado_em timestamptz;
alter table public.movimentos_estoque add column if not exists custo_informado numeric;
alter table public.movimentos_estoque add column if not exists custo_unitario numeric;
alter table public.movimentos_estoque add column if not exists custo_medio_apos numeric;
alter table public.movimentos_estoque add column if not exists custo_estimado_apos boolean;
alter table public.movimentos_estoque add column if not exists custo_origem_estimado boolean;
alter table public.movimentos_estoque drop constraint if exists movimentos_estoque_quantidade_check;
alter table public.movimentos_estoque add constraint movimentos_estoque_quantidade_check check(abs(quantidade)<=1000000000 and (quantidade<>0 or tipo='ajuste_custo'));
alter table public.movimentos_estoque drop constraint if exists movimentos_estoque_tipo_check;
alter table public.movimentos_estoque add constraint movimentos_estoque_tipo_check check(tipo in ('entrada','saida','ajuste','compra','estorno_compra','venda','estorno_venda','ajuste_custo'));

-- Inicialização única: compras históricas dão apenas uma referência estimada.
-- Não reescreve CMVs nem movimenta quantidades. Sem referência, permanece sem custo.
with referencia as (
 select i.materia_prima_id,sum(i.quantidade*i.valor_unitario)/sum(i.quantidade) as custo
 from public.pedido_compra_itens i join public.pedidos_compra p on p.id=i.pedido_compra_id
 where p.status='recebido' and i.materia_prima_id is not null and i.quantidade>0 and i.valor_unitario>=0
 group by i.materia_prima_id
)
update public.materias_primas m set custo_medio=r.custo,custo_medio_estimado=true
from referencia r where m.id=r.materia_prima_id and m.custo_apurado_em is null and m.custo_medio is null;
update public.materias_primas set custo_apurado_em=now() where custo_apurado_em is null;

create or replace function public.proteger_custo_material() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
   if TG_OP='INSERT' then
     if NEW.custo_medio is not null or NEW.custo_medio_estimado is distinct from true or NEW.custo_apurado_em is not null then raise exception 'Informe custo por compra ou ajuste com histórico'; end if;
   elsif NEW.custo_medio is distinct from OLD.custo_medio or NEW.custo_medio_estimado is distinct from OLD.custo_medio_estimado or NEW.custo_apurado_em is distinct from OLD.custo_apurado_em then raise exception 'Informe custo por compra ou ajuste com histórico'; end if;
 end if;
 return NEW;
end;
$$;
drop trigger if exists proteger_custo_material on public.materias_primas;
create trigger proteger_custo_material before insert or update on public.materias_primas for each row execute function public.proteger_custo_material();

create or replace function public.valorar_movimento_material() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.materias_primas; saldo numeric; media numeric; estimado boolean; valor_restante numeric;
begin
 if NEW.materia_prima_id is null then return NEW; end if;
 select * into m from public.materias_primas where id=NEW.materia_prima_id for update;
 if not found then raise exception 'Matéria-prima indisponível'; end if;
 saldo:=public.saldo_material(m.id);
 if NEW.saldo_apos<>saldo+NEW.quantidade or NEW.saldo_apos<0 then raise exception 'Saldo do movimento inconsistente'; end if;
 if NEW.custo_informado is not null and (NEW.custo_informado<0 or NEW.custo_informado>1000000000) then raise exception 'Custo unitário inválido'; end if;
 media:=m.custo_medio; estimado:=m.custo_medio_estimado;
 if NEW.tipo='ajuste_custo' then
   if NEW.quantidade<>0 or NEW.custo_informado is null then raise exception 'Informe o novo custo médio'; end if;
   media:=NEW.custo_informado; NEW.custo_unitario:=media; estimado:=true;
 elsif NEW.quantidade>0 then
   -- Entradas sem custo informado usam referência atual explicitamente estimada.
   -- Estornos antigos sem snapshot de custo continuam desconhecidos.
   NEW.custo_unitario:=case when NEW.tipo='estorno_venda' then NEW.custo_informado else coalesce(NEW.custo_informado,m.custo_medio) end;
   estimado:=coalesce(NEW.custo_origem_estimado,NEW.tipo not in ('compra','estorno_venda')) or (saldo>0 and m.custo_medio_estimado) or NEW.custo_unitario is null;
   if saldo=0 then media:=NEW.custo_unitario;
   elsif m.custo_medio is null or NEW.custo_unitario is null then media:=null;
   else media:=(saldo*m.custo_medio+NEW.quantidade*NEW.custo_unitario)/NEW.saldo_apos; end if;
 elsif NEW.tipo='estorno_compra' then
   NEW.custo_unitario:=NEW.custo_informado;
   if NEW.saldo_apos>0 then
     if media is null or NEW.custo_unitario is null then media:=null; estimado:=true;
     else
       valor_restante:=saldo*media+NEW.quantidade*NEW.custo_unitario;
       if valor_restante<0 then raise exception 'Estorno deixaria valor de estoque negativo. Concilie o custo antes de cancelar'; end if;
       media:=valor_restante/NEW.saldo_apos;
     end if;
   end if;
 else
   NEW.custo_unitario:=m.custo_medio;
 end if;
 NEW.custo_medio_apos:=media; NEW.custo_estimado_apos:=estimado or media is null;
 update public.materias_primas set custo_medio=media,custo_medio_estimado=NEW.custo_estimado_apos,custo_apurado_em=now() where id=m.id;
 return NEW;
end;
$$;
revoke all on function public.valorar_movimento_material() from public,anon,authenticated;
drop trigger if exists valorar_movimento_material on public.movimentos_estoque;
create trigger valorar_movimento_material before insert on public.movimentos_estoque for each row execute function public.valorar_movimento_material();
`;

export const funcoesCustosSql = `
create or replace function public.ajustar_custo_material(p_id uuid,p_material uuid,p_custo numeric,p_saldo_esperado numeric,p_motivo text)
returns public.movimentos_estoque language plpgsql security definer set search_path='' as $$
declare saldo numeric; mov public.movimentos_estoque;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 if p_id is null or p_material is null or p_custo is null or p_custo<0 or p_custo>1000000000 or length(trim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'Informe matéria-prima, custo e motivo válidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into mov from public.movimentos_estoque where id=p_id;
 if found then
   if mov.materia_prima_id is distinct from p_material or mov.tipo<>'ajuste_custo' or mov.custo_informado is distinct from p_custo or mov.motivo<>trim(p_motivo) or mov.criado_por<>auth.uid() then raise exception 'Chave utilizada em outro ajuste'; end if;
   return mov;
 end if;
 perform 1 from public.materias_primas where id=p_material and ativo for update;
 if not found then raise exception 'Matéria-prima inexistente ou inativa'; end if;
 saldo:=public.saldo_material(p_material);
 if p_saldo_esperado is null or saldo<>p_saldo_esperado then raise exception 'O saldo mudou. Atualize antes de ajustar o custo'; end if;
 insert into public.movimentos_estoque(id,materia_prima_id,quantidade,saldo_apos,tipo,data,motivo,custo_informado)
 values(p_id,p_material,0,saldo,'ajuste_custo',(now() at time zone 'America/Sao_Paulo')::date,trim(p_motivo),p_custo) returning * into mov;
 return mov;
end;
$$;
revoke all on function public.ajustar_custo_material(uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.ajustar_custo_material(uuid,uuid,numeric,numeric,text) to authenticated;

`;

export const apurarCmvSql = `
create or replace function public.apurar_cmv_materiais(p_componentes jsonb,p_materiais jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p jsonb; resultado jsonb:='[]'; itens jsonb; custo numeric; estimado boolean;
begin
 for p in select value from jsonb_array_elements(p_componentes) loop
   if p->>'estoque_origem'='materia_prima' then
     select case when count(*)=0 or count(*) filter(where m is null)>0 then null
       else sum(c.quantidade*(m->>'custo_unitario')::numeric) end,
       coalesce(bool_or(coalesce((m->>'custo_estimado')::boolean,true) or (m->>'custo_unitario') is null or coalesce((m->>'faltante')::numeric,0)>0),true),
       coalesce(jsonb_agg(jsonb_build_object('materia_prima_id',c.materia_prima_id,'quantidade',c.quantidade,'custo_unitario',(m->>'custo_unitario')::numeric) order by c.id),'[]')
     into custo,estimado,itens
     from public.componentes_produto c left join lateral (select value as m from jsonb_array_elements(p_materiais) where value->>'materia_prima_id'=c.materia_prima_id::text) material on true
     where c.produto_id=(p->>'produto_id')::uuid;
     p:=p || jsonb_build_object('custo_unitario',custo,'estimado',estimado or custo is null,'materiais',itens,'custo_origem','media_materias_primas');
   end if;
   resultado:=resultado || jsonb_build_array(p);
 end loop;
 return resultado;
end;
$$;
revoke all on function public.apurar_cmv_materiais(jsonb,jsonb) from public,anon,authenticated;
`;
