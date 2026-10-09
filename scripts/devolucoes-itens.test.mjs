import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itensDaVenda } from '../src/lib/devolucoes/itens.ts';
const produtos = [{ id: 'p1', codigo: 'P1', nome: 'Produto 1' }, { id: 'p2', codigo: 'P2', nome: 'Produto 2' }];
const venda = { id: 'v1', produto_id: 'p1', kit_id: null, quantidade: 3, valor_unitario: 20, desconto: 6, cmv_componentes: null };
test('preenche a quantidade vendida e desconta o desconto total uma única vez', () => {
  assert.deepEqual(itensDaVenda(venda, produtos), [{ vendaId: 'v1', codigo: 'P1', quantidade: '3', valor: '18.00', ok: true }]);
});
test('kits usam as quantidades históricas totais sem multiplicá-las novamente', () => {
  const itens = itensDaVenda({ ...venda, kit_id: 'kit', cmv_componentes: [{ produto_id: 'p1', quantidade: 6 }, { produto_id: 'p2', quantidade: 3 }] }, produtos);
  assert.deepEqual(itens.map(i => [i.codigo, i.quantidade, i.valor]), [['P1', '6', ''], ['P2', '3', '']]);
});
test('histórico ou produto ausente exige preenchimento manual sem importar kit parcial', () => {
  assert.throws(() => itensDaVenda({ ...venda, kit_id: 'kit' }, produtos), /históricos/);
  assert.throws(() => itensDaVenda({ ...venda, kit_id: 'kit', cmv_componentes: [{ produto_id: 'p1', quantidade: 2 }, { produto_id: 'ausente', quantidade: 1 }] }, produtos), /cadastro/);
});
test('pedidos diferentes do mesmo produto mantêm origem e preço próprios', () => {
  const itens = [...itensDaVenda(venda, produtos), ...itensDaVenda({ ...venda, id: 'v2', valor_unitario: 30 }, produtos)];
  assert.deepEqual(itens.map(i => [i.vendaId, i.valor]), [['v1', '18.00'], ['v2', '28.00']]);
});
