import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDisponibilidade, faltas } from '../src/lib/estoque/disponibilidade.ts';
const produtos = [{ id: 'p1', nome: 'P1', ativo: true, estoque_atual: 99 }, { id: 'p2', nome: 'P2', ativo: true, estoque_atual: 0 }, { id: 'avulso', nome: 'Avulso', ativo: true, estoque_atual: 5 }];
const materiais = [{ id: 'chapa', nome: 'Chapa', unidade: 'un', ativo: true, influencia_saldo: true, saldo: 10 }, { id: 'embalagem', nome: 'Embalagem', unidade: 'un', ativo: true, influencia_saldo: false, saldo: 0 }];
const comps = [{ produto_id: 'p1', materia_prima_id: 'chapa', quantidade: 2 }, { produto_id: 'p2', materia_prima_id: 'chapa', quantidade: 3 }, { produto_id: 'p1', materia_prima_id: 'embalagem', quantidade: 1 }];
const calc = (itens, c = comps, m = materiais) => calcularDisponibilidade(itens, produtos, c, m);
test('produto limita pela matéria-prima, embalagem sem saldo gera alerta', () => {
 const d = calc([{ produto_id: 'p1', quantidade: 1 }]); assert.equal(d.saldo, 5); assert.equal(faltas(d)[0].nome, 'Embalagem'); assert.equal(faltas(d)[0].limita, false);
});
test('kit soma matéria-prima compartilhada antes de dividir', () => {
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }, { produto_id: 'p2', quantidade: 1 }]).saldo, 2);
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }, { produto_id: 'p1', quantidade: 1 }]).saldo, 2);
});
test('kit misto respeita produto acabado e quantidades repetidas', () => {
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }, { produto_id: 'avulso', quantidade: 3 }]).saldo, 1);
});
test('composição vazia, item sem vínculo, quantidade inválida e nenhum limitador não inventam saldo', () => {
 assert.equal(calc([]).saldo, 0);
 assert.equal(calc([{ produto_id: 'p1', quantidade: 0 }]).saldo, 0);
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }], [{ produto_id: 'p1', materia_prima_id: null, quantidade: 1 }]).saldo, 0);
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }], comps, materiais.map(m => ({ ...m, influencia_saldo: false }))).saldo, 0);
});
test('insumo limitador inativo bloqueia; apoio inativo somente alerta', () => {
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }], comps, materiais.map(m => ({ ...m, ativo: false }))).saldo, 0);
 const d=calc([{ produto_id: 'p1', quantidade: 1 }], comps, materiais.map(m => m.id==='embalagem' ? { ...m, ativo: false, saldo: 20 } : m)); assert.equal(d.saldo, 5); assert.equal(faltas(d)[0].faltante, 1);
});
test('quantidades fracionárias são suportadas', () => {
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }], [{ produto_id:'p1', materia_prima_id:'chapa', quantidade:0.1 }], [{ ...materiais[0], saldo:0.3 }]).saldo, 3);
});

const { calcularCustoComposicao } = await import('../src/lib/estoque/disponibilidade.ts');
const materiaisComCusto = materiais.map(m => ({ ...m, custo_medio: m.id === 'chapa' ? 20 : 1, custo_medio_estimado: false }));
test('custo por produto inclui apoio não limitador e ignora custo cadastral', () => {
 const c = calcularCustoComposicao([{ produto_id:'p1', quantidade:1 }], produtos.map(p=>({...p,custo:999})), comps, materiaisComCusto);
 assert.equal(c.total, 41); assert.equal(c.estimado, true); assert.equal(c.itens.find(i=>i.id==='embalagem').subtotal,1);
});
test('custo de kit agrega os produtos e quantidades da matéria-prima compartilhada', () => {
 const c = calcularCustoComposicao([{ produto_id:'p1',quantidade:2 },{ produto_id:'p2',quantidade:1 }], produtos, comps, materiaisComCusto);
 assert.equal(c.total, 142); assert.equal(c.itens.find(i=>i.id==='chapa').quantidade,7);
});
test('custo ausente não vira zero; custo gratuito explícito é aceito', () => {
 const calc=m=>calcularCustoComposicao([{ produto_id:'p1',quantidade:1 }],produtos,comps,m).total;
 assert.equal(calc(materiais),null);
 assert.equal(calc(materiaisComCusto.map(m=>({...m,custo_medio:0}))),0);
});

