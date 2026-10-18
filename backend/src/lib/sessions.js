/* Sessões por cookie, reaproveitadas pela equipe e pelas clientes (cada uma com tabela e cookie próprios).
   O token aleatório fica só no cookie httpOnly; no banco guardamos o hash SHA-256 dele. */
import { createHash, randomBytes } from 'node:crypto';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { parseCookies } from './cookies.js';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * table: tabela de sessões · ownerColumn: coluna do dono (user_id, customer_id)
 * cookieName: nome do cookie · days(): duração padrão em dias (lida na hora, vem da config)
 * sameSite: 'lax' (cliente: volta do login com Google) ou 'strict' (equipe: o cookie nunca sai em
 * pedidos iniciados por outro site).
 */
export function sessionStore({ table, ownerColumn, cookieName, days, sameSite = 'lax' }) {
  const defaultMinutes = () => days() * 24 * 60;

  return {
    cookieName,

    /** minutes: duração desta sessão (o cookie vence junto com ela no banco). */
    cookieOptions({ withMaxAge = true, minutes = defaultMinutes() } = {}) {
      return {
        httpOnly: true,
        sameSite,
        secure: config.isProduction,
        path: '/',
        ...(withMaxAge ? { maxAge: minutes * 60 * 1000 } : {}),
      };
    },

    read(req) {
      return parseCookies(req.headers.cookie)[cookieName];
    },

    async create(ownerId, { minutes = defaultMinutes() } = {}) {
      const token = randomBytes(32).toString('base64url');
      await query(`DELETE FROM ${table} WHERE expires_at < now()`);
      await query(
        `INSERT INTO ${table} (token_hash, ${ownerColumn}, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3::int))`,
        [hashToken(token), ownerId, minutes],
      );
      return token;
    },

    async destroy(token) {
      if (token) await query(`DELETE FROM ${table} WHERE token_hash = $1`, [hashToken(token)]);
    },

    /** Encerra todas as sessões do dono (menos a `keepToken`, se informada). */
    async destroyAll(ownerId, { keepToken = null, db = { query } } = {}) {
      await db.query(`DELETE FROM ${table} WHERE ${ownerColumn} = $1 AND ($2::text IS NULL OR token_hash <> $2)`, [
        ownerId,
        keepToken ? hashToken(keepToken) : null,
      ]);
    },
  };
}
