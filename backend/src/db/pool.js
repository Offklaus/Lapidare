import pg from 'pg';
import { config } from '../config.js';
import { connectionOptions } from './connection.js';

if (!config.databaseUrl) {
  throw new Error('Defina DATABASE_URL no arquivo backend/.env (copie de .env.example).');
}

export const pool = new pg.Pool(connectionOptions(config.databaseUrl));

export const query = (text, params) => pool.query(text, params);
