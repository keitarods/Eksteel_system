import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const migrationSql = `begin;
alter table public.atividades_kanban add column if not exists participantes uuid[];
-- NULL mantém a leitura do responsável legado; a interface converte ao salvar.

create or replace function public.validar_participantes_kanban() returns trigger
language plpgsql set search_path='' as $$
begin
 if NEW.participantes is null then return NEW; end if;
 if TG_OP='UPDATE' and NEW.participantes is not distinct from OLD.participantes then return NEW; end if;
 if exists(select 1 from unnest(NEW.participantes) p(id) where p.id is null or not exists(select 1 from public.usuarios_empresa u where u.usuario_id=p.id)) then
   raise exception 'Selecione somente usuários cadastrados como participantes';
 end if;
 NEW.participantes:=array(select distinct id from unnest(NEW.participantes) p(id) order by id);
 return NEW;
end;
$$;
revoke all on function public.validar_participantes_kanban() from public,anon,authenticated;
drop trigger if exists validar_participantes_kanban on public.atividades_kanban;
create trigger validar_participantes_kanban before insert or update on public.atividades_kanban for each row execute function public.validar_participantes_kanban();
notify pgrst,'reload schema';
commit;
`;
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const p=resolve('supabase/local/participantes-kanban.sql'); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p,migrationSql); console.log('Gerado: '+p);
}
