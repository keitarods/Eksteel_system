import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationSql as estoque } from './gerar-estoque-materias-primas.mjs';

// Contexto privado: clientes não podem liberar os gatilhos via set_config.
const extrair = nome => estoque.slice(estoque.indexOf(`create or replace function public.${nome}(`), estoque.indexOf('\n$$;', estoque.indexOf(`create or replace function public.${nome}(`)) + 4);
const liberar = sql => sql.replace('begin\n', `begin
 if exists(select 1 from public.compra_edicao_contexto where transacao=txid_current() and pedido_id=case when TG_OP='DELETE' then OLD.${sql.includes('declare integrado') ? 'pedido_compra_id' : 'id'} else NEW.${sql.includes('declare integrado') ? 'pedido_compra_id' : 'id'} end) then
   if TG_OP='DELETE' then return OLD; end if;
   return NEW;
 end if;
`);
const integrar = liberar(extrair('integrar_compra_materiais'))
 .replace("and tipo='compra' group by", "and tipo in ('compra','estorno_compra') group by")
 .replace('order by materia_prima_id loop\n     perform 1 from public.materias_primas where id=r.materia_prima_id for update;', 'having sum(quantidade)>0 order by materia_prima_id loop\n     perform 1 from public.materias_primas where id=r.materia_prima_id for update;')
 .replace("'Compra já consumida. Concilie o estoque antes de cancelar'", "'Não há saldo suficiente para retirar toda a entrada desta compra. Corrija o consumo ou reponha o saldo antes de cancelar'")
 .replace("'Cancelamento da compra',r.custo)", "'Cancelamento da compra',(select custo_medio from public.materias_primas where id=r.materia_prima_id))");
