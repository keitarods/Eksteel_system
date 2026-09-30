import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { migrationSql } from './gerar-participantes-kanban.mjs';
const container=`eksteel-participantes-${randomUUID()}`;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input);
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
try {
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 sql(`create role anon; create role authenticated;
 create table public.usuarios_empresa(usuario_id uuid primary key,nome text,email text);
 create table public.atividades_kanban(id integer primary key,responsavel text not null default '',titulo text);
 insert into public.usuarios_empresa values('${id(1)}','Matheus','matheus@example.test'),('${id(2)}','Enyo','enyo@example.test');
 insert into public.atividades_kanban values(1,'Matheus','Legado'),(2,'Desconhecido','Legado sem cadastro');
 grant select on public.usuarios_empresa to authenticated;
 grant select,insert,update,delete on public.atividades_kanban to authenticated;`);
 sql(migrationSql); sql(migrationSql);
 sql(`set role authenticated;
 do $$begin
 if (select responsavel from public.atividades_kanban where id=1)<>'Matheus' or (select participantes from public.atividades_kanban where id=1) is not null then raise exception 'Legado não preservado'; end if;
 if (select participantes from public.atividades_kanban where id=2) is not null then raise exception 'Legado ambíguo alterado'; end if;
 end$$;
 update public.atividades_kanban set participantes=array['${id(1)}'::uuid,'${id(2)}'::uuid,'${id(1)}'::uuid] where id=1;
 do $$begin
 if (select cardinality(participantes) from public.atividades_kanban where id=1)<>2 then raise exception 'Seleção múltipla ou deduplicação falhou'; end if;
 begin
 update public.atividades_kanban set participantes=array['${id(99)}'::uuid] where id=1;
 raise exception 'Usuário inexistente aceito' using errcode='XX000';
 exception when raise_exception then null; end;
 begin
 update public.atividades_kanban set participantes=array[null::uuid] where id=1;
 raise exception 'Participante nulo aceito' using errcode='XX000';
 exception when raise_exception then null; end;
 end$$;
 update public.atividades_kanban set participantes=array['${id(2)}'::uuid] where id=1;
 update public.atividades_kanban set participantes='{}'::uuid[] where id=1;
 do $$begin if (select cardinality(participantes) from public.atividades_kanban where id=1)<>0 then raise exception 'Remoção falhou'; end if; end$$;`);
 console.log('OK: migração reaplicável, responsável legado, múltiplos participantes, deduplicação, remoção e rejeição de usuários inexistentes.');
} catch(e) { console.error(e.stderr?.toString() ?? e); process.exitCode=1; }
finally { try {docker(['rm','-f',container]);} catch {} }
