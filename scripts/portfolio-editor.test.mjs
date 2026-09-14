import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as validacao from '../src/lib/portfolio/validacao.ts';
const source=readFileSync(new URL('../src/app/api/produtos/[id]/site/route.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const id='00000000-0000-0000-0000-000000000002';
const ctx={params:Promise.resolve({id})};
function ambiente({login=true,role='admin',access=true}={}){
 const writes=[],uploads=[],removed=[];let privileged=0;
 const site={id:'site-id',arquivo_base:'produto_teste',nome:'Teste',categoria:'Teste',descricao:'Anterior',ordem:1,ativo:false};
 const userClient={auth:{getUser:async()=>({data:{user:login?{id:'user'}:null}})},from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:table==='usuarios_empresa'?{papel:role}:access?{id}:null}}}}};
 const admin={from(){return {select(_s,opts){this.count=opts?.count;return this},eq(){return this},update(payload){writes.push(payload);return this},async single(){return {data:{id:'site-id'}}},async maybeSingle(){return {data:site}},then(resolve){resolve({count:1})}}},storage:{from(){return {list:async()=>({data:[]}),getPublicUrl:n=>({data:{publicUrl:'https://fixture.test/'+n}}),upload:async(...args)=>{uploads.push(args);return {}},remove:async names=>{removed.push(names);return {}}}}}};
 const exports={};new Function('require','exports',compiled)((name)=>name==='@/lib/supabase/server'?{createClient:async()=>userClient}:name==='@supabase/supabase-js'?{createClient:()=>{privileged++;return admin}}:validacao,exports);
 return {routes:exports,writes,uploads,removed,privileged:()=>privileged};
}
const req=(method,body,origin='https://fixture.test')=>new Request(`https://fixture.test/api/produtos/${id}/site`,{method,headers:{origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.test';
test('links aceitam Mercado Livre e recusam javascript e hosts impostores',()=>{
 assert.equal(validacao.validarLink(''),null);assert.equal(validacao.validarLink('https://produto.mercadolivre.com.br/MLB-1'),'https://produto.mercadolivre.com.br/MLB-1');
 for(const link of ['javascript:alert(1)','https://mercadolivre.com.br.evil.test/x','http://meli.la/test','https://user:pass@meli.la/test'])assert.throws(()=>validacao.validarLink(link));
});
test('dados usam lista permitida e protegem IDs, nome-base e status',()=>{const p=validacao.validarDados({descricao:' Texto ',ordem:2,link_mercado_livre:'',link_mercado_livre_2:'',ativo:true,arquivo_base:'outro'});assert.deepEqual(Object.keys(p).sort(),['descricao','ordem','link_mercado_livre','link_mercado_livre_2'].sort());assert.equal(p.descricao,'Texto');});
test('imagem exige assinatura e regex não aceita outro produto ou diretório',()=>{assert.equal(validacao.tipoImagem(new Uint8Array([255,216,255])).mime,'image/jpeg');assert.throws(()=>validacao.tipoImagem(new TextEncoder().encode('<svg>')));assert.ok(validacao.padraoImagem('a.b').test('a.b_123.jpg'));assert.equal(validacao.padraoImagem('a.b').test('axb_123.jpg'),false);assert.equal(validacao.padraoImagem('a.b').test('../a.b.jpg'),false);});
test('rotas negam anônimo, pendente, produto inacessível e origem externa antes do serviço',async()=>{
 for(const [options,origin,status] of [[{login:false},'https://fixture.test',401],[{role:'pendente'},'https://fixture.test',403],[{access:false},'https://fixture.test',404],[{},'https://evil.test',403]]){const a=ambiente(options);assert.equal((await a.routes.PATCH(req('PATCH',{},origin),ctx)).status,status);assert.equal(a.privileged(),0);}
});
test('edição só grava metadados permitidos',async()=>{const a=ambiente();const res=await a.routes.PATCH(req('PATCH',{descricao:'Nova',ordem:0,link_mercado_livre:'https://meli.la/test',link_mercado_livre_2:'',ativo:true},),ctx);assert.equal(res.status,200);assert.equal(a.writes.length,1);assert.equal(a.writes[0].ativo,undefined);});
test('upload cria nome vinculado e não permite sobrescrita',async()=>{const a=ambiente();const form=new FormData();form.set('imagem',new File([new Uint8Array([255,216,255,0])],'qualquer.jpg',{type:'image/jpeg'}));const r=new Request('https://fixture.test/api/test',{method:'POST',headers:{origin:'https://fixture.test'},body:form});assert.equal((await a.routes.POST(r,ctx)).status,200);assert.match(a.uploads[0][0],/^produto_teste_\d+\.jpg$/);assert.equal(a.uploads[0][2].upsert,false);});
test('remover imagem de outro produto é bloqueado',async()=>{const a=ambiente();assert.equal((await a.routes.DELETE(req('DELETE',{nome:'outro_1.jpg'}),ctx)).status,400);assert.equal(a.removed.length,0);assert.equal((await a.routes.DELETE(req('DELETE',{nome:'produto_teste_1.jpg'}),ctx)).status,200);});
test('GLB valida assinatura, versão, tamanho e JSON antes do upload',()=>{
 const json=new TextEncoder().encode('{"asset":{"version":"2.0"}} ');
 const bytes=new Uint8Array(20+json.length);const view=new DataView(bytes.buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.length,true);view.setUint32(12,json.length,true);view.setUint32(16,0x4e4f534a,true);bytes.set(json,20);
 assert.doesNotThrow(()=>validacao.validarGlb(bytes));
 assert.throws(()=>validacao.validarGlb(bytes.subarray(0,bytes.length-1)));
 view.setUint32(4,1,true);assert.throws(()=>validacao.validarGlb(bytes));
 assert.throws(()=>validacao.validarGlb(new TextEncoder().encode('arquivo falso renomeado para modelo.glb')));
});