export const migrationSql = `begin;
create table if not exists public.compra_edicao_contexto(transacao bigint, pedido_id uuid, primary key(transacao,pedido_id));
alter table public.compra_edicao_contexto enable row level security;
revoke all on public.compra_edicao_contexto from public,anon,authenticated;
create table if not exists public.compras_auditoria (
 id uuid primary key default gen_random_uuid(), pedido_id uuid not null,
 operacao text not null check(operacao in ('edicao','exclusao')),
 antes jsonb not null, depois jsonb, criado_por uuid not null default auth.uid(), criado_em timestamptz not null default now()
);
alter table public.compras_auditoria enable row level security;
drop policy if exists compras_auditoria_leitura on public.compras_auditoria;
create policy compras_auditoria_leitura on public.compras_auditoria for select to authenticated using(public.estoque_autorizado());
revoke all on public.compras_auditoria from public,anon,authenticated;
grant select on public.compras_auditoria to authenticated;
${integrar}
${liberar(extrair('proteger_itens_compra_estoque'))}
create or replace function public.editar_compra_materiais(p_id uuid,p_fornecedor uuid,p_data date,p_status text,p_valor numeric,p_observacao text,p_itens jsonb,p_versao timestamptz)
returns public.pedidos_compra language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_compra; resultado public.pedidos_compra; r record; saldo numeric;
 historico boolean; itens_antes jsonb; diferenca numeric; media numeric; corrigida numeric; remanescente numeric;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into pedido from public.pedidos_compra where id=p_id for update;
 if not found then raise exception 'Compra não encontrada'; end if;
 if pedido.atualizado_em is distinct from p_versao then raise exception 'Esta compra foi alterada por outra pessoa. Reabra o pedido antes de editar'; end if;
 if p_status='recebido' and p_data>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Recebimento não pode ter data futura'; end if;
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into itens_antes from public.pedido_compra_itens i where pedido_compra_id=p_id;
 historico:=pedido.estoque_integrado and not exists(select 1 from public.movimentos_estoque where referencia_id=p_id and tipo in ('compra','estorno_compra'));
 -- Trava os materiais anteriores e novos em ordem, antes de qualquer movimento.
 perform 1 from public.materias_primas where id in (
   select materia_prima_id from public.movimentos_estoque where referencia_id=p_id
   union select (value->>'materia_prima_id')::uuid from jsonb_array_elements(p_itens)
 ) order by id for update;
 insert into public.compra_edicao_contexto values(txid_current(),p_id);
 update public.pedidos_compra set estoque_integrado=false,status='pendente' where id=p_id;
 -- Validação e gravação atômicas pelo RPC original, sem relançar o recebimento.
 resultado:=public.salvar_compra_materiais(p_id,p_fornecedor,p_data,p_status,p_valor,p_observacao,p_itens);
 if not historico then
   for r in
     with anteriores as (
       select materia_prima_id,sum(quantidade) qtd from public.movimentos_estoque
       where referencia_id=p_id and tipo in ('compra','estorno_compra') group by materia_prima_id
     ), custos_antes as (
       select (i->>'materia_prima_id')::uuid material,
         sum((i->>'quantidade')::numeric*(i->>'valor_unitario')::numeric)/nullif(sum((i->>'quantidade')::numeric),0) custo
       from jsonb_array_elements(itens_antes) i group by (i->>'materia_prima_id')::uuid
     ), novos as (
       select materia_prima_id,sum(quantidade) qtd,sum(quantidade*valor_unitario)/sum(quantidade) custo
       from public.pedido_compra_itens where pedido_compra_id=p_id and p_status='recebido' group by materia_prima_id
     )
     select coalesce(a.materia_prima_id,n.materia_prima_id) material,coalesce(a.qtd,0) antiga,coalesce(n.qtd,0) nova,c.custo custo_antigo,n.custo custo_novo
     from anteriores a full join novos n on n.materia_prima_id=a.materia_prima_id
     left join custos_antes c on c.material=coalesce(a.materia_prima_id,n.materia_prima_id)
     order by coalesce(a.materia_prima_id,n.materia_prima_id)
   loop
     saldo:=public.saldo_material(r.material); diferenca:=r.nova-r.antiga;
     if saldo+diferenca<0 then
       raise exception 'A alteração retiraria % unidades de %, mas o saldo disponível é %. Ajuste a quantidade para preservar o material já consumido', -diferenca,(select nome from public.materias_primas where id=r.material),saldo;
     end if;
     -- Reduções usam a média atual: não retiram novamente o que já foi consumido.
     if diferenca<0 then
       select custo_medio into media from public.materias_primas where id=r.material;
       insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
       values(r.material,diferenca,saldo+diferenca,'estorno_compra',p_id,(now() at time zone 'America/Sao_Paulo')::date,'Redução da quantidade na edição da compra',media);
       saldo:=saldo+diferenca;
     end if;
     -- O custeio é por média, não por lote. Reavalia somente a parcela remanescente,
     -- marcada como estimada; custos já congelados nas vendas permanecem intactos.
     if r.antiga>0 and r.nova>0 and r.custo_novo is distinct from r.custo_antigo then
       select custo_medio into media from public.materias_primas where id=r.material;
       remanescente:=least(saldo,r.antiga,r.nova);
       if saldo=0 or remanescente=saldo then corrigida:=r.custo_novo;
       elsif media is not null then corrigida:=((saldo-remanescente)*media+remanescente*r.custo_novo)/saldo;
       else corrigida:=null; end if;
       if corrigida is not null and corrigida is distinct from media then
         insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
         values(r.material,0,saldo,'ajuste_custo',p_id,(now() at time zone 'America/Sao_Paulo')::date,'Correção de preço da compra: custo estimado do saldo remanescente; CMV anterior preservado',corrigida);
       end if;
     end if;
     if diferenca>0 then
       insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
       values(r.material,diferenca,saldo+diferenca,'compra',p_id,p_data,'Acréscimo da quantidade na edição da compra',r.custo_novo);
     end if;
   end loop;
 end if;
 update public.pedidos_compra set estoque_integrado=pedido.estoque_integrado or p_status='recebido' where id=p_id returning * into resultado;
 insert into public.compras_auditoria(pedido_id,operacao,antes,depois)
 values(p_id,'edicao',jsonb_build_object('pedido',to_jsonb(pedido),'itens',itens_antes),jsonb_build_object('pedido',to_jsonb(resultado),'itens',p_itens));
 delete from public.compra_edicao_contexto where transacao=txid_current() and pedido_id=p_id;
 return resultado;
end;
$$;
revoke all on function public.editar_compra_materiais(uuid,uuid,date,text,numeric,text,jsonb,timestamptz) from public,anon;
grant execute on function public.editar_compra_materiais(uuid,uuid,date,text,numeric,text,jsonb,timestamptz) to authenticated;
create or replace function public.excluir_compra_materiais(p_id uuid,p_versao timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_compra; itens jsonb; r record; saldo numeric; media numeric;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into pedido from public.pedidos_compra where id=p_id for update;
 if not found then return jsonb_build_object('excluido',true); end if;
 if pedido.atualizado_em is distinct from p_versao then raise exception 'Esta compra foi alterada por outra pessoa. Reabra o pedido antes de excluir'; end if;
 select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into itens from public.pedido_compra_itens i where pedido_compra_id=p_id;
 perform 1 from public.materias_primas where id in (select materia_prima_id from public.movimentos_estoque where referencia_id=p_id) order by id for update;
 for r in select materia_prima_id,sum(quantidade) qtd from public.movimentos_estoque
   where referencia_id=p_id and tipo in ('compra','estorno_compra') group by materia_prima_id having sum(quantidade)>0 order by materia_prima_id loop
   saldo:=public.saldo_material(r.materia_prima_id);
   if saldo<r.qtd then raise exception 'Não é possível excluir: a compra representa % unidades de %, mas o saldo é %. Corrija os consumos vinculados ou ajuste o estoque antes de excluir',r.qtd,(select nome from public.materias_primas where id=r.materia_prima_id),saldo; end if;
   select custo_medio into media from public.materias_primas where id=r.materia_prima_id;
   insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
   values(r.materia_prima_id,-r.qtd,saldo-r.qtd,'estorno_compra',p_id,(now() at time zone 'America/Sao_Paulo')::date,'Exclusão de compra lançada incorretamente',media);
 end loop;
 insert into public.compras_auditoria(pedido_id,operacao,antes) values(p_id,'exclusao',jsonb_build_object('pedido',to_jsonb(pedido),'itens',itens));
 insert into public.compra_edicao_contexto values(txid_current(),p_id);
 delete from public.pedido_compra_itens where pedido_compra_id=p_id;
 delete from public.pedidos_compra where id=p_id;
 delete from public.compra_edicao_contexto where transacao=txid_current() and pedido_id=p_id;
 return jsonb_build_object('excluido',true);
end;
$$;
revoke all on function public.excluir_compra_materiais(uuid,timestamptz) from public,anon;
grant execute on function public.excluir_compra_materiais(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
`;
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const p=resolve('supabase/local/editar-compras.sql'); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p,migrationSql); console.log('Gerado: '+p);
}
