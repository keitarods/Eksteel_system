import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const migrationSql = `begin;
alter table public.atividades_kanban add column if not exists checklists jsonb not null default '[]'::jsonb;
create or replace function public.validar_checklists_kanban() returns trigger
language plpgsql set search_path='' as $$
declare lista jsonb; item jsonb; ids text[]:='{}'; itens_ids text[];
begin
 if TG_OP='UPDATE' and NEW.checklists is not distinct from OLD.checklists then return NEW; end if;
 if jsonb_typeof(NEW.checklists) is distinct from 'array' then raise exception 'Checklists inválidos'; end if;
 if jsonb_array_length(NEW.checklists)>20 then raise exception 'Use até 20 checklists por atividade'; end if;
 for lista in select value from jsonb_array_elements(NEW.checklists) loop
   if jsonb_typeof(lista) is distinct from 'object' or jsonb_typeof(lista->'id') is distinct from 'string'
     or length(coalesce(lista->>'id','')) not between 1 and 100 or (lista->>'id')=any(ids)
     or jsonb_typeof(lista->'titulo') is distinct from 'string' or length(trim(coalesce(lista->>'titulo',''))) not between 1 and 100
     or jsonb_typeof(lista->'itens') is distinct from 'array' then raise exception 'Checklist sem título, identificação ou itens válidos'; end if;
   ids:=array_append(ids,lista->>'id'); itens_ids:='{}';
   if jsonb_array_length(lista->'itens')>100 then raise exception 'Use até 100 itens por checklist'; end if;
   for item in select value from jsonb_array_elements(lista->'itens') loop
     if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string'
       or length(coalesce(item->>'id','')) not between 1 and 100 or (item->>'id')=any(itens_ids)
       or jsonb_typeof(item->'texto') is distinct from 'string' or length(trim(coalesce(item->>'texto',''))) not between 1 and 500
       or jsonb_typeof(item->'concluido') is distinct from 'boolean' then raise exception 'Item de checklist inválido'; end if;
     itens_ids:=array_append(itens_ids,item->>'id');
   end loop;
 end loop;
 return NEW;
end;
$$;
revoke all on function public.validar_checklists_kanban() from public,anon,authenticated;
drop trigger if exists validar_checklists_kanban on public.atividades_kanban;
create trigger validar_checklists_kanban before insert or update on public.atividades_kanban for each row execute function public.validar_checklists_kanban();
notify pgrst,'reload schema';
commit;
`;
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const p=resolve('supabase/local/checklists-kanban.sql'); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p,migrationSql); console.log('Gerado: '+p);
}
