import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { connectionOptions } from '../src/db/connection.js';

const URL_POOLER = 'postgres://postgres.abc:segredo@aws-0-us-east-2.pooler.supabase.com:5432/postgres';

afterEach(() => {
  delete process.env.DATABASE_CA_CERT;
});

test('sem certificado, usa a URL como veio', () => {
  assert.deepEqual(connectionOptions(`${URL_POOLER}?sslmode=require`), { connectionString: `${URL_POOLER}?sslmode=require` });
});

test('com certificado, confere o servidor e ignora o sslmode da URL', () => {
  process.env.DATABASE_CA_CERT = '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----';
  const opts = connectionOptions(`${URL_POOLER}?sslmode=require&uselibpqcompat=true`);
  assert.equal(opts.connectionString, URL_POOLER);
  assert.deepEqual(opts.ssl, { ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----', rejectUnauthorized: true });
});
