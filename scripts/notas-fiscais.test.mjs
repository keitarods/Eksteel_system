import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNota, LIMITE_NOTA } from '../src/lib/notas-fiscais/arquivos.ts';
test('notas aceitam formatos previstos, normalizam nomes e preservam extensão', () => {
 assert.deepEqual(validarNota({name:'Nota fiscal ção.PDF',size:100}), {nome:'Nota_fiscal_cao.PDF',contentType:'application/pdf'});
 assert.equal(validarNota({name:'nfe.xml',size:100}).contentType,'application/xml');
 assert.equal(validarNota({name:'nota.png',size:LIMITE_NOTA}).contentType,'image/png');
 assert.equal(validarNota({name:'nota.jpg',size:10}).contentType,'image/jpeg');
});
test('recusa vazios, arquivos grandes, nomes excessivos e formatos não aceitos', () => {
 for(const f of [{name:'nota.pdf',size:0},{name:'nota.pdf',size:LIMITE_NOTA+1},{name:'nota.html',size:10},{name:'nota.svg',size:10},{name:'a'.repeat(181)+'.pdf',size:10}]) assert.throws(()=>validarNota(f));
});
