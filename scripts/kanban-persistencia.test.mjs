import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarChecklists, gravarAtividade } from '../src/lib/kanban/persistencia.ts';

function banco(error = null) {
  const chamadas = [];
  const query = {};
  for (const metodo of ['from', 'select', 'limit', 'insert', 'update', 'eq']) {
    query[metodo] = (...args) => { chamadas.push([metodo, ...args]); return query; };
  }
  query.then = (resolve) => resolve({ error });
  query.single = async () => ({ data: { id: '1' }, error });
  return { db: query, chamadas };
}
const lista = [{ id: 'c1', titulo: 'Preparar', itens: [] }];

test('detecta estrutura mesmo com quadro vazio e não confunde falhas de acesso com coluna ausente', async () => {
  assert.equal(await detectarChecklists(banco().db), true);
  for (const code of ['42703', 'PGRST204']) assert.equal(await detectarChecklists(banco({ code }).db), false);
  for (const code of ['42501', 'PGRST301', '']) {
    const error = { code };
    await assert.rejects(detectarChecklists(banco(error).db), e => e === error);
  }
});
for (const id of [null, '1']) {
  for (const disponivel of [false, true]) {
    test(`${id ? 'edição' : 'criação'} com checklists ${disponivel ? 'habilitados' : 'ausentes'}`, async () => {
      const { db, chamadas } = banco();
      const payload = { titulo: 'Atividade', descricao: 'Descrição', prazo: null, participantes: ['u1'], responsavel: 'u1', checklists: disponivel ? lista : [] };
      await gravarAtividade(db, payload, id, 'andamento', disponivel, lista);
      const valores = chamadas.find(c => c[0] === (id ? 'update' : 'insert'))[1];
      assert.equal(Object.hasOwn(valores, 'checklists'), disponivel);
      assert.deepEqual(valores.participantes, ['u1']);
      assert.equal(valores.titulo, payload.titulo);
      assert.equal(valores.descricao, payload.descricao);
      if (!id) assert.equal(valores.status, 'andamento');
      assert.deepEqual(chamadas.filter(c => c[0] === 'eq'), id ? [['eq', 'id', id], ...(disponivel ? [['eq', 'checklists', JSON.stringify(lista)]] : [])] : []);
    });
  }
}
test('não descarta checklists preenchidos quando o recurso está indisponível', async () => {
  const { db, chamadas } = banco();
  await assert.rejects(gravarAtividade(db, { titulo: 'Teste', checklists: lista }, '1', 'pendente', false, []), /Atualize o quadro/);
  assert.equal(chamadas.length, 0);
});
test('preserva o erro de conflito para o formulário orientar a reabertura', async () => {
  const error = { code: 'PGRST116' };
  const resultado = await gravarAtividade(banco(error).db, { titulo: 'Teste', checklists: lista }, '1', 'pendente', true, []);
  assert.equal(resultado.error, error);
});
