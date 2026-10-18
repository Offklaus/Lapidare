/* Apoio aos testes de integração: sobe a API de verdade contra um banco de teste criado do zero
   (migrations + dados iniciais) no mesmo Postgres do backend/.env, e apaga o banco no fim.
   Fica fora de test/ para o `node --test` não rodar este arquivo sozinho.
   Segurança: só usa Postgres local (localhost/127.0.0.1), ou TEST_DATABASE_URL definido de propósito —
   nunca o banco de produção. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { currentStep, hotp } from '../src/lib/totp.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATABASE_URL && existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

/** URL do banco de teste `database`, ou null se não houver Postgres local (aí os testes são pulados). */
export function testDatabaseUrl(database) {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.pathname = `/${database}`;
    return url.toString();
  }
  if (!process.env.DATABASE_URL) return null;
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
  url.pathname = `/${database}`;
  return url.toString();
}

async function adminQuery(testUrl, sql) {
  const admin = new URL(testUrl);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Cria o banco `database`, sobe a API numa porta livre e devolve ferramentas para os testes:
 * { api, db, call, login, createStaff, cookieOf, secrets, close }.
 */
export async function startApi(database) {
  const testUrl = testDatabaseUrl(database);
  assert.ok(testUrl, 'sem Postgres local para os testes de integração');

  await adminQuery(testUrl, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await adminQuery(testUrl, `CREATE DATABASE ${database}`);
  execFileSync(process.execPath, ['src/db/setup.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });

  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_IP_HEADER = '';
  process.env.APP_SECRET = 'segredo-so-para-testes-0123456789-abcdefghij';
  const { config } = await import('../src/config.js');
  // Trava de segurança: se algum módulo leu a configuração antes (import no topo do teste), a API estaria
  // no banco de verdade. Aí o teste para aqui, antes de tocar em qualquer dado.
  assert.equal(
    config.databaseUrl,
    testUrl,
    'A API de teste não está no banco de teste: não importe módulos de src/ no topo do arquivo de teste.',
  );
  const { app } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  const { hashPassword } = await import('../src/lib/password.js');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const api = `http://127.0.0.1:${server.address().port}/api`;

  const db = new pg.Client({ connectionString: testUrl });
  await db.connect();

  /** fetch na API → { status, body, headers } */
  async function call(method, route, { body, cookie, origin } = {}) {
    const res = await fetch(api + route, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  }

  const cookieOf = (res) => res.headers.get('set-cookie')?.split(';')[0] || null;

  // Segredos do app autenticador cadastrados nos logins (por e-mail), para gerar os códigos.
  const secrets = new Map();

  /** Login completo (senha e, para admin, o código do app). → cookie da sessão */
  async function login(email, password) {
    const first = await call('POST', '/staff/login', { body: { email, password } });
    assert.equal(first.status, 200, `login de ${email}: ${JSON.stringify(first.body)}`);
    if (!first.body.twoFactor) return cookieOf(first);
    if (first.body.secret) secrets.set(email, first.body.secret);
    const secret = secrets.get(email);
    for (const offset of [0, 1]) {
      const code = hotp(secret, currentStep() + offset);
      const second = await call('POST', '/staff/login/2fa', { body: { challenge: first.body.challenge, code } });
      if (second.status === 200) return cookieOf(second);
    }
    throw new Error(`2FA de ${email} falhou`);
  }

  /** Conta da equipe direto no banco (já com senha). → id */
  async function createStaff({ email, name, role, professionalId = null, password }) {
    const { rows } = await db.query(
      `INSERT INTO staff_users (email, name, password_hash, role, professional_id, password_changed_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
      [email, name, await hashPassword(password), role, professionalId],
    );
    return rows[0].id;
  }

  async function close() {
    server.close();
    await pool.end();
    await db.end();
    await adminQuery(testUrl, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  }

  return { api, db, call, login, createStaff, cookieOf, secrets, close };
}
