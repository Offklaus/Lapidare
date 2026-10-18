/* Sessões da equipe (cookie lp_staff, tabela staff_sessions) e quem pode o quê.
   admin: área da equipe inteira + usuários · professional: só a própria agenda. */
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from './errors.js';
import { hashToken, sessionStore } from './sessions.js';

const store = sessionStore({
  table: 'staff_sessions',
  ownerColumn: 'user_id',
  cookieName: 'lp_staff',
  days: () => config.staffSessionDays,
  sameSite: 'strict',
});

export const SESSION_COOKIE = store.cookieName;
export const sessionCookieOptions = store.cookieOptions;
export const readSessionToken = store.read;
export const destroySession = store.destroy;

/** Duração da sessão: admin (dados de todas as clientes) fica pouco tempo logada. */
export const sessionMinutes = (role) =>
  role === 'admin' ? config.staffAdminSessionHours * 60 : config.staffSessionDays * 24 * 60;

/** Cria a sessão e grava o cookie. */
export async function startSession(res, user) {
  const minutes = sessionMinutes(user.role);
  const token = await store.create(user.id, { minutes });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions({ minutes }));
  await query('UPDATE staff_users SET last_login_at = now() WHERE id = $1', [user.id]);
}

/**
 * Derruba as sessões e as etapas de login em andamento da pessoa (perfil trocado, conta desativada,
 * senha redefinida, 2FA reiniciado). keepToken: mantém a sessão de quem está trocando a própria senha.
 */
export async function revokeStaffSessions(userId, { keepToken = null, db = { query } } = {}) {
  await store.destroyAll(userId, { keepToken, db });
  await db.query('DELETE FROM staff_login_challenges WHERE user_id = $1', [userId]);
}

/** O que o front recebe sobre a pessoa logada. */
export const publicStaff = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  professionalId: u.professional_id,
  twoFactor: Boolean(u.totp_enabled_at),
});

/** Middleware: exige sessão válida de conta ativa e coloca a pessoa em req.staff. */
export async function requireStaff(req, res, next) {
  const token = readSessionToken(req);
  if (!token) throw new HttpError(401, 'Entre com seu e-mail e senha para ver a agenda.');

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.professional_id, u.totp_enabled_at
       FROM staff_sessions s
       JOIN staff_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active AND u.password_hash IS NOT NULL`,
    [hashToken(token)],
  );
  if (!rows.length) throw new HttpError(401, 'Sua sessão expirou. Entre de novo.');

  req.staff = rows[0];
  req.staffToken = token;
  next();
}

/** Middleware (depois de requireStaff): só perfil admin passa. */
export function requireAdmin(req, res, next) {
  if (req.staff?.role !== 'admin') throw new HttpError(403, 'Só a conta admin pode fazer isso.');
  next();
}