test('qualquer item pode alternar entre somente alerta e limitar saldo, independentemente do nome', () => {
 const componentes = [...comps, { produto_id: 'p1', materia_prima_id: 'parafuso', quantidade: 2 }];
 const item = { id: 'parafuso', nome: 'Parafuso', unidade: 'un', ativo: true, saldo: 0, influencia_saldo: false };
 const d = calc([{ produto_id: 'p1', quantidade: 1 }], componentes, [...materiais, item]);
 assert.equal(d.saldo, 5);
 assert.equal(faltas(d, 3).find(m => m.id === item.id).faltante, 6);
 assert.equal(faltas(d).find(m => m.id === item.id).limita, false);
 assert.equal(calc([{ produto_id: 'p1', quantidade: 1 }], componentes, [...materiais, { ...item, influencia_saldo: true }]).saldo, 0);
});

 test('custo não lançado não bloqueia a soma dos conhecidos e continua identificado', () => {
 const c = calcularCustoComposicao([{produto_id:'p1',quantidade:1}],produtos,comps,materiaisComCusto.map(m=>m.id==='embalagem'?{...m,custo_medio:null}:m));
 assert.equal(c.total,40);
 assert.equal(c.estimado,true);
 assert.equal(c.itens.find(i=>i.id==='embalagem').subtotal,null);
 });

const { ultimosPrecosMateriais, calcularUltimoCustoComposicao } = await import('../src/lib/estoque/disponibilidade.ts');
const entrada = (id, data, custo, extra = {}) => ({ id, data, criado_em: `${data}T12:00:00Z`, materia_prima_id: 'chapa', tipo: 'compra', quantidade: 10, custo_informado: custo, ...extra });
test('último preço respeita data, desempata pelo registro e ignora médias, saídas e compras canceladas', () => {
 const movimentos = [entrada('1', '2026-09-01', 20), entrada('2', '2026-09-02', 30),
  entrada('3', '2026-09-03', null, { custo_unitario: 25 }),
  entrada('4', '2026-09-04', 99, { tipo: 'ajuste_custo', quantidade: 0 }),
  entrada('5', '2026-09-05', 40, { referencia_id: 'cancelada' }),
  entrada('6', '2026-09-06', 40, { referencia_id: 'cancelada', tipo: 'estorno_compra', quantidade: -10 }),
  entrada('7', '2026-09-07', 80, { tipo: 'estorno_venda' }),
  entrada('8', '2026-08-01', 90, { criado_em: '2026-09-08T12:00:00Z' }),
  entrada('9', '2026-09-02', 32, { criado_em: '2026-09-02T13:00:00Z' })];
 assert.equal(ultimosPrecosMateriais(movimentos).get('chapa'), 32);
 assert.equal(ultimosPrecosMateriais([entrada('zero', '2026-09-09', 0)]).get('chapa'), 0);
});
test('último custo inclui apoio e quantidades do kit, sem substituir preço ausente pela média', () => {
 const itens = [{ produto_id: 'p1', quantidade: 2 }, { produto_id: 'p2', quantidade: 1 }];
 const precos = new Map([['chapa', 30], ['embalagem', 2]]);
 const c = calcularUltimoCustoComposicao(itens, produtos, comps, materiaisComCusto, precos);
 assert.equal(c.total, 214);
 assert.equal(c.itens.find(i => i.id === 'chapa').quantidade, 7);
 precos.delete('embalagem');
 assert.equal(calcularUltimoCustoComposicao(itens, produtos, comps, materiaisComCusto, precos).total, null);
 assert.equal(calcularCustoComposicao(itens, produtos, comps, materiaisComCusto).total, 142);
});
