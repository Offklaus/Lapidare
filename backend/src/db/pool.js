import pg from 'pg';
import { config } from '../config.js';

if (!config.databaseUrl) {
  throw new Error('Defina DATABASE_URL no arquivo backend/.env (copie de .env.example).');
}

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);
