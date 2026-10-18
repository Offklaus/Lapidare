/* Entrada da equipe (sem sessão): login, verificação em duas etapas da admin, saída e criação de senha
   pelo link de convite. Montado em staff.js antes de requireStaff.
   Mensagens de erro iguais para "e-mail não existe" e "senha errada": ninguém descobre quem tem conta. */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { pool, query } from '../db/pool.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { MAX_PASSWORD_LENGTH, checkPasswordStrength, hashPassword, verifyPassword } from '../lib/password.js';
import { rateLimit } from '../lib/rateLimit.js';
import { hasSecretKey, open, seal } from '../lib/secretBox.js';
import { hashToken } from '../lib/sessions.js';
import {
  SESSION_COOKIE,
  destroySession,
  publicStaff,
  readSessionToken,
  revokeStaffSessions,
  sessionCookieOptions,
  startSession,
} from '../lib/staffAuth.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../lib/totp.js';

export const staffLoginRouter = Router();

// Com e-mail inexistente ainda roda o scrypt (contra este hash), para a resposta levar o mesmo tempo.
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

const WRONG_LOGIN = 'E-mail ou senha incorretos.';
const CHALLENGE_MINUTES = 5;
const MAX_CODE_ATTEMPTS = 5;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
const LINK_GONE = 'Este link não vale mais (já foi usado ou passou do prazo). Peça um novo para a administração do salão.';

/* ---------- Login ---------- */

/**
 * POST /staff/login { email, password }
 * Profissional → { user } + cookie de sessão.
 * Admin → { twoFactor: 'verify', challenge } (pede o código do app) ou, se ainda não cadastrou o app,
 * { twoFactor: 'enroll', challenge, secret, otpauthUrl } (QR code para cadastrar). Sessão só depois do código.
 */
staffLoginRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas de login. Espere alguns minutos.' }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    key: (req) => `login:${String(req.body?.email || '').trim().toLowerCase()}`,
    message: 'Muitas tentativas para este e-mail. Espere 15 minutos e tente de novo.',
  }),
  async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw new HttpError(400, 'Informe e-mail e senha.');
    if (email.length > 200 || password.length > MAX_PASSWORD_LENGTH) throw new HttpError(401, WRONG_LOGIN);

    const { rows } = await query(
      `SELECT id, name, email, role, professional_id, password_hash, totp_enabled_at
         FROM staff_users WHERE email = $1 AND active`,
      [email],
    );
    const user = rows[0];
    const ok = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !user.password_hash || !ok) throw new HttpError(401, WRONG_LOGIN);

    if (user.role !== 'admin') {
      await startSession(res, user);
      return res.json({ user: publicStaff(user) });
    }

    // Admin: senha certa ainda não basta. Sem APP_SECRET não dá para guardar o 2FA com segurança.
    if (!hasSecretKey()) {
      console.error('APP_SECRET não configurado: login de admin bloqueado até configurar.');
      throw new HttpError(503, 'O login de admin está indisponível: falta configurar a chave de segurança no servidor.');
    }

    const challenge = randomBytes(32).toString('base64url');
    const enrolling = !user.totp_enabled_at;
    const secret = enrolling ? generateSecret() : null;
    await query('DELETE FROM staff_login_challenges WHERE user_id = $1 OR expires_at < now()', [user.id]);
    await query(
      `INSERT INTO staff_login_challenges (token_hash, user_id, pending_secret_enc, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4::int))`,
      [hashToken(challenge), user.id, secret ? seal(secret) : null, CHALLENGE_MINUTES],
    );

    if (!enrolling) return res.json({ twoFactor: 'verify', challenge });
    return res.json({ twoFactor: 'enroll', challenge, secret, otpauthUrl: otpauthUrl({ secret, account: user.email }) });
  },
);

/**
 * POST /staff/login/2fa { challenge, code } → { user } + cookie de sessão.
 * Confere o código do app (ou confirma o cadastro do app). 5 erros = volta para a senha.
 */
