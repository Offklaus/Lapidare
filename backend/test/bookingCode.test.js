import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CODE_ALPHABET, formatCode, generateCode, normalizeCode } from '../src/lib/bookingCode.js';

test('alfabeto tem 32 símbolos e nenhum que confunde (I, O, 0, 1)', () => {
  assert.equal(CODE_ALPHABET.length, 32);
  assert.equal(new Set(CODE_ALPHABET).size, 32);
  for (const ch of 'IO01') assert.ok(!CODE_ALPHABET.includes(ch));
});

test('gera códigos válidos e variados', () => {
  const codes = Array.from({ length: 500 }, generateCode);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/); // mesmo formato do CHECK do banco
  assert.equal(new Set(codes).size, codes.length);
});

test('aceita o código como a cliente digitar', () => {
  assert.equal(normalizeCode('K7QM-4XZP'), 'K7QM4XZP');
  assert.equal(normalizeCode('k7qm4xzp'), 'K7QM4XZP');
  assert.equal(normalizeCode(' k7qm 4xzp '), 'K7QM4XZP');
});

test('recusa o que não é código', () => {
  assert.equal(normalizeCode('K7QM-4XZ'), null); // curto
  assert.equal(normalizeCode('K7QM-4XZPP'), null); // longo
  assert.equal(normalizeCode('K7QM-4XZ0'), null); // 0 não existe no alfabeto
  assert.equal(normalizeCode(undefined), null);
});

test('formata com hífen no meio', () => {
  assert.equal(formatCode('K7QM4XZP'), 'K7QM-4XZP');
});
