import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPair } from './check-editorial.mjs';

test('allows translations with reordered variables and technical terms', () => {
  assert.deepEqual(checkPair({ text: '{n} constats sur {total}', header: 'Content-Security-Policy' }, { text: 'Of {total}, {n} findings', header: 'Content-Security-Policy' }), []);
});
test('reports missing keys, empty strings, changed variables and array drift', () => {
  const errors = checkPair({ missing: 'Texte', blank: 'Texte', count: '{count} éléments', list: ['Un', 'Deux'] }, { blank: ' ', count: '{n} items', list: ['One'] });
  assert.equal(errors.length, 4);
  assert.ok(errors.some(error => error.includes('missing translation')));
  assert.ok(errors.some(error => error.includes('empty text')));
  assert.ok(errors.some(error => error.includes('variables differ')));
});
test('rejects incompatible structures and explicit drafting remnants', () => {
  const errors = checkPair({ shape: ['Texte'], draft: 'En tant que modèle de langage' }, { shape: 'Text', draft: 'As an AI language model' });
  assert.equal(errors.length, 3);
});
