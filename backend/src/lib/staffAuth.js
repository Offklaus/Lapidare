/* Sessões da equipe (cookie lp_staff, tabela staff_sessions). */
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from './errors.js';
import { hashToken, sessionStore } from './sessions.js';

const store = sessionStore({
  table: 'staff_sessions',
  ownerColumn: 'user_id',
  cookieName: 'lp_staff',
  days: () => config.staffSessionDays,
});

export const SESSION_COOKIE = store.cookieName;
export const sessionCookieOptions = store.cookieOptions;
export const readSessionToken = store.read;
export const createSession = store.create;
export const destroySession = store.destroy;

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

/** Middleware (depois de requireStaff): só perfil admin passa. */
export function requireAdmin(req, res, next) {
  if (req.staff?.role !== 'admin') throw new HttpError(403, 'Só a conta admin pode fazer isso.');
  next();
}
