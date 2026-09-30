/* Prepara o banco: cria o database (se faltar), aplica as migrations pendentes e insere os dados iniciais.
   Uso: npm run db:setup      (tudo)
        npm run db:seed       (só os dados iniciais)
        npm run db:migrate    (só as migrations — usado ao iniciar em produção) */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

import { connectionOptions } from './connection.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');
const seedFile = path.join(here, 'seed.sql');

const url = process.env.DATABASE_URL;
const seedOnly = process.argv.includes('--seed-only');
// Produção: só migrations, sem recolocar os dados iniciais (o salão pode ter apagado ou mudado serviços).
const migrateOnly = process.argv.includes('--migrate-only');

async function ensureDatabase() {
  const probe = new pg.Client(connectionOptions(url));
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    if (err.code !== '3D000') throw err; // 3D000 = database não existe
  }

  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  target.pathname = '/postgres';
  const admin = new pg.Client(connectionOptions(target.toString()));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  await admin.end();
  console.log(`Banco "${dbName}" criado.`);
}

async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Migration aplicada: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falha na migration ${file}: ${err.message}`);
    }
  }
}

async function seed(client) {
  const sql = await readFile(seedFile, 'utf8');
  await client.query(sql);
  console.log('Dados iniciais inseridos (itens já existentes foram mantidos).');
}

async function main() {
  if (!url) {
    console.error('Defina DATABASE_URL no arquivo backend/.env (copie de .env.example).');
    process.exit(1);
  }

  if (!seedOnly) await ensureDatabase();

  const client = new pg.Client(connectionOptions(url));
  await client.connect();
  try {
    if (!seedOnly) await migrate(client);
    if (!migrateOnly) await seed(client);
  } finally {
    await client.end();
  }
  console.log('Banco pronto.');
}

main().catch((err) => {
  if (err.code === '28P01') console.error('Usuário ou senha do Postgres incorretos. Confira DATABASE_URL no backend/.env.');
  else if (err.code === 'ECONNREFUSED') console.error('Não achamos o Postgres nesse endereço. Ele está rodando? Confira host e porta em DATABASE_URL.');
  else console.error(err.message);
  process.exit(1);
});
