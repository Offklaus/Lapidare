import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCookies } from '../src/lib/cookies.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('senha: confere a certa e recusa a errada', async () => {
  const stored = await hashPassword('senha-de-teste-123');
  assert.match(stored, /^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
  assert.equal(await verifyPassword('senha-de-teste-123', stored), true);
  assert.equal(await verifyPassword('senha-de-teste-124', stored), false);
});

test('senha: o mesmo texto gera hashes diferentes (salt aleatório)', async () => {
  const [a, b] = await Promise.all([hashPassword('mesma-senha-xyz'), hashPassword('mesma-senha-xyz')]);
  assert.notEqual(a, b);
});

test('senha: hash mal formado nunca confere', async () => {
  assert.equal(await verifyPassword('qualquer', 'texto-qualquer'), false);
  assert.equal(await verifyPassword('qualquer', undefined), false);
  assert.equal(await verifyPassword(undefined, await hashPassword('abcdefghij')), false);
});

test('cookies: lê nomes e valores do cabeçalho', () => {
  assert.deepEqual(parseCookies('lp_staff=abc123; tema=escuro'), { lp_staff: 'abc123', tema: 'escuro' });
  assert.deepEqual(parseCookies('a=%20b; semvalor; =x'), { a: ' b' });
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies('x=%E0%A4%A'), { x: '%E0%A4%A' });
});
