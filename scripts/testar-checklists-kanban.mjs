import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { migrationSql } from './gerar-checklists-kanban.mjs';
const container=`eksteel-checklists-${randomUUID()}`;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input);
const listas=[{id:'c1',titulo:'Preparação',itens:[{id:'i1',texto:'Separar materiais',concluido:false},{id:'i2',texto:'Conferir medidas',concluido:true}]},{id:'c2',titulo:'Entrega',itens:[]}];
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
try {
 docker(['run','--rm','-d','--name',container,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch{await new Promise(r=>setTimeout(r,500));}}
 sql(`create role anon; create role authenticated; create table public.atividades_kanban(id integer primary key,titulo text); insert into public.atividades_kanban values(1,'Antiga'); grant select,insert,update on public.atividades_kanban to authenticated;`);
 sql(migrationSql);sql(migrationSql);
 sql(`set role authenticated;
 do $$begin if (select checklists from public.atividades_kanban where id=1)<>'[]'::jsonb then raise exception 'Legado alterado'; end if; end$$;
 update public.atividades_kanban set checklists=${literal(listas)} where id=1;
 update public.atividades_kanban set checklists=jsonb_set(checklists,'{0,itens,0,concluido}','true') where id=1;
 do $$begin
 if (select checklists#>>'{0,itens,0,concluido}' from public.atividades_kanban where id=1)<>'true' then raise exception 'Conclusão não persistiu'; end if;
 update public.atividades_kanban set checklists='[]' where id=1 and checklists=${literal(listas)};
 if found then raise exception 'Versão obsoleta sobrescreveu checklist'; end if;
 end$$;`);
 const invalidos=[{},null,[{id:'a',titulo:' ',itens:[]}],[{id:'a',titulo:'x',itens:{}}],[{id:'a',titulo:'x',itens:[{id:'i',texto:'x',concluido:'sim'}]}],[{id:'a',titulo:'x',itens:[{id:'i',texto:'',concluido:false}]}],[listas[0],listas[0]],Array.from({length:21},(_,i)=>({id:String(i),titulo:'x',itens:[]})),[{id:'a',titulo:'x',itens:Array.from({length:101},(_,i)=>({id:String(i),texto:'x',concluido:false}))}]];
 for(const v of invalidos) sql(`set role authenticated; do $$begin begin update public.atividades_kanban set checklists=${literal(v)} where id=1; raise exception 'Checklist inválido aceito' using errcode='XX000'; exception when raise_exception or not_null_violation then null; end; end$$;`);
 sql(`set role authenticated; update public.atividades_kanban set checklists='[]' where id=1;`);
 console.log('OK: legado, múltiplas listas, conclusão, versão obsoleta, remoção, validação e limites de checklist.');
} catch(e){console.error(e.stderr?.toString()??e);process.exitCode=1;}
finally{try{docker(['rm','-f',container]);}catch{}}
