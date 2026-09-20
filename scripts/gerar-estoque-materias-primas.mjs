import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estruturaCustosSql, funcoesCustosSql, apurarCmvSql } from './custeio-materiais-sql.mjs';
import { migrationSql as cmv } from './gerar-cmv-ecommerce.mjs';

// Preserva snapshots históricos e apura novas vendas pela composição e custo dos materiais.
const inicio = cmv.indexOf('create or replace function public.cmv_movimentar_venda()');
const fim = cmv.indexOf("notify pgrst", inicio);
const vendaSql = cmv.slice(inicio, fim)
  .replace("NEW.cmv_total:=OLD.cmv_total;", "NEW.materia_prima_consumo:=OLD.materia_prima_consumo; NEW.cmv_total:=OLD.cmv_total;")
  .replace("if TG_OP='DELETE' then", "if TG_OP='DELETE' then\n   perform 1 from public.produtos where id in (select (value->>'produto_id')::uuid from jsonb_array_elements(OLD.cmv_componentes)) order by id for update;\n   perform public.estornar_materiais_venda(OLD.id,OLD.materia_prima_consumo,OLD.data);")
  .replace("select * into p from public.produtos where id=(item->>'produto_id')::uuid for update;", "if item->>'estoque_origem'='materia_prima' then continue; end if;\n     select * into p from public.produtos where id=(item->>'produto_id')::uuid for update;")
  .replace("if not found or qtd is null", "if not found or not p.ativo or qtd is null")
  .replace("or p.estoque_atual<qtd then", "or (not exists(select 1 from public.componentes_produto c where c.produto_id=p.id) and p.estoque_atual<qtd) then")
  .replace("'estimado',p.custo_medio_estimado));", "'estimado',p.custo_medio_estimado or exists(select 1 from public.componentes_produto c where c.produto_id=p.id),'estoque_origem',case when exists(select 1 from public.componentes_produto c where c.produto_id=p.id) then 'materia_prima' else 'produto' end));")
  .replace('NEW.cmv_componentes:=componentes;', 'NEW.cmv_componentes:=componentes;\n NEW.materia_prima_consumo:=public.consumir_materiais_venda(NEW.id,componentes,NEW.data);\n NEW.cmv_componentes:=public.apurar_cmv_materiais(componentes,NEW.materia_prima_consumo);')
  .replace("unitario is null or unitario<=0", "unitario is null or unitario<0")
  .replace("update public.produtos set estoque_atual=estoque_atual-qtd where id=(item->>'produto_id')::uuid;", "if item->>'estoque_origem' is distinct from 'materia_prima' then\n     update public.produtos set estoque_atual=estoque_atual-qtd where id=(item->>'produto_id')::uuid;\n   end if;");

