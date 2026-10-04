import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPastas, correspondeBusca, listarDesenhos, baixarDesenho, LIMITE_PDF } from '../src/lib/desenhos/biblioteca.ts';
const desenho = { id: '1', owner_id: 'autor-a', folder_name: 'Peças', source_name: 'Suporte', filename: 'Suporte.pdf', kind: 'pdf', object_path: 'autor-a/pasta/1/Suporte.pdf', byte_size: 100, created_at: '2026-10-03T12:00:00Z', purpose: 'Fabricação' };

test('pastas homônimas de autores diferentes não são misturadas', () => {
  const pastas = agruparPastas([desenho, { ...desenho, id: '2', owner_id: 'autor-b' }, { ...desenho, id: '3' }]);
  assert.equal(pastas.length, 2);
  assert.equal(pastas[0].arquivos.length, 2);
  assert.equal(pastas[1].arquivos.length, 1);
  assert.equal(agruparPastas([]).length, 0);
});
test('busca por nome, pasta, origem e observação sem diferenciar acentos ou maiúsculas', () => {
  for (const termo of [' PECAS ', 'SUPORTE', 'fabricacao', '.pdf', '']) assert.equal(correspondeBusca(desenho, termo), true);
  assert.equal(correspondeBusca(desenho, 'inexistente'), false);
});
function catalogo(paginas) {
  const chamadas = [];
  const query = {};
  for (const metodo of ['from', 'select', 'eq', 'order']) query[metodo] = (...args) => { chamadas.push([metodo, ...args]); return query; };
  query.range = async (...args) => { chamadas.push(['range', ...args]); return paginas.shift(); };
  return { db: query, chamadas };
}
test('pagina todos os PDFs com ordenação estável e filtro no banco', async () => {
  const { db, chamadas } = catalogo([{ data: Array.from({ length: 100 }, (_, i) => ({ ...desenho, id: String(i) })), error: null }, { data: [{ ...desenho, id: '100' }], error: null }]);
  assert.equal((await listarDesenhos(db)).length, 101);
  assert.deepEqual(chamadas.filter(c => c[0] === 'range'), [['range', 0, 99], ['range', 100, 199]]);
  assert.deepEqual(chamadas.find(c => c[0] === 'eq'), ['eq', 'kind', 'pdf']);
  assert.ok(chamadas.some(c => c[0] === 'order' && c[1] === 'id'));
});
test('distingue biblioteca vazia de configuração ausente e erros de acesso', async () => {
  assert.deepEqual(await listarDesenhos(catalogo([{ data: [], error: null }]).db), []);
  await assert.rejects(listarDesenhos(catalogo([{ data: null, error: { code: '42P01' } }]).db), /não está configurada/);
  await assert.rejects(listarDesenhos(catalogo([{ data: null, error: { code: '42501' } }]).db), /acesso à biblioteca/);
  await assert.rejects(listarDesenhos(catalogo([{ data: null, error: null }]).db), /incompleta/);
});
function storage(data, error = null) {
  return { storage: { from(bucket) { assert.equal(bucket, 'cad-documents'); return { async download(path) { assert.equal(path, desenho.object_path); return { data, error }; } }; } } };
}
test('converte MIME binário do Model System para PDF preservando o conteúdo', async () => {
  const original = new Blob(['%PDF-1.7\nconteudo'], { type: 'application/octet-stream' });
  const pdf = await baixarDesenho(storage(original), desenho);
  assert.equal(pdf.type, 'application/pdf');
  assert.equal(await pdf.text(), await original.text());
});
test('recusa arquivo inválido, acesso revogado e tamanho acima do limite', async () => {
  await assert.rejects(baixarDesenho(storage(new Blob(['texto'])), desenho), /não é um PDF válido/);
  await assert.rejects(baixarDesenho(storage(null, { message: 'Forbidden' }), desenho), /acesso pode ter sido removido/);
  await assert.rejects(baixarDesenho({}, { ...desenho, byte_size: LIMITE_PDF + 1 }), /limite/);
});
