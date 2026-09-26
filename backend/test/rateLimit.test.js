import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rateLimit } from '../src/lib/rateLimit.js';

/** Roda o middleware com uma requisição falsa; devolve 'next' ou o status HTTP. */
function run(limiter, req) {
  let status = null;
  let passed = false;
  const res = {
    set() { return this; },
    status(s) { status = s; return this; },
    json() { return this; },
  };
  limiter(req, res, () => { passed = true; });
  return passed ? 'next' : status;
}

test('bloqueia com 429 depois do máximo, contando cada IP separado', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, message: 'calma' });
  const a = { ip: '1.1.1.1' };
  const b = { ip: '2.2.2.2' };
  assert.deepEqual([run(limiter, a), run(limiter, a), run(limiter, a), run(limiter, b)], ['next', 'next', 429, 'next']);
});

test('aceita outra chave (ex.: por código do agendamento)', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, message: 'calma', key: (req) => req.params.code });
  const sameCodeOtherIp = [{ ip: '1', params: { code: 'X' } }, { ip: '2', params: { code: 'X' } }];
  assert.deepEqual(sameCodeOtherIp.map((req) => run(limiter, req)), ['next', 429]);
});
