/* Atalho de admin do desenvolvimento (POST /staff/dev-login): entra sem senha nem 2FA só quando
   DEV_STAFF_LOGIN=true, nunca em produção, e a conta "Admin (dev)" não entra pelo login normal.
   Banco próprio (lapidare_test_devlogin), criado e apagado aqui; só roda com Postgres local. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startApi, testDatabaseUrl } from '../testing/integration.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE = 'lapidare_test_devlogin';
const skip = testDatabaseUrl(DATABASE) ? false : 'sem Postgres local (DATABASE_URL) nem TEST_DATABASE_URL';

test('em produção o servidor não sobe com DEV_STAFF_LOGIN ligado', () => {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config.js')"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', DEV_STAFF_LOGIN: 'true' },
    encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /DEV_STAFF_LOGIN não pode estar ligado em produção/);
});

describe('atalho de admin do desenvolvimento ligado', { skip }, () => {
  let t;

  before(async () => {
    t = await startApi(DATABASE, { devStaffLogin: true });
  });

  after(async () => {
    await t?.close();
  });

  test('entra como admin sem senha nem código, com acesso às telas de admin', async () => {
    const res = await t.call('POST', '/staff/dev-login');
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.email, 'admin.dev@lapidare.test');

    const users = await t.call('GET', '/staff/users', { cookie: t.cookieOf(res) });
    assert.equal(users.status, 200);
  });

  test('usa sempre a mesma conta e registra cada entrada', async () => {
    await t.call('POST', '/staff/dev-login');
    const { rows } = await t.db.query("SELECT id FROM staff_users WHERE email = 'admin.dev@lapidare.test'");
    assert.equal(rows.length, 1);
    const log = await t.db.query("SELECT count(*)::int AS n FROM staff_audit_log WHERE action = 'dev_login'");
    assert.ok(log.rows[0].n >= 2);
  });

  test('a conta do atalho não entra pelo login normal (senha que ninguém conhece)', async () => {
    const res = await t.call('POST', '/staff/login', {
      body: { email: 'admin.dev@lapidare.test', password: 'qualquer-senha-123' },
    });
    assert.equal(res.status, 401);
  });

  test('pedido vindo de outro site é recusado (CSRF)', async () => {
    const res = await t.call('POST', '/staff/dev-login', { origin: 'https://site-malicioso.example' });
    assert.equal(res.status, 403);
  });
});
