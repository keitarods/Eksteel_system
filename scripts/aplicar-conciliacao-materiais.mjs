import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { prepararConciliacao, gerarSql } from './gerar-conciliacao-materiais.mjs';

// Executar: node --env-file=.env.local scripts/aplicar-conciliacao-materiais.mjs
// A conexão não é colocada nos argumentos dos processos nem nos logs.
const connection=process.env.SUPABASE_DB_URL;
if (!connection) {
 console.error('Falta SUPABASE_DB_URL no .env.local. A chave service_role não executa SQL estrutural. Alternativa: aplicar-conciliacao.sql no SQL Editor do Supabase.');
 process.exit(2);
}
try {
 const url=new URL(connection);
 const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
 const ref=api.hostname.split('.')[0];
 const user=decodeURIComponent(url.username);
 if (!['postgres:','postgresql:'].includes(url.protocol) || !(url.hostname===`db.${ref}.supabase.co` || (url.hostname.endsWith('.pooler.supabase.com') && user.endsWith(`.${ref}`)))) throw Error('Conexão SQL não corresponde ao projeto Supabase configurado; operação cancelada');
 const origem=resolve(process.argv[2] ?? 'supabase/local/conciliacao/snapshot-atual.json');
 const snapshot=JSON.parse(readFileSync(origem,'utf8'));
 const plano=prepararConciliacao(snapshot);
 const sql=gerarSql(snapshot,plano);
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port || '5432',PGUSER:user,PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)) || 'postgres',PGSSLMODE:url.searchParams.get('sslmode') || 'require',PGCONNECT_TIMEOUT:'15'};
 const psql=['-X','-v','ON_ERROR_STOP=1','--no-password'];
 const local=spawnSync('psql',['--version'],{stdio:'ignore'}).status===0;
 const args=local ? psql : ['run','--rm','-i','--network','host',...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGCONNECT_TIMEOUT'].flatMap(k=>['-e',k]),'postgres:16-alpine','psql',...psql];
 const output=execFileSync(local ? 'psql' : 'docker',args,{input:sql,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000,maxBuffer:10*1024*1024});
 writeFileSync(resolve(dirname(origem),'resultado-aplicacao.txt'),output,{mode:0o600});
 console.log('Transação concluída no banco configurado. Resultado em supabase/local/conciliacao/resultado-aplicacao.txt.');
} catch(error) {
 // Não imprime stderr do servidor: em erros SQL pode conter dados de origem.
 console.error(error.message?.startsWith('Conexão SQL') ? error.message : 'Não foi possível confirmar a aplicação. Confira a conexão e o estado do lote antes de repetir; a transação possui proteção contra duplicação.');
 process.exitCode=1;
}