export const migrationSql = `begin;
-- Requer cmv-ecommerce.sql e unificar-compras-cmv.sql. Pausar lançamentos na aplicação.
lock table public.produtos,public.vendas,public.materias_primas,public.pedidos_compra,public.pedido_compra_itens in share row exclusive mode;
alter table public.materias_primas add column if not exists influencia_saldo boolean not null default true;
alter table public.vendas add column if not exists materia_prima_consumo jsonb;
-- Pedidos anteriores são históricos: não entram novamente no saldo.
alter table public.pedidos_compra add column if not exists estoque_integrado boolean not null default true;
alter table public.pedidos_compra alter column estoque_integrado set default false;
alter table public.pedidos_compra add column if not exists estoque_payload jsonb;
alter table public.pedido_compra_itens add column if not exists materia_prima_id uuid references public.materias_primas(id);

create or replace function public.estoque_autorizado() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.usuarios_empresa where usuario_id=auth.uid() and papel in ('admin','socio'));
$$;
revoke all on function public.estoque_autorizado() from public,anon;
grant execute on function public.estoque_autorizado() to authenticated;

create table if not exists public.movimentos_estoque (
 id uuid primary key default gen_random_uuid(),
 materia_prima_id uuid references public.materias_primas(id), produto_id uuid references public.produtos(id),
 quantidade numeric not null check (quantidade <> 0 and abs(quantidade)<=1000000000),
 saldo_apos numeric not null check(saldo_apos>=0),
 tipo text not null check(tipo in ('entrada','saida','ajuste','compra','estorno_compra','venda','estorno_venda')),
 referencia_id uuid, motivo text not null check(length(trim(motivo)) between 1 and 2000),
 data date not null, criado_em timestamptz not null default now(), criado_por uuid not null default auth.uid(),
 check ((materia_prima_id is null) <> (produto_id is null))
);
create index if not exists movimentos_estoque_mp on public.movimentos_estoque(materia_prima_id);
create index if not exists movimentos_estoque_ref on public.movimentos_estoque(referencia_id,tipo);
alter table public.movimentos_estoque enable row level security;
drop policy if exists movimentos_leitura on public.movimentos_estoque;
create policy movimentos_leitura on public.movimentos_estoque for select to authenticated using(public.estoque_autorizado());
revoke all on public.movimentos_estoque from anon,authenticated;
grant select on public.movimentos_estoque to authenticated;
${estruturaCustosSql}
create or replace view public.saldos_materias_primas with (security_invoker=true) as
 select m.id,m.codigo,m.nome,m.unidade,m.ativo,m.influencia_saldo,
 coalesce(sum(e.quantidade),0) as saldo,
 coalesce(sum(e.quantidade) filter(where e.quantidade>0),0) as entradas,
 -coalesce(sum(e.quantidade) filter(where e.quantidade<0),0) as saidas,
 m.custo_medio,m.custo_medio_estimado
 from public.materias_primas m left join public.movimentos_estoque e on e.materia_prima_id=m.id
 group by m.id;
grant select on public.saldos_materias_primas to authenticated;

create or replace function public.saldo_material(p_id uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce(sum(quantidade),0) from public.movimentos_estoque where materia_prima_id=p_id;
$$;
revoke all on function public.saldo_material(uuid) from public,anon,authenticated;

${funcoesCustosSql}
${apurarCmvSql}
drop function if exists public.movimentar_estoque(uuid,uuid,uuid,text,numeric,date,text,numeric);
create or replace function public.movimentar_estoque(p_id uuid,p_material uuid,p_produto uuid,p_tipo text,p_quantidade numeric,p_data date,p_motivo text,p_saldo_esperado numeric default null,p_custo_unitario numeric default null)
returns public.movimentos_estoque language plpgsql security definer set search_path='' as $$
declare saldo numeric; delta numeric; mov public.movimentos_estoque;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 if p_custo_unitario is not null and (p_material is null or p_tipo='saida' or p_custo_unitario<0 or p_custo_unitario>1000000000) then raise exception 'Custo válido somente na entrada de matéria-prima'; end if;
 if p_id is null or (p_material is null)=(p_produto is null) or p_tipo is null or p_tipo not in ('entrada','saida','ajuste') or p_quantidade is null or p_quantidade<0 or p_quantidade>100000000 or p_data is null or p_data>(now() at time zone 'America/Sao_Paulo')::date or length(trim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'Informe item, quantidade, data e motivo válidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into mov from public.movimentos_estoque where id=p_id;
 if found then
   if mov.materia_prima_id is distinct from p_material or mov.produto_id is distinct from p_produto or mov.custo_informado is distinct from p_custo_unitario or mov.tipo<>p_tipo or mov.data<>p_data or mov.motivo<>trim(p_motivo) or mov.criado_por<>auth.uid() or (p_tipo='ajuste' and mov.saldo_apos<>p_quantidade) or (p_tipo<>'ajuste' and abs(mov.quantidade)<>p_quantidade) then raise exception 'Chave utilizada em outra movimentação'; end if;
   return mov;
 end if;
 if p_material is not null then
   perform 1 from public.materias_primas where id=p_material and ativo for update;
   if not found then raise exception 'Matéria-prima inexistente ou inativa'; end if;
   saldo:=public.saldo_material(p_material);
 else
   select estoque_atual into saldo from public.produtos where id=p_produto and ativo for update;
   if not found then raise exception 'Produto inexistente ou inativo'; end if;
   if exists(select 1 from public.componentes_produto where produto_id=p_produto) then raise exception 'Este produto usa matéria-prima. Ajuste seus componentes'; end if;
 end if;
 if p_tipo='ajuste' and (p_saldo_esperado is null or saldo<>p_saldo_esperado) then raise exception 'O saldo mudou. Atualize a tela antes de ajustar'; end if;
 delta:=case p_tipo when 'ajuste' then p_quantidade-saldo when 'saida' then -p_quantidade else p_quantidade end;
 if p_custo_unitario is not null and delta<=0 then raise exception 'Custo de entrada requer aumento de saldo. Para corrigir a média, use ajuste de custo'; end if;
 if delta=0 or saldo+delta<0 then raise exception 'Movimentação sem alteração ou saldo insuficiente'; end if;
 if p_produto is not null then update public.produtos set estoque_atual=saldo+delta,custo_medio_estimado=true where id=p_produto; end if;
 insert into public.movimentos_estoque(id,materia_prima_id,produto_id,quantidade,saldo_apos,tipo,data,motivo,custo_informado)
 values(p_id,p_material,p_produto,delta,saldo+delta,p_tipo,p_data,trim(p_motivo),p_custo_unitario) returning * into mov;
 return mov;
end;
$$;
revoke all on function public.movimentar_estoque(uuid,uuid,uuid,text,numeric,date,text,numeric,numeric) from public,anon;
grant execute on function public.movimentar_estoque(uuid,uuid,uuid,text,numeric,date,text,numeric,numeric) to authenticated;

create or replace function public.consumir_materiais_venda(p_venda uuid,p_componentes jsonb,p_data date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; saldo numeric; baixar numeric; snapshot jsonb:='[]';
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 -- Composição incompleta nunca produz uma disponibilidade fictícia.
 if exists(select 1 from jsonb_array_elements(p_componentes) p join public.componentes_produto c on c.produto_id=(p->>'produto_id')::uuid where c.materia_prima_id is null or c.quantidade is null or c.quantidade<=0) then raise exception 'Vincule todos os componentes a matérias-primas e informe quantidades positivas'; end if;
 if exists(select 1 from jsonb_array_elements(p_componentes) p where p->>'estoque_origem'='materia_prima' and not exists(select 1 from public.componentes_produto c join public.materias_primas m on m.id=c.materia_prima_id where c.produto_id=(p->>'produto_id')::uuid and m.influencia_saldo)) then raise exception 'Produto precisa de pelo menos uma matéria-prima que influencia o saldo'; end if;
 for r in select m.id,m.nome,m.ativo,m.influencia_saldo,m.custo_medio,m.custo_medio_estimado,sum(c.quantidade*(p->>'quantidade')::numeric) as necessario
   from jsonb_array_elements(p_componentes) p join public.componentes_produto c on c.produto_id=(p->>'produto_id')::uuid join public.materias_primas m on m.id=c.materia_prima_id
   group by m.id order by m.id loop
   perform 1 from public.materias_primas where id=r.id for update;
   -- Relê configuração e saldo depois do lock.
   select ativo,influencia_saldo,custo_medio,custo_medio_estimado into r.ativo,r.influencia_saldo,r.custo_medio,r.custo_medio_estimado from public.materias_primas where id=r.id;
   saldo:=public.saldo_material(r.id);
   if r.influencia_saldo and (not r.ativo or saldo<r.necessario) then raise exception 'Matéria-prima insuficiente ou inativa: %',r.nome; end if;
   baixar:=case when r.ativo then least(saldo,r.necessario) else 0 end;
   if baixar>0 then
     insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo)
     values(r.id,-baixar,saldo-baixar,'venda',p_venda,p_data,'Consumo na venda');
   end if;
   snapshot:=snapshot || jsonb_build_array(jsonb_build_object('materia_prima_id',r.id,'nome',r.nome,'quantidade',baixar,'necessario',r.necessario,'faltante',r.necessario-baixar,'custo_unitario',r.custo_medio,'custo_estimado',r.custo_medio_estimado));
 end loop;
 return snapshot;
end;
$$;
revoke all on function public.consumir_materiais_venda(uuid,jsonb,date) from public,anon,authenticated;

create or replace function public.estornar_materiais_venda(p_venda uuid,p_snapshot jsonb,p_data date)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; saldo numeric; qtd numeric;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 for item in select value from jsonb_array_elements(coalesce(p_snapshot,'[]')) order by value->>'materia_prima_id' loop
   qtd:=(item->>'quantidade')::numeric;
   if qtd<=0 then continue; end if;
   perform 1 from public.materias_primas where id=(item->>'materia_prima_id')::uuid for update;
   if not found then raise exception 'Matéria-prima indisponível para estorno'; end if;
   saldo:=public.saldo_material((item->>'materia_prima_id')::uuid);
   insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado,custo_origem_estimado)
   values((item->>'materia_prima_id')::uuid,qtd,saldo+qtd,'estorno_venda',p_venda,(now() at time zone 'America/Sao_Paulo')::date,'Estorno da venda de ' || p_data::text,(item->>'custo_unitario')::numeric,coalesce((item->>'custo_estimado')::boolean,true));
 end loop;
end;
$$;
revoke all on function public.estornar_materiais_venda(uuid,jsonb,date) from public,anon,authenticated;
${vendaSql}

-- Edição de composição e venda compartilham o lock do produto.
create or replace function public.travar_composicao_estoque() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then perform 1 from public.produtos where id=NEW.produto_id for update;
 elsif TG_OP='DELETE' then perform 1 from public.produtos where id=OLD.produto_id for update;
 else perform 1 from public.produtos where id in (OLD.produto_id,NEW.produto_id) order by id for update; end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.quantidade is null or NEW.quantidade<=0 or NEW.quantidade>100000000 then raise exception 'Quantidade do componente inválida'; end if;
 return NEW;
end;
$$;
revoke all on function public.travar_composicao_estoque() from public,anon,authenticated;
drop trigger if exists travar_composicao_estoque on public.componentes_produto;
create trigger travar_composicao_estoque before insert or update or delete on public.componentes_produto for each row execute function public.travar_composicao_estoque();

-- O novo fluxo de compras recebe exclusivamente matérias-primas.
-- Mantém as funções antigas para o histórico, sem permitir novas chamadas pelo aplicativo.
revoke execute on function public.registrar_compra_produto(uuid,uuid,numeric,numeric,jsonb,text) from public,anon,authenticated;
revoke execute on function public.registrar_reposicao_produto(uuid,uuid,numeric,numeric,text) from public,anon,authenticated;

-- Produtos compostos são abastecidos pela compra dos seus materiais.
create or replace function public.proteger_reposicao_composta() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.componentes_produto where produto_id=NEW.produto_id) then raise exception 'Produto composto: receba as matérias-primas em Compras / Pedidos de compra'; end if;
 return NEW;
end;
$$;
drop trigger if exists proteger_reposicao_composta on public.reposicoes_produtos;
create trigger proteger_reposicao_composta before insert on public.reposicoes_produtos for each row execute function public.proteger_reposicao_composta();

-- Recebimento de compras acontece só depois de salvar todos os itens, na mesma transação.
create or replace function public.integrar_compra_materiais() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; saldo numeric;
begin
 if TG_OP='INSERT' then
   if NEW.status='recebido' or NEW.estoque_integrado then raise exception 'Cadastre como pendente e receba depois de salvar os itens'; end if;
   return NEW;
 end if;
 if TG_OP='DELETE' then
   if OLD.estoque_integrado then raise exception 'Pedido integrado/histórico: mantenha o documento e use cancelamento ou ajuste'; end if;
   return OLD;
 end if;
 if NEW.estoque_integrado is distinct from OLD.estoque_integrado then raise exception 'Integração controlada automaticamente'; end if;
 if OLD.estoque_integrado then
   if NEW.estoque_payload is distinct from OLD.estoque_payload or NEW.data is distinct from OLD.data or NEW.valor_total is distinct from OLD.valor_total or NEW.fornecedor_id is distinct from OLD.fornecedor_id then raise exception 'Pedido integrado/histórico não permite alterar data, fornecedor ou valor'; end if;
   if NEW.status is distinct from OLD.status and not (OLD.status='recebido' and NEW.status='cancelado') then raise exception 'Pedido integrado: somente cancelamento é permitido'; end if;
 end if;
 if NEW.status='recebido' and OLD.status is distinct from 'recebido' then
   if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
   if NEW.data>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Recebimento não pode ter data futura'; end if;
   if not exists(select 1 from public.pedido_compra_itens where pedido_compra_id=NEW.id) then raise exception 'Adicione itens antes de receber a compra'; end if;
   if exists(select 1 from public.pedido_compra_itens where pedido_compra_id=NEW.id and materia_prima_id is null) then raise exception 'Vincule cada item da compra a uma matéria-prima antes de receber'; end if;
   if exists(select 1 from public.pedido_compra_itens where pedido_compra_id=NEW.id and (quantidade is null or quantidade<=0 or valor_unitario is null or valor_unitario<0 or valor_unitario>1000000000)) then raise exception 'Quantidade inválida'; end if;
   for r in select materia_prima_id,sum(quantidade) as qtd,sum(quantidade*valor_unitario)/sum(quantidade) as custo from public.pedido_compra_itens where pedido_compra_id=NEW.id and materia_prima_id is not null group by materia_prima_id order by materia_prima_id loop
     perform 1 from public.materias_primas where id=r.materia_prima_id and ativo for update;
     if not found then raise exception 'Matéria-prima inexistente ou inativa'; end if;
     saldo:=public.saldo_material(r.materia_prima_id);
     insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
     values(r.materia_prima_id,r.qtd,saldo+r.qtd,'compra',NEW.id,NEW.data,'Recebimento de compra',r.custo);
   end loop;
   NEW.estoque_integrado:=true;
 elsif OLD.status='recebido' and NEW.status='cancelado' then
   if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
   for r in select materia_prima_id,sum(quantidade) as qtd,case when count(*) filter(where custo_unitario is null)>0 then null else sum(quantidade*custo_unitario)/sum(quantidade) end as custo from public.movimentos_estoque where referencia_id=OLD.id and tipo='compra' group by materia_prima_id order by materia_prima_id loop
     perform 1 from public.materias_primas where id=r.materia_prima_id for update;
     saldo:=public.saldo_material(r.materia_prima_id);
     if saldo<r.qtd then raise exception 'Compra já consumida. Concilie o estoque antes de cancelar'; end if;
     insert into public.movimentos_estoque(materia_prima_id,quantidade,saldo_apos,tipo,referencia_id,data,motivo,custo_informado)
     values(r.materia_prima_id,-r.qtd,saldo-r.qtd,'estorno_compra',OLD.id,(now() at time zone 'America/Sao_Paulo')::date,'Cancelamento da compra',r.custo);
   end loop;
 end if;
 return NEW;
end;
$$;
revoke all on function public.integrar_compra_materiais() from public,anon,authenticated;
drop trigger if exists integrar_compra_materiais on public.pedidos_compra;
create trigger integrar_compra_materiais before insert or update or delete on public.pedidos_compra for each row execute function public.integrar_compra_materiais();

create or replace function public.proteger_itens_compra_estoque() returns trigger language plpgsql security definer set search_path='' as $$
declare integrado boolean;
begin
 if TG_OP<>'INSERT' then
   select estoque_integrado into integrado from public.pedidos_compra where id=OLD.pedido_compra_id for update;
   if integrado then raise exception 'Itens de pedido integrado/histórico não podem ser alterados'; end if;
 end if;
 if TG_OP<>'DELETE' then
   select estoque_integrado into integrado from public.pedidos_compra where id=NEW.pedido_compra_id for update;
   if integrado then raise exception 'Itens de pedido integrado/histórico não podem ser alterados'; end if;
   return NEW;
 end if;
 return OLD;
end;
$$;
revoke all on function public.proteger_itens_compra_estoque() from public,anon,authenticated;
drop trigger if exists proteger_itens_compra_estoque on public.pedido_compra_itens;
create trigger proteger_itens_compra_estoque before insert or update or delete on public.pedido_compra_itens for each row execute function public.proteger_itens_compra_estoque();

create or replace function public.salvar_compra_materiais(p_id uuid,p_fornecedor uuid,p_data date,p_status text,p_valor numeric,p_observacao text,p_itens jsonb)
returns public.pedidos_compra language plpgsql security definer set search_path='' as $$
declare pedido public.pedidos_compra; item jsonb; total numeric:=0; payload jsonb;
begin
 if not public.estoque_autorizado() then raise exception 'Usuário sem permissão'; end if;
 if p_id is null or p_fornecedor is null or p_data is null or p_status is null or p_status not in ('pendente','recebido','cancelado') or p_valor is null or p_valor<0 or p_valor>1000000000 or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) not between 1 and 200 or length(coalesce(p_observacao,''))>2000 then raise exception 'Dados da compra inválidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into pedido from public.pedidos_compra where id=p_id for update;
 payload:=jsonb_build_object('fornecedor',p_fornecedor,'data',p_data,'status',p_status,'valor',p_valor,'observacao',coalesce(p_observacao,''),'itens',p_itens);
 if found and pedido.estoque_integrado then
   if pedido.estoque_payload=payload and pedido.status=p_status and pedido.criado_por=auth.uid() then return pedido; end if;
   raise exception 'Pedido já integrado. Atualize a lista; não relance o recebimento';
 end if;
 for item in select value from jsonb_array_elements(p_itens) loop
   if nullif(item->>'materia_prima_id','') is null or not exists(select 1 from public.materias_primas where id=(item->>'materia_prima_id')::uuid and ativo) then raise exception 'Selecione uma matéria-prima ativa em cada item da compra'; end if;
   if length(trim(coalesce(item->>'descricao',''))) not between 1 and 1000 or coalesce((item->>'quantidade')::numeric,0)<=0 or (item->>'quantidade')::numeric>100000000 or (item->>'valor_unitario')::numeric is null or (item->>'valor_unitario')::numeric<0 or (item->>'valor_unitario')::numeric>1000000000 then raise exception 'Item sem descrição, quantidade ou valor válido'; end if;
   total:=total+(item->>'quantidade')::numeric*(item->>'valor_unitario')::numeric;
 end loop;
 if jsonb_array_length(p_itens)>0 and round(total,2)<>round(p_valor,2) then raise exception 'Total não corresponde aos itens'; end if;
 insert into public.pedidos_compra(id,criado_por,fornecedor_id,data,status,valor_total,observacao)
 values(p_id,auth.uid(),p_fornecedor,p_data,'pendente',p_valor,coalesce(p_observacao,''))
 on conflict(id) do update set fornecedor_id=excluded.fornecedor_id,data=excluded.data,status='pendente',valor_total=excluded.valor_total,observacao=excluded.observacao,atualizado_por=auth.uid(),atualizado_em=now();
 delete from public.pedido_compra_itens where pedido_compra_id=p_id;
 for item in select value from jsonb_array_elements(p_itens) loop
   insert into public.pedido_compra_itens(pedido_compra_id,materia_prima_id,descricao,quantidade,valor_unitario,valor_total)
   values(p_id,nullif(item->>'materia_prima_id','')::uuid,item->>'descricao',(item->>'quantidade')::numeric,(item->>'valor_unitario')::numeric,(item->>'quantidade')::numeric*(item->>'valor_unitario')::numeric);
 end loop;
 update public.pedidos_compra set status=p_status,estoque_payload=payload where id=p_id returning * into pedido;
 return pedido;
end;
$$;
revoke all on function public.salvar_compra_materiais(uuid,uuid,date,text,numeric,text,jsonb) from public,anon;
grant execute on function public.salvar_compra_materiais(uuid,uuid,date,text,numeric,text,jsonb) to authenticated;

create table if not exists public.atividades_kanban (
 id uuid primary key default gen_random_uuid(), titulo text not null check(length(trim(titulo)) between 1 and 200),
 descricao text not null default '' check(length(descricao)<=4000),
 status text not null default 'pendente' check(status in ('pendente','andamento','concluida')),
 responsavel text not null default '' check(length(responsavel)<=150), prazo date,
 criado_por uuid not null default auth.uid(), criado_em timestamptz not null default now(),
 atualizado_por uuid not null default auth.uid(), atualizado_em timestamptz not null default now()
);
alter table public.atividades_kanban enable row level security;
drop policy if exists atividades_equipe on public.atividades_kanban;
create policy atividades_equipe on public.atividades_kanban to authenticated using(public.estoque_autorizado()) with check(public.estoque_autorizado());
revoke all on public.atividades_kanban from anon,authenticated;
grant select,insert,update,delete on public.atividades_kanban to authenticated;
create or replace function public.auditar_atividade() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then NEW.criado_por:=auth.uid(); NEW.criado_em:=now();
 else NEW.criado_por:=OLD.criado_por; NEW.criado_em:=OLD.criado_em; end if;
 NEW.atualizado_por:=auth.uid(); NEW.atualizado_em:=now(); return NEW;
end;
$$;
drop trigger if exists auditar_atividade on public.atividades_kanban;
create trigger auditar_atividade before insert or update on public.atividades_kanban for each row execute function public.auditar_atividade();
notify pgrst,'reload schema';
commit;
`;
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const path=resolve(dirname(fileURLToPath(import.meta.url)),'../supabase/local/estoque-materias-primas.sql');
 mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,migrationSql); console.log(path);
}
