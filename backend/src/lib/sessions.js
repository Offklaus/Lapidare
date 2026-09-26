/* Sessões por cookie, reaproveitadas pela equipe e pelas clientes (cada uma com tabela e cookie próprios).
   O token aleatório fica só no cookie httpOnly; no banco guardamos o hash SHA-256 dele. */
import { createHash, randomBytes } from 'node:crypto';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { parseCookies } from './cookies.js';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * table: tabela de sessões · ownerColumn: coluna do dono (user_id, customer_id)
 * cookieName: nome do cookie · days(): duração em dias (lida na hora, vem da config)
 */
export function sessionStore({ table, ownerColumn, cookieName, days }) {
  return {
    cookieName,

    /** SameSite=Lax: o navegador não manda o cookie em POST vindo de outro site. */
    cookieOptions({ withMaxAge = true } = {}) {
      return {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        path: '/',
        ...(withMaxAge ? { maxAge: days() * 24 * 60 * 60 * 1000 } : {}),
      };
    },

    read(req) {
      return parseCookies(req.headers.cookie)[cookieName];
    },

    async create(ownerId) {
      const token = randomBytes(32).toString('base64url');
      await query(`DELETE FROM ${table} WHERE expires_at < now()`);
      await query(
        `INSERT INTO ${table} (token_hash, ${ownerColumn}, expires_at)
         VALUES ($1, $2, now() + make_interval(days => $3::int))`,
        [hashToken(token), ownerId, days()],
      );
      return token;
    },

    async destroy(token) {
      if (token) await query(`DELETE FROM ${table} WHERE token_hash = $1`, [hashToken(token)]);
    },
  };
}
