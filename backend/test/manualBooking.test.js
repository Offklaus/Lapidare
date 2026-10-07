/* Testes de integração do agendamento pela recepção (POST /api/staff/bookings) e do cadastro rápido.
   Sobem a API de verdade contra um banco separado, "lapidare_test", criado do zero (migrations + dados
   iniciais) no mesmo Postgres do backend/.env e apagado no fim. Só rodam com Postgres local
   (localhost/127.0.0.1) ou com TEST_DATABASE_URL definido; sem banco, são pulados. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { addDays, weekday } from '../src/lib/time.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATABASE_URL && existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) return null;
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null; // nunca no banco de produção
  url.pathname = '/lapidare_test';
  return url.toString();
}
const TEST_URL = testDatabaseUrl();
const skip = TEST_URL ? false : 'sem Postgres local (DATABASE_URL) nem TEST_DATABASE_URL';

let server;
let api;
let db;
let pool;
let adminId;
let adminCookie;
let proCookie;
let DAY; // um dia útil (seg–sáb) daqui a pelo menos 2 dias

async function call(method, route, { body, cookie } = {}) {
  const res = await fetch(api + route, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(email, password) {
  const res = await fetch(`${api}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login de ${email}`);
  return res.headers.get('set-cookie').split(';')[0];
}

const manual = (overrides = {}) => ({
  client: { name: 'Teste Recepção', phone: '11911112222' },
  serviceId: 'manicure',
  professionalId: 'pro-1',
  start: `${DAY}T10:00`,
  origin: 'whatsapp',
  ...overrides,
});

describe('agendamento pela recepção', { skip }, () => {
  before(async () => {
    const admin = new URL(TEST_URL);
    admin.pathname = '/postgres';
    const adminDb = new pg.Client({ connectionString: admin.toString() });
    await adminDb.connect();
    await adminDb.query('DROP DATABASE IF EXISTS lapidare_test WITH (FORCE)');
    await adminDb.query('CREATE DATABASE lapidare_test');
    await adminDb.end();

    execFileSync(process.execPath, ['src/db/setup.js'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: 'pipe',
    });

    process.env.DATABASE_URL = TEST_URL;
    process.env.NODE_ENV = 'test';
    process.env.CLIENT_IP_HEADER = '';
    const { app } = await import('../src/app.js');
    ({ pool } = await import('../src/db/pool.js'));
    const { hashPassword } = await import('../src/lib/password.js');

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    api = `http://127.0.0.1:${server.address().port}/api`;

    db = new pg.Client({ connectionString: TEST_URL });
    await db.connect();
    const hash = await hashPassword('senha-de-teste-123');
    ({ rows: [{ id: adminId }] } = await db.query(
      `INSERT INTO staff_users (email, name, password_hash, role) VALUES ('admin@lapidare.test', 'Admin Teste', $1, 'admin') RETURNING id`,
      [hash],
    ));
    await db.query(
      `INSERT INTO staff_users (email, name, password_hash, role, professional_id)
       VALUES ('pro@lapidare.test', 'Profissional Teste', $1, 'professional', 'pro-1')`,
      [hash],
    );
    adminCookie = await login('admin@lapidare.test', 'senha-de-teste-123');
    proCookie = await login('pro@lapidare.test', 'senha-de-teste-123');

    const { rows } = await db.query(`SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS today`);
    DAY = addDays(rows[0].today, 2);
    while (weekday(DAY) === 0) DAY = addDays(DAY, 1); // domingo o salão fecha
  });

  after(async () => {
    server?.close();
    await pool?.end();
    await db?.end();
    const admin = new URL(TEST_URL);
    admin.pathname = '/postgres';
    const adminDb = new pg.Client({ connectionString: admin.toString() });
    await adminDb.connect();
    await adminDb.query('DROP DATABASE IF EXISTS lapidare_test WITH (FORCE)');
    await adminDb.end();
  });

  test('cria um agendamento válido, com fim calculado pelo serviço, e o horário some do site', async () => {
    const res = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ notes: 'Prefere esmalte nude', end: `${DAY}T23:00` }), // `end` do front é ignorado
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(res.body.endTime, '10:45');

    const { rows } = await db.query(
      `SELECT origin, notes, fit_in, created_by_staff_id, client_id, price_cents,
              extract(epoch FROM ends_at - starts_at) / 60 AS minutes
         FROM bookings WHERE id = $1`,
      [res.body.id],
    );
    assert.deepEqual(
      { ...rows[0], minutes: Number(rows[0].minutes) },
      {
        origin: 'whatsapp',
        notes: 'Prefere esmalte nude',
        fit_in: false,
        created_by_staff_id: adminId,
        client_id: res.body.client.id,
        price_cents: 4500,
        minutes: 45,
      },
    );

    const slots = await call('GET', `/availability/slots?serviceId=manicure&professionalId=pro-1&date=${DAY}`);
    assert.equal(slots.body.find((s) => s.time === '10:00').status, 'booked');
  });

  test('horário sobreposto a outro agendamento → 409 dizendo qual', async () => {
    const res = await call('POST', '/staff/bookings', { cookie: adminCookie, body: manual({ start: `${DAY}T10:30` }) });
    assert.equal(res.status, 409);
    assert.equal(res.body.conflicts[0].customerName, 'Teste Recepção');
    assert.equal(res.body.conflicts[0].time, '10:00');
  });

  test('duas requisições ao mesmo tempo para o mesmo horário → só uma é criada', async () => {
    const body = manual({ start: `${DAY}T14:00`, client: { name: 'Teste Simultânea', phone: '11933334444' } });
    const results = await Promise.all([
      call('POST', '/staff/bookings', { cookie: adminCookie, body }),
      call('POST', '/staff/bookings', { cookie: adminCookie, body }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM bookings
        WHERE professional_id = 'pro-1' AND starts_at = ($1::date + time '14:00') AT TIME ZONE 'America/Sao_Paulo'`,
      [DAY],
    );
    assert.equal(rows[0].n, 1);
  });

  test('profissional que não faz o serviço → 400', async () => {
    const res = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ serviceId: 'laser-axila', start: `${DAY}T16:00` }),
    });
    assert.equal(res.status, 400);
  });

  test('só admin: perfil profissional → 403, sem login → 401', async () => {
    const body = manual({ start: `${DAY}T16:00` });
    assert.equal((await call('POST', '/staff/bookings', { cookie: proCookie, body })).status, 403);
    assert.equal((await call('POST', '/staff/bookings', { body })).status, 401);
    assert.equal((await call('GET', '/staff/clients?q=te', { cookie: proCookie })).status, 403);
    assert.equal((await call('POST', '/staff/clients', { cookie: proCookie, body: body.client })).status, 403);
  });

  test('cadastro rápido não duplica cliente com o mesmo WhatsApp', async () => {
    const first = await call('POST', '/staff/clients', {
      cookie: adminCookie,
      body: { name: 'Teste Joana', phone: '(11) 97777-6666' },
    });
    assert.equal(first.status, 201);
    const again = await call('POST', '/staff/clients', {
      cookie: adminCookie,
      body: { name: 'Teste Joana Silva', phone: '11977776666' },
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.existing, true);
    assert.equal(again.body.id, first.body.id);
    assert.equal(again.body.name, 'Teste Joana'); // o cadastro existente não é trocado

    const booked = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ start: `${DAY}T11:00`, client: { name: 'Outro Nome', phone: '11977776666' } }),
    });
    assert.equal(booked.status, 201);
    assert.equal(booked.body.client.id, first.body.id);

    const { rows } = await db.query(`SELECT count(*)::int AS n FROM clients WHERE phone = '11977776666'`);
    assert.equal(rows[0].n, 1);

    const found = await call('GET', '/staff/clients?q=97777', { cookie: adminCookie });
    assert.deepEqual(found.body.map((c) => c.id), [first.body.id]);
  });

  test('encaixe fora do expediente funciona (com confirmação) e fica marcado', async () => {
    const outside = manual({ start: `${DAY}T20:00`, client: { name: 'Teste Encaixe', phone: '11955556666' } });
    assert.equal((await call('POST', '/staff/bookings', { cookie: adminCookie, body: outside })).status, 400);

    const res = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: { ...outside, fitIn: true, confirmFitIn: true },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { rows } = await db.query('SELECT fit_in FROM bookings WHERE id = $1', [res.body.id]);
    assert.equal(rows[0].fit_in, true);
  });

  test('encaixe sem confirmação é recusado; com sobreposição, nunca é criado', async () => {
    const overlap = manual({ start: `${DAY}T10:15`, client: { name: 'Teste Encaixe 2', phone: '11966667777' } });
    const noConfirm = await call('POST', '/staff/bookings', { cookie: adminCookie, body: { ...overlap, fitIn: true } });
    assert.equal(noConfirm.status, 400);

    const res = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: { ...overlap, fitIn: true, confirmFitIn: true },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.conflicts[0].time, '10:00');
  });

  test('fluxo da cliente continua igual e entra no mesmo cadastro', async () => {
    const res = await call('POST', '/bookings', {
      body: {
        serviceId: 'manicure',
        professionalId: 'pro-3',
        date: DAY,
        time: '15:00',
        customer: { name: 'Teste Site', phone: '11988889999' },
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { rows } = await db.query(
      'SELECT b.origin, b.created_by_staff_id, c.name FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.id = $1',
      [res.body.id],
    );
    assert.deepEqual(rows[0], { origin: 'site', created_by_staff_id: null, name: 'Teste Site' });

    const taken = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ professionalId: 'pro-3', start: `${DAY}T15:00` }),
    });
    assert.equal(taken.status, 409);
  });

  test('cliente agenda vários serviços: um agendamento só, em sequência, com duração e preço somados', async () => {
    const res = await call('POST', '/bookings', {
      body: {
        serviceIds: ['manicure', 'pedicure'],
        professionalId: 'pro-3',
        date: DAY,
        time: '09:00',
        customer: { name: 'Teste Sequência', phone: '11922223333' },
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const view = await call('GET', `/bookings/${res.body.code}`);
    assert.equal(view.body.service.name, 'Manicure tradicional + Pedicure');
    assert.equal(view.body.service.duration, 105); // 45 + 60
    assert.equal(view.body.service.price, 100); // 45 + 55
    assert.deepEqual(
      view.body.services.map((s) => [s.name, s.time, s.duration, s.price]),
      [
        ['Manicure tradicional', '09:00', 45, 45],
        ['Pedicure', '09:45', 60, 55],
      ],
    );

    const { rows } = await db.query(
      `SELECT count(bs.*)::int AS parts, extract(epoch FROM b.ends_at - b.starts_at) / 60 AS minutes, b.price_cents
         FROM bookings b JOIN booking_services bs ON bs.booking_id = b.id
        WHERE b.id = $1 GROUP BY b.id`,
      [res.body.id],
    );
    assert.deepEqual({ ...rows[0], minutes: Number(rows[0].minutes) }, { parts: 2, minutes: 105, price_cents: 10000 });

    // O bloco inteiro (09:00–10:45) fica ocupado para o site.
    const slots = await call('GET', `/availability/slots?serviceId=manicure&professionalId=pro-3&date=${DAY}`);
    const status = Object.fromEntries(slots.body.map((s) => [s.time, s.status]));
    assert.equal(status['10:00'], 'booked');
    assert.equal(status['10:30'], 'booked');
    assert.equal(status['11:00'], 'available');
  });

  test('horários com vários serviços: só onde cabe a sequência inteira e com quem faz todos', async () => {
    const both = await call('GET', `/availability/slots?serviceIds=manicure,pedicure&professionalId=pro-3&date=${DAY}`);
    const times = both.body.filter((s) => s.status === 'available').map((s) => s.time);
    assert.ok(!times.includes('11:00')); // 11:00 + 1h45 passa do almoço (12:00)
    assert.ok(times.includes('13:00'));

    const pros = await call('GET', '/professionals?serviceIds=manicure,laser-axila');
    assert.deepEqual(pros.body.map((p) => p.id), ['pro-3']); // só ela faz unhas e laser

    const wrong = await call('POST', '/bookings', {
      body: {
        serviceIds: ['manicure', 'alongamento-gel'],
        professionalId: 'pro-3',
        date: DAY,
        time: '13:00',
        customer: { name: 'Teste Errado', phone: '11922224444' },
      },
    });
    assert.equal(wrong.status, 404);
    assert.match(wrong.body.message, /todos os serviços/);
  });

  test('equipe agenda vários serviços; recusa profissional que não faz todos e sequência que esbarra em outro atendimento', async () => {
    const ok = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ serviceIds: ['manicure', 'pedicure'], start: `${DAY}T16:00` }),
    });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.endTime, '17:45');

    const agenda = await call('GET', `/staff/bookings?from=${DAY}&to=${DAY}&professionalId=pro-1`, { cookie: adminCookie });
    const created = agenda.body.bookings.find((b) => b.id === ok.body.id);
    assert.deepEqual(
      created.services.map((s) => [s.name, s.time]),
      [
        ['Manicure tradicional', '16:00'],
        ['Pedicure', '16:45'],
      ],
    );
    assert.equal(created.service.price, 100);

    const notAll = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ serviceIds: ['manicure', 'laser-axila'], start: `${DAY}T18:00` }),
    });
    assert.equal(notAll.status, 400);

    // 09:00 + 1h45 = 10:45 esbarra no atendimento das 10:00 (criado no primeiro teste).
    const clash = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({ serviceIds: ['manicure', 'pedicure'], start: `${DAY}T09:00` }),
    });
    assert.equal(clash.status, 409);
    assert.equal(clash.body.conflicts[0].time, '10:00');

    const tooMany = await call('POST', '/staff/bookings', {
      cookie: adminCookie,
      body: manual({
        serviceIds: ['manicure', 'pedicure', 'esmaltacao-gel', 'alongamento-gel', 'manutencao-gel'],
        start: `${DAY}T18:00`,
      }),
    });
    assert.equal(tooMany.status, 400);
  });

  test('horários livres do dia por profissional', async () => {
    const res = await call('GET', `/staff/free-slots?date=${DAY}&professionalId=pro-1`, { cookie: adminCookie });
    assert.equal(res.status, 200);
    const [pro] = res.body.professionals;
    assert.equal(pro.id, 'pro-1');
    assert.ok(pro.times.includes('09:00'));
    assert.ok(!pro.times.includes('10:00') && !pro.times.includes('10:30')); // 10:00–10:45 ocupado
  });
});
