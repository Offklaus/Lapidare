/* Sessões da equipe: token aleatório no cookie httpOnly, só o hash SHA-256 dele no banco. */
import { createHash, randomBytes } from 'node:crypto';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { parseCookies } from './cookies.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'lp_staff';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/** Opções do cookie. SameSite=Lax: o navegador não manda o cookie em POST vindo de outro site. */
export function sessionCookieOptions({ withMaxAge = true } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    ...(withMaxAge ? { maxAge: config.staffSessionDays * 24 * 60 * 60 * 1000 } : {}),
  };
}

export const readSessionToken = (req) => parseCookies(req.headers.cookie)[SESSION_COOKIE];

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await query('DELETE FROM staff_sessions WHERE expires_at < now()');
  await query(
    `INSERT INTO staff_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [hashToken(token), userId, config.staffSessionDays],
  );
  return token;
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM staff_sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** O que o front recebe sobre a pessoa logada. */
export const publicStaff = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  professionalId: u.professional_id,
});

/** Middleware: exige sessão válida de conta ativa e coloca a pessoa em req.staff. */
export async function requireStaff(req, res, next) {
  const token = readSessionToken(req);
  if (!token) throw new HttpError(401, 'Entre com seu e-mail e senha para ver a agenda.');

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.professional_id
       FROM staff_sessions s
       JOIN staff_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [hashToken(token)],
  );
  if (!rows.length) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.');

  req.staff = rows[0];
  next();
}
