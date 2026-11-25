/* Login da equipe com Google: só quem a admin cadastrou entra; a conta Google fica presa à conta da equipe
   no primeiro login; outra conta Google com o mesmo e-mail não entra; a admin pode desconectar.
   A conferência do token do Google (lib/google.js) é a mesma do login das clientes; aqui testamos o que vem
   depois dela, com perfis já "conferidos". Banco próprio (lapidare_test_google); só roda com Postgres local. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';

import { startApi, testDatabaseUrl } from '../testing/integration.js';

const DATABASE = 'lapidare_test_google';
// E-mail que vira admin sozinho no primeiro login com Google (ADMIN_EMAILS), lido quando a API sobe.
process.env.ADMIN_EMAILS = ' Dona@Lapidare.test , outra@lapidare.test';
const skip = testDatabaseUrl(DATABASE) ? false : 'sem Postgres local (DATABASE_URL) nem TEST_DATABASE_URL';

const ADMIN = { email: 'admin.google@lapidare.test', name: 'Admin Teste', password: 'Rosa-azul-chuva-77' };

let t;
let staffForGoogle;

/** Sessão direto no banco (como o login faria) → cookie. */
async function sessionCookie(userId) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await t.db.query("INSERT INTO staff_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [
    hash,
    userId,
  ]);
  return `lp_staff=${token}`;
}

/** staffForGoogle numa transação, como a rota faz. */
async function googleLogin(profile) {
  await t.db.query('BEGIN');
  try {
    const user = await staffForGoogle(profile, t.db);
    await t.db.query('COMMIT');
    return user;
  } catch (err) {
    await t.db.query('ROLLBACK');
    throw err;
  }
}

