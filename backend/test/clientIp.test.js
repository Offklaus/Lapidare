import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clientIp } from '../src/lib/clientIp.js';
import { rateLimit } from '../src/lib/rateLimit.js';

const run = (mw, req) => {
  mw(req, {}, () => {});
  return req.clientIp;
};

test('com o cabeçalho configurado, usa o IP real que o Cloudflare manda', () => {
  const mw = clientIp('cf-connecting-ip');
  assert.equal(run(mw, { ip: '10.0.0.9', headers: { 'cf-connecting-ip': '203.0.113.7' } }), '203.0.113.7');
  assert.equal(run(mw, { ip: '10.0.0.9', headers: { 'cf-connecting-ip': '2001:db8::1' } }), '2001:db8::1');
});

test('sem cabeçalho, com valor inválido ou sem configuração, cai no req.ip', () => {
  assert.equal(run(clientIp('cf-connecting-ip'), { ip: '10.0.0.9', headers: {} }), '10.0.0.9');
  assert.equal(run(clientIp('cf-connecting-ip'), { ip: '10.0.0.9', headers: { 'cf-connecting-ip': 'não é ip' } }), '10.0.0.9');
  assert.equal(run(clientIp(''), { ip: '10.0.0.9', headers: { 'cf-connecting-ip': '203.0.113.7' } }), '10.0.0.9');
});

test('o limite conta pela cliente, mesmo quando o intermediário (req.ip) muda', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, message: 'x' });
  let blocked = 0;
  for (const proxy of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) {
    const req = { ip: proxy, clientIp: '203.0.113.7' };
    limiter(req, { set() { return this; }, status() { blocked += 1; return this; }, json() { return this; } }, () => {});
  }
  assert.equal(blocked, 1);
});
