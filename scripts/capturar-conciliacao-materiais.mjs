import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Somente leitura. Preserva o JSON original para não arredondar numeric do PostgreSQL.
const nomes=['produtos','materias_primas','componentes_produto','pedidos_fabricacao','itens_fabricacao','vendas','pedidos_compra','pedido_compra_itens','movimentos_estoque','reposicoes_produtos','kits','kit_itens','fornecedores'];
const destino=resolve(process.argv[2] ?? 'supabase/local/conciliacao/snapshot-atual.json');
const base=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base || !key) throw Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
const tabelas={},tabelas_exatas={};
for(const nome of nomes) {
 const paginas=[];
 for(let offset=0;;offset+=1000) {
  const url=new URL(`/rest/v1/${nome}`,base);
  for(const [k,v] of Object.entries({select:'*',order:'id',offset,limit:1000})) url.searchParams.set(k,String(v));
  const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!r.ok) throw Error(`Falha ao capturar ${nome}: HTTP ${r.status}`);
  const raw=(await r.text()).trim();
  const parsed=JSON.parse(raw);
  if(!Array.isArray(parsed)) throw Error(`Resposta inesperada em ${nome}`);
  paginas.push(raw.slice(1,-1));
  if(parsed.length<1000) break;
 }
 tabelas_exatas[nome]='['+paginas.filter(Boolean).join(',')+']';
 tabelas[nome]=JSON.parse(tabelas_exatas[nome]);
}
mkdirSync(dirname(destino),{recursive:true,mode:0o700});
writeFileSync(destino,JSON.stringify({coletado_em:new Date().toISOString(),tabelas,tabelas_exatas},null,2),{mode:0o600});
console.log(`Captura exata salva em ${destino}. Nenhum registro foi alterado no banco.`);