describe('login da equipe com Google', { skip }, () => {
  before(async () => {
    t = await startApi(DATABASE);
    ({ staffForGoogle } = await import('../src/lib/staffGoogle.js'));
  });

  after(async () => {
    await t?.close();
  });

  test('e-mail que ninguém cadastrou não entra (ninguém vira equipe por ter conta Google)', async () => {
    await assert.rejects(googleLogin({ sub: 'sub-desconhecido', email: 'qualquer@gmail.com' }), { status: 403 });
  });

  test('primeiro login conecta a conta Google, apaga links abertos e registra; depois entra pelo sub', async () => {
    const id = await t.createStaff({ ...ADMIN, role: 'admin' });
    await t.db.query(
      "INSERT INTO staff_tokens (token_hash, user_id, purpose, expires_at) VALUES ('hash-teste', $1, 'reset', now() + interval '1 day')",
      [id],
    );

    const user = await googleLogin({ sub: 'sub-admin', email: ADMIN.email });
    assert.equal(user.id, id);
    assert.equal(user.role, 'admin');

    const { rows } = await t.db.query('SELECT google_sub FROM staff_users WHERE id = $1', [id]);
    assert.equal(rows[0].google_sub, 'sub-admin');
    const tokens = await t.db.query('SELECT 1 FROM staff_tokens WHERE user_id = $1', [id]);
    assert.equal(tokens.rowCount, 0);
    const log = await t.db.query("SELECT 1 FROM staff_audit_log WHERE action = 'google_linked' AND target_user_id = $1", [id]);
    assert.equal(log.rowCount, 1);

    // Mesmo que o e-mail da conta Google mude, o sub continua sendo a mesma pessoa.
    const again = await googleLogin({ sub: 'sub-admin', email: 'outro-email@gmail.com' });
    assert.equal(again.id, id);
  });

  test('outra conta Google com o mesmo e-mail não entra numa conta já conectada', async () => {
    await assert.rejects(googleLogin({ sub: 'sub-intrusa', email: ADMIN.email }), { status: 403 });
  });

  test('conta desativada não entra pelo Google', async () => {
    const id = await t.createStaff({ email: 'inativa@lapidare.test', name: 'Inativa', role: 'admin', password: 'Lua-cheia-no-mar-31' });
    await t.db.query('UPDATE staff_users SET active = false WHERE id = $1', [id]);
    await assert.rejects(googleLogin({ sub: 'sub-inativa', email: 'inativa@lapidare.test' }), { status: 403 });
  });

  test('convidada sem senha entra só com o Google e a sessão vale no painel', async () => {
    const { rows } = await t.db.query(
      "INSERT INTO staff_users (email, name, role) VALUES ('convidada@lapidare.test', 'Convidada', 'admin') RETURNING id",
    );
    const id = rows[0].id;
    // Sem senha e sem Google: a sessão não vale.
    let me = await t.call('GET', '/staff/me', { cookie: await sessionCookie(id) });
    assert.equal(me.status, 401);

    await googleLogin({ sub: 'sub-convidada', email: 'convidada@lapidare.test' });
    me = await t.call('GET', '/staff/me', { cookie: await sessionCookie(id) });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.google, true);
    assert.equal(me.body.user.twoFactor, false);

    const list = await t.call('GET', '/staff/users', { cookie: await sessionCookie(id) });
    assert.equal(list.body.users.find((u) => u.id === id).status, 'active');
  });

  test('e-mail de ADMIN_EMAILS vira admin no primeiro login com Google, já conectada; depois entra pelo sub', async () => {
    const user = await googleLogin({ sub: 'sub-dona', email: 'dona@lapidare.test', name: 'Dona do Salão' });
    assert.equal(user.role, 'admin');
    assert.equal(user.name, 'Dona do Salão');
    assert.equal(user.google_sub, 'sub-dona');
    const log = await t.db.query("SELECT 1 FROM staff_audit_log WHERE action = 'admin_from_config' AND target_user_id = $1", [user.id]);
    assert.equal(log.rowCount, 1);

    const again = await googleLogin({ sub: 'sub-dona', email: 'dona@lapidare.test', name: 'Dona do Salão' });
    assert.equal(again.id, user.id);
    // Outra conta Google com o mesmo e-mail não entra.
    await assert.rejects(googleLogin({ sub: 'sub-outra', email: 'dona@lapidare.test' }), { status: 403 });
  });

  test('e-mail de ADMIN_EMAILS desativado não é recriado nem entra', async () => {
    await t.db.query("UPDATE staff_users SET active = false WHERE email = 'dona@lapidare.test'");
    await assert.rejects(googleLogin({ sub: 'sub-dona', email: 'dona@lapidare.test' }), { status: 403 });
    const { rows } = await t.db.query("SELECT count(*)::int AS n FROM staff_users WHERE email = 'dona@lapidare.test'");
    assert.equal(rows[0].n, 1);
  });

  test('ADMIN_EMAILS respeita o limite de admins ativas', async () => {
    const { rows } = await t.db.query("SELECT count(*)::int AS n FROM staff_users WHERE role = 'admin' AND active");
    for (let i = rows[0].n; i < 4; i += 1) {
      await t.createStaff({ email: `cheia${i}@lapidare.test`, name: `Cheia ${i}`, role: 'admin', password: 'Girassol-de-vidro-42' });
    }
    await assert.rejects(googleLogin({ sub: 'sub-outra-admin', email: 'outra@lapidare.test' }), { status: 409 });
  });

  test('rota de login com Google recusa token inválido sem abrir sessão', async () => {
    const res = await t.call('POST', '/staff/login/google', { body: { credential: 'x' } });
    assert.ok([400, 401, 503].includes(res.status), `status ${res.status}`);
    assert.equal(t.cookieOf(res), null);
  });

  test('admin desconecta a conta Google de outra pessoa: ela sai e o registro guarda', async () => {
    const adminId = (await t.db.query('SELECT id FROM staff_users WHERE email = $1', [ADMIN.email])).rows[0].id;
    const target = (await t.db.query("SELECT id FROM staff_users WHERE email = 'convidada@lapidare.test'")).rows[0].id;
    const targetCookie = await sessionCookie(target);

    const res = await t.call('POST', `/staff/users/${target}/unlink-google`, { cookie: await sessionCookie(adminId) });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.google, false);

    const me = await t.call('GET', '/staff/me', { cookie: targetCookie });
    assert.equal(me.status, 401);
    const log = await t.db.query("SELECT 1 FROM staff_audit_log WHERE action = 'google_unlinked' AND target_user_id = $1", [target]);
    assert.equal(log.rowCount, 1);

    const self = await t.call('POST', `/staff/users/${adminId}/unlink-google`, { cookie: await sessionCookie(adminId) });
    assert.equal(self.status, 400);
  });
});