staffLoginRouter.post(
  '/login/2fa',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas. Espere alguns minutos.' }),
  async (req, res) => {
    const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const expired = 'Sua etapa de login expirou. Entre com e-mail e senha de novo.';
    if (!TOKEN_RE.test(challenge)) throw new HttpError(401, expired);

    let user;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT c.attempts, c.pending_secret_enc,
                u.id, u.name, u.email, u.role, u.professional_id,
                u.totp_enabled_at, u.totp_secret_enc, u.totp_last_step
           FROM staff_login_challenges c
           JOIN staff_users u ON u.id = c.user_id
          WHERE c.token_hash = $1 AND c.expires_at > now() AND u.active AND u.role = 'admin'
            FOR UPDATE OF c, u`,
        [hashToken(challenge)],
      );
      const row = rows[0];
      if (!row) throw new HttpError(401, expired);

      const enrolling = !row.totp_enabled_at;
      const sealed = enrolling ? row.pending_secret_enc : row.totp_secret_enc;
      let step = null;
      try {
        step = sealed ? verifyTotp(open(sealed), code, { afterStep: row.totp_last_step }) : null;
      } catch {
        step = null; // segredo ilegível (chave trocada): trata como código errado
      }

      if (step === null) {
        const attempts = row.attempts + 1;
        if (attempts >= MAX_CODE_ATTEMPTS) {
          await client.query('DELETE FROM staff_login_challenges WHERE token_hash = $1', [hashToken(challenge)]);
        } else {
          await client.query('UPDATE staff_login_challenges SET attempts = $2 WHERE token_hash = $1', [
            hashToken(challenge),
            attempts,
          ]);
        }
        await client.query('COMMIT');
        throw new HttpError(
          401,
          attempts >= MAX_CODE_ATTEMPTS
            ? 'Muitos códigos errados. Entre com e-mail e senha de novo.'
            : 'Código incorreto. Confira o app autenticador e tente de novo.',
        );
      }

      if (enrolling) {
        await client.query(
          `UPDATE staff_users
              SET totp_secret_enc = $2, totp_enabled_at = now(), totp_last_step = $3, updated_at = now()
            WHERE id = $1`,
          [row.id, row.pending_secret_enc, step],
        );
        await audit({ actorId: row.id, action: '2fa_enabled', targetUserId: row.id }, client);
      } else {
        await client.query('UPDATE staff_users SET totp_last_step = $2 WHERE id = $1', [row.id, step]);
      }
      await client.query('DELETE FROM staff_login_challenges WHERE user_id = $1', [row.id]);
      await client.query('COMMIT');
      user = { ...row, totp_enabled_at: row.totp_enabled_at || new Date() };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    await startSession(res, user);
    res.json({ user: publicStaff(user) });
  },
);

staffLoginRouter.post('/logout', async (req, res) => {
  await destroySession(readSessionToken(req));
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions({ withMaxAge: false }));
  res.status(204).end();
});

/* ---------- Link de convite / redefinição de senha ---------- */

const linkLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Muitas tentativas. Espere alguns minutos.',
});

async function findLink(token, db = { query }, lock = false) {
  if (!TOKEN_RE.test(token)) return null;
  const { rows } = await db.query(
    `SELECT t.token_hash, t.purpose, u.id, u.name, u.email, u.role, u.totp_enabled_at
       FROM staff_tokens t
       JOIN staff_users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND u.active
      ${lock ? 'FOR UPDATE OF t' : ''}`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

/** GET /staff/invites/:token → { name, email, role, purpose } — para a tela "Crie sua senha". */
staffLoginRouter.get('/invites/:token', linkLimit, async (req, res) => {
  const link = await findLink(req.params.token);
  if (!link) throw new HttpError(404, LINK_GONE);
  res.json({ name: link.name, email: link.email, role: link.role, purpose: link.purpose });
});

/**
 * POST /staff/invites/:token { password } → { ok, role, needs2fa }
 * Cria (ou redefine) a senha. O link vale uma vez só; sessões antigas da pessoa caem.
 */
staffLoginRouter.post('/invites/:token', linkLimit, async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const client = await pool.connect();
  let link;
  try {
    await client.query('BEGIN');
    link = await findLink(req.params.token, client, true);
    if (!link) throw new HttpError(404, LINK_GONE);

    const weak = checkPasswordStrength(password, { email: link.email, name: link.name });
    if (weak) throw new HttpError(400, weak);

    await client.query(
      'UPDATE staff_users SET password_hash = $2, password_changed_at = now(), updated_at = now() WHERE id = $1',
      [link.id, await hashPassword(password)],
    );
    await client.query('DELETE FROM staff_tokens WHERE user_id = $1', [link.id]);
    await revokeStaffSessions(link.id, { db: client });
    await audit(
      {
        actorId: link.id,
        action: link.purpose === 'invite' ? 'invite_accepted' : 'password_reset_done',
        targetUserId: link.id,
      },
      client,
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true, role: link.role, needs2fa: link.role === 'admin' && !link.totp_enabled_at });
});
