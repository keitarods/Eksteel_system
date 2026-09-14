import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararVendas, resumoPeriodo, periodosRelatorio, rankingItens, posicaoEstoque, gerarCsv, variacao } from '../src/lib/relatorios/metricas.ts';
import { paginar } from '../src/lib/relatorios/paginacao.ts';
const periodo = {inicio:'2026-09-01',fim:'2026-09-13'};
const produto = {id:'p',nome:'Peça',codigo:'P',custo:10,estoqueAtual:42,estoqueMinimo:5,ativo:false};
const venda = {id:'v',produtoId:'p',produtoNome:'Peça',kitId:'',marketplace:'Direto',data:'2026-09-10',quantidade:2,valorUnitario:30,desconto:5,taxaMarketplace:3};
const fab = {id:'f',produtoId:'p',data:'2026-08-01',qtdFabricada:10,valorTotal:100};
const base = (patch={}) => ({produtos:[produto],vendas:[venda],fabricacoes:[fab],despesas:[{id:'d',data:'2026-09-02',categoria:'Software',valor:4}],kits:[],...patch});
const resumo = (b) => resumoPeriodo(prepararVendas(b),b.despesas,periodo);
test('DRE desconta CMV, comissão e despesa uma vez; preserva produto inativo',()=>{
 const r=resumo(base()); assert.equal(r.bruta,60);assert.equal(r.receita,55);assert.equal(r.receitaLiquidaGerencial,52);assert.equal(r.cpv,20);assert.equal(r.brutoEstimado,35);assert.equal(r.resultado,28);assert.equal(r.margem,28/55*100);
 assert.equal(rankingItens(prepararVendas(base()),base(),periodo)[0].nome,'Peça');
});
test('CMV independe da fabricação e usa custo cadastral estimado no legado',()=>{
 const b=base({fabricacoes:[]});assert.equal(resumo(b).cpv,20);assert.equal(resumo(b).custosEstimados,1);
 assert.equal(resumo(base({fabricacoes:[{...fab,valorTotal:99999}]})).cpv,20);
});
test('CMV gravado não muda com reposição ou alteração posterior do cadastro',()=>{
 const v={...venda,cmvTotal:18,cmvRegistradoEm:'2026-09-10T12:00:00Z',cmvEstimado:false,cmvComponentes:[{produto_id:'p',quantidade:2,custo_unitario:9}]};
 const b=base({vendas:[v],produtos:[{...produto,custo:999,custoMedio:555}]});assert.equal(resumo(b).cpv,18);assert.equal(resumo(b).custosEstimados,0);
});
test('sem custo positivo ou snapshot incompleto continua não apurado',()=>{
 const b=base({produtos:[{...produto,custo:0}]});assert.equal(resumo(b).cpv,null);assert.equal(resumo(b).resultado,null);
 const v={...venda,cmvTotal:null,cmvRegistradoEm:'2026-09-10T12:00:00Z',cmvComponentes:[{produto_id:'p',quantidade:2,custo_unitario:null}]};assert.equal(resumo(base({vendas:[v]})).cpv,null);
});
test('kit conta comercialmente uma vez e consome componentes fisicamente',()=>{
 const b=base({vendas:[{...venda,kitId:'k',produtoId:''}],kits:[{id:'k',nome:'Kit',itens:[{produtoId:'p',quantidade:3}]}]});
 const vs=prepararVendas(b);assert.equal(vs[0].cpv,60);assert.equal(vs[0].consumo[0].quantidade,6);assert.equal(rankingItens(vs,b,periodo)[0].quantidade,2);assert.equal(resumo(b).receita,55);
 assert.equal(posicaoEstoque(b,vs,'2026-09-13').itens[0].saidas,6);
});
test('kit removido bloqueia custo e cobertura',()=>{
 const b=base({vendas:[{...venda,kitId:'removido'}]});const vs=prepararVendas(b);assert.equal(vs[0].cpv,null);assert.equal(posicaoEstoque(b,vs,'2026-09-13').itens[0].cobertura,null);
});
test('estoque respeita saldo cadastrado, custo alternativo e saldo negativo',()=>{
 const b=base();const p=posicaoEstoque(b,prepararVendas(b),'2026-09-13');assert.equal(p.itens[0].estoqueAtual,42);assert.equal(p.total,420);
 assert.equal(posicaoEstoque(base({produtos:[{...produto,custoMedio:7}],fabricacoes:[]}),[],'2026-09-13').total,294);
 const neg=base({produtos:[{...produto,estoqueAtual:-1}]});assert.equal(posicaoEstoque(neg,[],'2026-09-13').total,null);
 const zero=base({fabricacoes:[],produtos:[{...produto,ativo:true,estoqueAtual:0,custo:0}]});assert.equal(posicaoEstoque(zero,[],'2026-09-13').total,0);
});
test('períodos respeitam mês parcial, ano bissexto e virada de ano',()=>{
 const p=periodosRelatorio('2026-09','2026-09-13');assert.deepEqual(p.anterior,{inicio:'2026-08-01',fim:'2026-08-13'});assert.equal(p.ano.inicio,'2025-10-01');assert.equal(p.meses.length,12);
 assert.equal(periodosRelatorio('2024-02','2026-09-13').mes.fim,'2024-02-29');assert.equal(periodosRelatorio('2026-03','2026-03-31').anterior.fim,'2026-02-28');
 assert.equal(periodosRelatorio('2026-01','2026-09-13').anterior.inicio,'2025-12-01');assert.throws(()=>periodosRelatorio('2026-13','2026-09-13'));assert.throws(()=>periodosRelatorio('2027-01','2026-09-13'));
});
test('base vazia não inventa margens e exclui lançamentos futuros',()=>{
 const r=resumo(base({vendas:[],despesas:[]}));assert.equal(r.receita,0);assert.equal(r.resultado,0);assert.equal(r.margem,null);assert.equal(r.valorMedio,null);assert.equal(variacao(100,0),null);
 assert.equal(resumo(base({vendas:[{...venda,data:'2026-09-20'}],despesas:[]})).receita,0);
});
test('taxas em despesas são sinalizadas e não deduplicadas sem evidência',()=>{
 const r=resumo(base({despesas:[{id:'d',data:'2026-09-02',categoria:'Taxas marketplace',valor:3}]}));assert.equal(r.despesasTaxas,3);assert.equal(r.resultado,29);
});
test('paginação lê mais de 1000 linhas mesmo com limite menor no servidor',async()=>{
 const rows=Array.from({length:1205},(_,id)=>({id}));let calls=0;
 const result=await paginar(async(start,end)=>{calls++;return rows.slice(start,Math.min(end+1,start+200));});assert.equal(result.length,1205);assert.equal(calls,8);
});
test('paginação aborta em erro e duplicação sem apresentar total parcial',async()=>{
 await assert.rejects(paginar(async()=>[{id:1}]));await assert.rejects(paginar(async()=>{throw new Error('offline');}),/offline/);
});
test('CSV protege fórmulas e preserva aspas, acentos e números negativos',()=>{
 const csv=gerarCsv([['=CMD()', ' @SUM(1)', 'Peça "A"', -10, null]]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=CMD()"'));assert.ok(csv.includes('"\' @SUM(1)"'));assert.ok(csv.includes('"Peça ""A"""'));assert.ok(csv.includes('"-10";""'));
});

test('composição gravada do kit é preservada após mudanças no cadastro',()=>{
 const v={...venda,kitId:'k',produtoId:'',cmvTotal:60,cmvRegistradoEm:'2026-09-10T12:00:00Z',cmvEstimado:false,cmvComponentes:[{produto_id:'p',quantidade:6,custo_unitario:10}]};
 const b=base({vendas:[v],kits:[]});const vs=prepararVendas(b);assert.equal(vs[0].cpv,60);assert.equal(vs[0].consumo[0].quantidade,6);assert.equal(posicaoEstoque(b,vs,'2026-09-13').itens[0].saidas,6);
});
