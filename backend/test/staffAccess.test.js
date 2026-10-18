/* Testes de integração do acesso da equipe: 2FA da admin, convite por link, perfis, limite de admins,
   sessões derrubadas, registro de ações sem segredos, proteção contra CSRF e exclusão de conta da cliente.
   Banco próprio (lapidare_test_access), criado e apagado aqui; só roda com Postgres local. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createHash } from 'node:crypto';

import { startApi, testDatabaseUrl } from '../testing/integration.js';
import { currentStep, hotp } from '../src/lib/totp.js';

// Mesmo hash de lib/sessions.js. Não importamos módulos que leem a configuração antes de startApi()
// apontar a API para o banco de teste.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const DATABASE = 'lapidare_test_access';
const skip = testDatabaseUrl(DATABASE) ? false : 'sem Postgres local (DATABASE_URL) nem TEST_DATABASE_URL';

const ADMIN = { email: 'admin@lapidare.test', name: 'Teste Admin', password: 'Rosa-azul-chuva-77' };
const SENHAS_USADAS = [ADMIN.password, 'Girassol-de-vidro-42', 'Lua-cheia-no-mar-31', 'Outra-senha-boa-58'];

let t; // ferramentas da API de teste
let adminId;
let adminCookie;

describe('acesso da equipe', { skip }, () => {
  before(async () => {
    t = await startApi(DATABASE);
    adminId = await t.createStaff({ ...ADMIN, role: 'admin' });
  });

  after(async () => {
    await t?.close();
  });

  test('admin precisa do 2FA: cadastra o app no primeiro login; sem o código não há sessão', async () => {
    const first = await t.call('POST', '/staff/login', { body: { email: ADMIN.email, password: ADMIN.password } });
    assert.equal(first.status, 200);
    assert.equal(first.body.twoFactor, 'enroll');
    assert.match(first.body.otpauthUrl, /^otpauth:\/\/totp\/Lapidare%20Beauty/);
    assert.equal(t.cookieOf(first), null, 'senha certa ainda não abre sessão');
    assert.equal((await t.call('GET', '/staff/me')).status, 401);

    const wrong = await t.call('POST', '/staff/login/2fa', { body: { challenge: first.body.challenge, code: '000000' } });
    assert.equal(wrong.status, 401);

    const ok = await t.call('POST', '/staff/login/2fa', {
      body: { challenge: first.body.challenge, code: hotp(first.body.secret, currentStep()) },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.user.twoFactor, true);
    adminCookie = t.cookieOf(ok);
    t.secrets.set(ADMIN.email, first.body.secret);

    // Cookie da equipe: httpOnly e SameSite=Strict.
    assert.match(ok.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(ok.headers.get('set-cookie'), /SameSite=Strict/i);

    // O segredo fica cifrado no banco.
    const { rows } = await t.db.query('SELECT totp_secret_enc FROM staff_users WHERE id = $1', [adminId]);
    assert.match(rows[0].totp_secret_enc, /^v1\./);
    assert.ok(!rows[0].totp_secret_enc.includes(first.body.secret));
  });

  test('o mesmo código não serve duas vezes; 5 códigos errados derrubam a etapa', async () => {
    const secret = t.secrets.get(ADMIN.email);

    const login = await t.call('POST', '/staff/login', { body: { email: ADMIN.email, password: ADMIN.password } });
    assert.equal(login.body.twoFactor, 'verify');
    assert.equal(login.body.secret, undefined, 'o segredo só aparece no cadastro');

    const { rows } = await t.db.query('SELECT totp_last_step FROM staff_users WHERE id = $1', [adminId]);
    const lastStep = Number(rows[0].totp_last_step);
    const replay = await t.call('POST', '/staff/login/2fa', {
      body: { challenge: login.body.challenge, code: hotp(secret, lastStep) },
    });
    assert.equal(replay.status, 401, 'código já usado é recusado');
    const next = await t.call('POST', '/staff/login/2fa', {
      body: { challenge: login.body.challenge, code: hotp(secret, Math.max(currentStep(), lastStep) + 1) },
    });
    assert.equal(next.status, 200);

    const again = await t.call('POST', '/staff/login', { body: { email: ADMIN.email, password: ADMIN.password } });
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await t.call('POST', '/staff/login/2fa', { body: { challenge: again.body.challenge, code: '123456' } });
    }
    assert.match(last.body.message, /Muitos códigos errados/);
    const after5 = await t.call('POST', '/staff/login/2fa', {
      body: { challenge: again.body.challenge, code: hotp(secret, currentStep() + 1) },
    });
    assert.equal(after5.status, 401);
  });

  let invite; // { id, token }

  test('convite: admin cadastra profissional nova; o link vale uma vez; senha fraca é recusada', async () => {
    const res = await t.call('POST', '/staff/users', {
      cookie: adminCookie,
      body: {
        name: 'Teste Nova',
        email: 'nova@lapidare.test',
        role: 'professional',
        newProfessional: { name: 'Teste Nova', role: 'Manicure' },
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.user.status, 'invited');
    assert.match(res.body.user.professionalId, /^pro-teste-nova/);
    invite = { id: res.body.user.id, token: res.body.link.token };

    // No banco fica só o hash do link.
    const plain = await t.db.query('SELECT 1 FROM staff_tokens WHERE token_hash = $1', [invite.token]);
    assert.equal(plain.rowCount, 0);
    const hashed = await t.db.query('SELECT 1 FROM staff_tokens WHERE token_hash = $1', [hashToken(invite.token)]);
    assert.equal(hashed.rowCount, 1);

    // Sem senha criada, não entra.
    const noPass = await t.call('POST', '/staff/login', { body: { email: 'nova@lapidare.test', password: 'qualquer-coisa-1' } });
    assert.equal(noPass.status, 401);

    assert.equal((await t.call('GET', `/staff/invites/${invite.token}`)).body.name, 'Teste Nova');
    for (const weak of ['1234567890', 'curta', 'testenova123']) {
      const r = await t.call('POST', `/staff/invites/${invite.token}`, { body: { password: weak } });
      assert.equal(r.status, 400, `senha fraca aceita: ${weak}`);
    }
    const set = await t.call('POST', `/staff/invites/${invite.token}`, { body: { password: SENHAS_USADAS[1] } });
    assert.equal(set.status, 200);
    assert.equal(
      (await t.call('POST', `/staff/invites/${invite.token}`, { body: { password: SENHAS_USADAS[1] } })).status,
      404,
    );
    assert.equal((await t.call('GET', `/staff/invites/${invite.token}`)).status, 404);

    novaCookie = await t.login('nova@lapidare.test', SENHAS_USADAS[1]);
    assert.ok(novaCookie, 'profissional entra só com a senha');
  });

  // Reaproveita a sessão: o limite de 5 tentativas de login por e-mail em 15 min vale para os testes também.
  let novaCookie;

  test('profissional não vê usuários nem o registro de ações', async () => {
    const cookie = novaCookie;
    assert.equal((await t.call('GET', '/staff/users', { cookie })).status, 403);
    assert.equal((await t.call('GET', '/staff/audit', { cookie })).status, 403);
    assert.equal(
      (await t.call('POST', '/staff/users', { cookie, body: { name: 'X Y', email: 'x@lapidare.test', role: 'admin' } }))
        .status,
      403,
    );
    assert.equal((await t.call('PATCH', `/staff/users/${adminId}`, { cookie, body: { active: false } })).status, 403);
    assert.equal((await t.call('GET', '/staff/services', { cookie })).status, 403);
  });

  test('no máximo 4 admins ativas', async () => {
    for (const n of [2, 3, 4]) {
      const r = await t.call('POST', '/staff/users', {
        cookie: adminCookie,
        body: { name: `Teste Admin ${n}`, email: `admin${n}@lapidare.test`, role: 'admin' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    const fifth = await t.call('POST', '/staff/users', {
      cookie: adminCookie,
      body: { name: 'Teste Admin 5', email: 'admin5@lapidare.test', role: 'admin' },
    });
    assert.equal(fifth.status, 409);
  });

  test('ninguém muda o próprio perfil; desativar derruba a sessão na hora', async () => {
    const selfRole = await t.call('PATCH', `/staff/users/${adminId}`, {
      cookie: adminCookie,
      body: { role: 'professional', professionalId: 'pro-1' },
    });
    assert.equal(selfRole.status, 400);
    assert.equal((await t.call('PATCH', `/staff/users/${adminId}`, { cookie: adminCookie, body: { active: false } })).status, 400);

    const id = await t.createStaff({
      email: 'sai@lapidare.test',
      name: 'Teste Sai',
      role: 'professional',
      professionalId: 'pro-2',
      password: SENHAS_USADAS[2],
    });
    const cookie = await t.login('sai@lapidare.test', SENHAS_USADAS[2]);
    assert.equal((await t.call('GET', '/staff/me', { cookie })).status, 200);

    const off = await t.call('PATCH', `/staff/users/${id}`, { cookie: adminCookie, body: { active: false } });
    assert.equal(off.status, 200);
    assert.equal(off.body.user.status, 'inactive');
    assert.equal((await t.call('GET', '/staff/me', { cookie })).status, 401);
    const relogin = await t.call('POST', '/staff/login', { body: { email: 'sai@lapidare.test', password: SENHAS_USADAS[2] } });
    assert.equal(relogin.status, 401);
  });

  test('novo link de senha: a senha antiga deixa de valer e as sessões caem', async () => {
    const cookie = novaCookie;
    const link = await t.call('POST', `/staff/users/${invite.id}/link`, { cookie: adminCookie });
    assert.equal(link.status, 200);
    assert.equal(link.body.link.purpose, 'reset');
    assert.equal((await t.call('GET', '/staff/me', { cookie })).status, 401);
    assert.equal(
      (await t.call('POST', '/staff/login', { body: { email: 'nova@lapidare.test', password: SENHAS_USADAS[1] } })).status,
      401,
    );
    const set = await t.call('POST', `/staff/invites/${link.body.link.token}`, { body: { password: SENHAS_USADAS[3] } });
    assert.equal(set.status, 200);
    assert.ok(await t.login('nova@lapidare.test', SENHAS_USADAS[3]));
  });

  test('reiniciar o 2FA de outra admin derruba a sessão dela e pede o cadastro de novo', async () => {
    // Libera uma vaga de admin (o teste do limite encheu as 4).
    const { rows } = await t.db.query("SELECT id FROM staff_users WHERE email = 'admin4@lapidare.test'");
    await t.call('PATCH', `/staff/users/${rows[0].id}`, { cookie: adminCookie, body: { active: false } });
    const id = await t.createStaff({
      email: 'segunda@lapidare.test',
      name: 'Teste Segunda',
      role: 'admin',
      password: SENHAS_USADAS[2],
    });

    const cookie = await t.login('segunda@lapidare.test', SENHAS_USADAS[2]);
    assert.equal((await t.call('GET', '/staff/me', { cookie })).body.user.twoFactor, true);

    const own = await t.call('POST', `/staff/users/${adminId}/reset-2fa`, { cookie: adminCookie });
    assert.equal(own.status, 400, 'não reinicia o próprio');
    const reset = await t.call('POST', `/staff/users/${id}/reset-2fa`, { cookie: adminCookie });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.user.twoFactor, false);
    assert.equal((await t.call('GET', '/staff/me', { cookie })).status, 401);
    const again = await t.call('POST', '/staff/login', { body: { email: 'segunda@lapidare.test', password: SENHAS_USADAS[2] } });
    assert.equal(again.body.twoFactor, 'enroll');
  });

  test('troca da própria senha confere a atual e derruba as outras sessões', async () => {
    await t.createStaff({
      email: 'troca@lapidare.test',
      name: 'Teste Troca',
      role: 'professional',
      professionalId: 'pro-3',
      password: SENHAS_USADAS[2],
    });
    const a = await t.login('troca@lapidare.test', SENHAS_USADAS[2]);
    const b = await t.login('troca@lapidare.test', SENHAS_USADAS[2]);

    const wrong = await t.call('PUT', '/staff/account/password', {
      cookie: a,
      body: { currentPassword: 'errada-errada-1', newPassword: SENHAS_USADAS[3] },
    });
    assert.equal(wrong.status, 400);
    const ok = await t.call('PUT', '/staff/account/password', {
      cookie: a,
      body: { currentPassword: SENHAS_USADAS[2], newPassword: SENHAS_USADAS[3] },
    });
    assert.equal(ok.status, 204);
    assert.equal((await t.call('GET', '/staff/me', { cookie: a })).status, 200, 'esta sessão continua');
    assert.equal((await t.call('GET', '/staff/me', { cookie: b })).status, 401, 'a outra cai');
  });

  test('registro de ações tem quem fez o quê, sem senha, link ou segredo', async () => {
    const res = await t.call('GET', '/staff/audit', { cookie: adminCookie });
    assert.equal(res.status, 200);
    const actions = new Set(res.body.entries.map((e) => e.action));
    for (const a of [
      '2fa_enabled',
      'user_invited',
      'invite_accepted',
      'user_updated',
      'password_reset_link',
      '2fa_reset',
      'password_changed',
    ]) {
      assert.ok(actions.has(a), `faltou ${a}`);
    }
    const text = JSON.stringify(res.body);
    for (const s of [...SENHAS_USADAS, invite.token, t.secrets.get(ADMIN.email)]) assert.ok(!text.includes(s));
    const { rows } = await t.db.query('SELECT details::text AS d FROM staff_audit_log');
    for (const r of rows) for (const s of SENHAS_USADAS) assert.ok(!r.d.includes(s));
  });

  test('pedido que muda dados vindo de outro site é recusado (CSRF)', async () => {
    const evil = await t.call('POST', '/staff/users', {
      cookie: adminCookie,
      origin: 'https://site-malicioso.example',
      body: { name: 'Teste Evil', email: 'evil@lapidare.test', role: 'professional', professionalId: 'pro-1' },
    });
    assert.equal(evil.status, 403);
    const { rowCount } = await t.db.query("SELECT 1 FROM staff_users WHERE email = 'evil@lapidare.test'");
    assert.equal(rowCount, 0);
    // Leitura (GET) não muda nada e continua liberada.
    const read = await t.call('GET', '/staff/me', { cookie: adminCookie, origin: 'https://site-malicioso.example' });
    assert.equal(read.status, 200);
  });

  test('respostas da API não ficam em cache', async () => {
    const res = await t.call('GET', '/staff/me', { cookie: adminCookie });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('cliente apaga a própria conta (LGPD): conta e sessões somem, o agendamento fica com o salão', async () => {
    const {
      rows: [c],
    } = await t.db.query(
      `INSERT INTO customers (google_sub, email, name) VALUES ('sub-teste', 'cliente@lapidare.test', 'Teste Cliente') RETURNING id`,
    );
    const token = 'token-de-sessao-da-cliente-de-teste-0001';
    await t.db.query(
      `INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1, $2, now() + interval '1 day')`,
      [hashToken(token), c.id],
    );
    const {
      rows: [b],
    } = await t.db.query(
      `INSERT INTO bookings (code, service_id, professional_id, starts_at, ends_at, customer_name, customer_phone, customer_id, price_cents)
       VALUES ('TSTC2345', 'manicure', 'pro-1', now() + interval '3 days', now() + interval '3 days 45 minutes',
               'Teste Cliente', '11900001111', $1, 4500) RETURNING id`,
      [c.id],
    );
    const cookie = `lp_customer=${token}`;
    assert.equal((await t.call('GET', '/customer/me', { cookie })).status, 200);
    assert.equal((await t.call('DELETE', '/customer/me', { cookie })).status, 204);
    assert.equal((await t.call('GET', '/customer/me', { cookie })).status, 401);
    assert.equal((await t.db.query('SELECT 1 FROM customers WHERE id = $1', [c.id])).rowCount, 0);
    assert.equal((await t.db.query('SELECT 1 FROM customer_sessions WHERE customer_id = $1', [c.id])).rowCount, 0);
    const kept = await t.db.query('SELECT customer_id FROM bookings WHERE id = $1', [b.id]);
    assert.equal(kept.rows[0].customer_id, null);
  });
});
