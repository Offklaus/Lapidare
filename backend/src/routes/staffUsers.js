/* Usuários da equipe (só admin) e a própria conta (qualquer pessoa da equipe).
   Montado em staff.js depois de requireStaff. Regras que o servidor garante, venha o que vier do front:
   - só admin convida, muda perfil, desativa, gera link de senha ou reinicia o 2FA;
   - no máximo MAX_ADMINS admins ativas; ninguém muda o próprio perfil nem se desativa (sem trancar o salão);
   - mudar perfil, desativar, redefinir senha ou reiniciar 2FA derruba as sessões da pessoa na hora;
   - links de senha valem 48 h, uma vez só; no banco fica só o hash;
   - tudo vai para o registro de ações (staff_audit_log), sem senha, token nem dados de clientes. */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { config } from '../config.js';
import { pool, query } from '../db/pool.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { checkPasswordStrength, hashPassword, verifyPassword } from '../lib/password.js';
import { rateLimit } from '../lib/rateLimit.js';
import { serviceSlug } from '../lib/serviceInput.js';
import { hashToken } from '../lib/sessions.js';
import { requireAdmin, revokeStaffSessions } from '../lib/staffAuth.js';

export const staffUsersRouter = Router();

const LINK_HOURS = 48;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'professional'];

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.professional_id, p.name AS professional_name, u.active,
         u.password_hash IS NOT NULL AS has_password, u.totp_enabled_at IS NOT NULL AS two_factor,
         u.last_login_at, u.created_at,
         (SELECT max(t.expires_at) FROM staff_tokens t
           WHERE t.user_id = u.id AND t.used_at IS NULL AND t.expires_at > now()) AS link_expires_at
    FROM staff_users u
    LEFT JOIN professionals p ON p.id = u.professional_id`;

/** Linha do banco → o que o painel mostra (nada de hash, token ou segredo). */
const toUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  professionalId: u.professional_id,
  professionalName: u.professional_name,
  active: u.active,
  status: !u.active ? 'inactive' : u.has_password ? 'active' : 'invited',
  twoFactor: u.two_factor,
  lastLoginAt: u.last_login_at,
  createdAt: u.created_at,
  linkExpiresAt: u.link_expires_at,
});

async function loadUser(id, db = { query }) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return rows[0] || null;
}

const parseUserId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Usuário não encontrado.');
  return id;
};

const cleanText = (value, min, max, message) => {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (text.length < min || text.length > max) throw new HttpError(400, message);
  return text;
};

/** Novo link de uso único (convite ou redefinição). Só um link válido por pessoa. → token (só agora) */
async function createLink(db, userId, purpose, createdBy) {
  const token = randomBytes(32).toString('base64url');
  await db.query('DELETE FROM staff_tokens WHERE user_id = $1', [userId]);
  await db.query(
    `INSERT INTO staff_tokens (token_hash, user_id, purpose, created_by, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5::int))`,
    [hashToken(token), userId, purpose, createdBy, LINK_HOURS],
  );
  return { token, purpose, expiresInHours: LINK_HOURS };
}

async function activeAdminCount(db, exceptId = null) {
  const { rows } = await db.query(
    "SELECT count(*)::int AS n FROM staff_users WHERE role = 'admin' AND active AND ($1::int IS NULL OR id <> $1)",
    [exceptId],
  );
  return rows[0].n;
}

/** A profissional existe, está ativa e não tem outra conta ativa ligada a ela. */
async function checkProfessionalFree(db, professionalId, exceptUserId = null) {
  const { rows } = await db.query('SELECT id FROM professionals WHERE id = $1 AND active', [professionalId]);
  if (!rows.length) throw new HttpError(400, 'Profissional não encontrada ou inativa.');
  const taken = await db.query(
    'SELECT 1 FROM staff_users WHERE professional_id = $1 AND active AND ($2::int IS NULL OR id <> $2)',
    [professionalId, exceptUserId],
  );
  if (taken.rowCount) throw new HttpError(409, 'Essa profissional já tem uma conta ativa.');
}

/** Cria o perfil de uma profissional nova (aparece no agendamento depois que a admin marcar os serviços). */
async function createProfessional(db, { name, role }) {
  const base = `pro-${serviceSlug(name)}`.slice(0, 60);
  const { rows: taken } = await db.query('SELECT id FROM professionals WHERE id = $1 OR id LIKE $2', [base, `${base}-%`]);
  let id = base;
  for (let n = 2; taken.some((r) => r.id === id); n += 1) id = `${base}-${n}`;
  await db.query(
    `INSERT INTO professionals (id, name, role, sort, active)
     VALUES ($1, $2, $3, (SELECT COALESCE(max(sort), 0) + 10 FROM professionals), true)`,
    [id, name, role],
  );
  return id;
}

/** Roda `fn(client)` numa transação; erros de unicidade viram mensagens claras. */
async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505' && err.constraint === 'staff_users_email_key') {
      throw new HttpError(409, 'Já existe uma conta com esse e-mail.');
    }
    if (err.code === '23505' && err.constraint === 'staff_users_professional_active_key') {
      throw new HttpError(409, 'Essa profissional já tem uma conta ativa.');
    }
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- Usuários (só admin) ---------- */

/** GET /staff/users → { users: [...], maxAdmins } */
staffUsersRouter.get('/users', requireAdmin, async (req, res) => {
  const { rows } = await query(`${USER_SELECT} ORDER BY u.active DESC, u.role, u.name`);
  res.json({ users: rows.map(toUser), maxAdmins: config.maxAdmins });
});

/**
 * POST /staff/users { name, email, role, professionalId? | newProfessional?: { name, role } }
 * → 201 { user, link: { token, purpose, expiresInHours } } — o link aparece só nesta resposta.
 */
staffUsersRouter.post('/users', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 2, 80, 'Escreva o nome da pessoa (2 a 80 caracteres).');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'Confira o e-mail.');
  if (!ROLES.includes(body.role)) throw new HttpError(400, 'Escolha o perfil: admin ou profissional.');

  const result = await inTransaction(async (db) => {
    let professionalId = null;
    if (body.role === 'admin') {
      if ((await activeAdminCount(db)) >= config.maxAdmins) {
        throw new HttpError(409, `Já existem ${config.maxAdmins} admins ativas. Desative uma antes de convidar outra.`);
      }
    } else if (body.newProfessional) {
      const proName = cleanText(
        body.newProfessional.name,
        2,
        60,
        'Escreva o nome da profissional como aparece para as clientes.',
      );
      const proRole = typeof body.newProfessional.role === 'string' ? body.newProfessional.role.trim().slice(0, 80) : '';
      professionalId = await createProfessional(db, { name: proName, role: proRole });
    } else {
      professionalId = typeof body.professionalId === 'string' ? body.professionalId : '';
      if (!professionalId) throw new HttpError(400, 'Escolha a profissional desta conta (ou cadastre uma nova).');
      await checkProfessionalFree(db, professionalId);
    }

    const { rows } = await db.query(
      `INSERT INTO staff_users (email, name, password_hash, role, professional_id, created_by)
       VALUES ($1, $2, NULL, $3, $4, $5) RETURNING id`,
      [email, name, body.role, professionalId, req.staff.id],
    );
    const id = rows[0].id;
    const link = await createLink(db, id, 'invite', req.staff.id);
    await audit(
      { actorId: req.staff.id, action: 'user_invited', targetUserId: id, details: { role: body.role, professionalId } },
      db,
    );
    return { id, link };
  });

  res.status(201).json({ user: toUser(await loadUser(result.id)), link: result.link });
});

/**
 * PATCH /staff/users/:id { name?, role?, professionalId?, active? } → { user }
 * Mudança de perfil, de profissional ou desativação derruba as sessões da pessoa.
 */
staffUsersRouter.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);
  const body = req.body || {};

  await inTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM staff_users WHERE id = $1 FOR UPDATE', [id]);
    const current = rows[0];
    if (!current) throw new HttpError(404, 'Usuário não encontrado.');

    const name = body.name === undefined ? current.name : cleanText(body.name, 2, 80, 'Escreva o nome (2 a 80 caracteres).');
    const role = body.role === undefined ? current.role : body.role;
    if (!ROLES.includes(role)) throw new HttpError(400, 'Perfil inválido.');
    if (body.active !== undefined && typeof body.active !== 'boolean') throw new HttpError(400, 'active deve ser true ou false.');
    const active = body.active === undefined ? current.active : body.active;
    let professionalId = role === 'admin' ? null : (body.professionalId ?? current.professional_id);

    const isSelf = id === req.staff.id;
    if (isSelf && (role !== current.role || active !== current.active)) {
      throw new HttpError(400, 'Você não pode mudar o próprio perfil nem desativar a própria conta. Peça a outra admin.');
    }

    // Vai virar admin ativa: respeita o limite.
    const becomesActiveAdmin = role === 'admin' && active && !(current.role === 'admin' && current.active);
    if (becomesActiveAdmin && (await activeAdminCount(db, id)) >= config.maxAdmins) {
      throw new HttpError(409, `Já existem ${config.maxAdmins} admins ativas. Desative uma antes.`);
    }
    // Deixa de ser admin ativa: precisa sobrar pelo menos uma.
    const losesAdmin = current.role === 'admin' && current.active && !(role === 'admin' && active);
    if (losesAdmin && (await activeAdminCount(db, id)) < 1) {
      throw new HttpError(409, 'O salão precisa de pelo menos uma admin ativa.');
    }
    if (role === 'professional') {
      if (typeof professionalId !== 'string' || !professionalId) {
        throw new HttpError(400, 'Escolha a profissional desta conta.');
      }
      if (active) await checkProfessionalFree(db, professionalId, id);
    }
    professionalId = role === 'professional' ? professionalId : null;

    await db.query(
      `UPDATE staff_users
          SET name = $2, role = $3, professional_id = $4, active = $5, updated_at = now(),
              -- deixou de ser admin: o 2FA sai junto (cadastra de novo se um dia voltar a ser admin)
              totp_secret_enc = CASE WHEN $3 = 'admin' THEN totp_secret_enc END,
              totp_enabled_at = CASE WHEN $3 = 'admin' THEN totp_enabled_at END,
              totp_last_step  = CASE WHEN $3 = 'admin' THEN totp_last_step END
        WHERE id = $1`,
      [id, name, role, professionalId, active],
    );

    const accessChanged =
      role !== current.role || active !== current.active || professionalId !== current.professional_id;
    if (accessChanged) {
      await revokeStaffSessions(id, { db });
      if (!active) await db.query('DELETE FROM staff_tokens WHERE user_id = $1', [id]);
    }
    const details = {};
    if (role !== current.role) Object.assign(details, { from: current.role, to: role });
    if (active !== current.active) details.active = active;
    if (professionalId !== current.professional_id) details.professionalId = professionalId;
    await audit({ actorId: req.staff.id, action: 'user_updated', targetUserId: id, details }, db);
  });

  res.json({ user: toUser(await loadUser(id)) });
});

/**
 * POST /staff/users/:id/link → { user, link: { token, purpose, expiresInHours } }
 * Convite de novo (quem ainda não criou senha) ou redefinição de senha (a senha atual deixa de valer e as
 * sessões caem na hora). Não vale para a própria conta: para isso existe "Minha conta".
 */
staffUsersRouter.post('/users/:id/link', requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);
  if (id === req.staff.id) throw new HttpError(400, 'Para trocar a sua senha, use "Minha conta".');

  const link = await inTransaction(async (db) => {
    const { rows } = await db.query('SELECT id, active, password_hash FROM staff_users WHERE id = $1 FOR UPDATE', [id]);
    const user = rows[0];
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');
    if (!user.active) throw new HttpError(409, 'Esta conta está desativada. Reative antes de gerar um link.');

    const purpose = user.password_hash ? 'reset' : 'invite';
    if (purpose === 'reset') {
      await db.query('UPDATE staff_users SET password_hash = NULL, updated_at = now() WHERE id = $1', [id]);
      await revokeStaffSessions(id, { db });
    }
    const created = await createLink(db, id, purpose, req.staff.id);
    await audit(
      { actorId: req.staff.id, action: purpose === 'invite' ? 'invite_resent' : 'password_reset_link', targetUserId: id },
      db,
    );
    return created;
  });

  res.json({ user: toUser(await loadUser(id)), link });
});

/** POST /staff/users/:id/reset-2fa → { user } — a admin cadastra o app de novo no próximo login. */
staffUsersRouter.post('/users/:id/reset-2fa', requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);
  if (id === req.staff.id) throw new HttpError(400, 'Peça a outra admin para reiniciar o seu 2FA.');

  await inTransaction(async (db) => {
    const { rows } = await db.query('SELECT role FROM staff_users WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'Usuário não encontrado.');
    if (rows[0].role !== 'admin') throw new HttpError(400, 'Só contas admin usam o app autenticador.');
    await db.query(
      `UPDATE staff_users SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL, updated_at = now()
        WHERE id = $1`,
      [id],
    );
    await revokeStaffSessions(id, { db });
    await audit({ actorId: req.staff.id, action: '2fa_reset', targetUserId: id }, db);
  });

  res.json({ user: toUser(await loadUser(id)) });
});

/** DELETE /staff/users/:id → 204 — só convites que nunca viraram conta (quem já entrou é desativado, não apagado). */
staffUsersRouter.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = parseUserId(req.params.id);
  if (id === req.staff.id) throw new HttpError(400, 'Você não pode excluir a própria conta.');

  await inTransaction(async (db) => {
    const { rows } = await db.query('SELECT password_hash, last_login_at FROM staff_users WHERE id = $1 FOR UPDATE', [id]);
    const user = rows[0];
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');
    if (user.password_hash || user.last_login_at) {
      throw new HttpError(409, 'Esta conta já foi usada: desative em vez de excluir (o histórico continua).');
    }
    const used = await db.query(
      'SELECT 1 FROM bookings WHERE updated_by_staff_id = $1 OR created_by_staff_id = $1 LIMIT 1',
      [id],
    );
    if (used.rowCount) throw new HttpError(409, 'Esta conta já mexeu em agendamentos: desative em vez de excluir.');
    await audit({ actorId: req.staff.id, action: 'invite_deleted', targetUserId: id }, db);
    await db.query('DELETE FROM staff_users WHERE id = $1', [id]);
  });

  res.status(204).end();
});

/** GET /staff/audit → últimas 100 ações sobre contas: { entries: [{ id, action, actor, target, details, at }] } */
staffUsersRouter.get('/audit', requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT l.id, l.action, l.details, l.created_at, a.name AS actor_name, t.name AS target_name
       FROM staff_audit_log l
       LEFT JOIN staff_users a ON a.id = l.actor_id
       LEFT JOIN staff_users t ON t.id = l.target_user_id
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 100`,
  );
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor_name,
      target: r.target_name,
      details: r.details,
      at: r.created_at,
    })),
  });
});

/* ---------- Minha conta (qualquer pessoa da equipe) ---------- */

/**
 * PUT /staff/account/password { currentPassword, newPassword } → 204
 * Confere a senha atual; as outras sessões da pessoa caem (esta continua).
 */
staffUsersRouter.put(
  '/account/password',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    key: (req) => `pwd:${req.staff.id}`,
    message: 'Muitas tentativas. Espere 15 minutos.',
  }),
  async (req, res) => {
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const { rows } = await query('SELECT password_hash FROM staff_users WHERE id = $1', [req.staff.id]);
    if (!(await verifyPassword(current, rows[0]?.password_hash))) throw new HttpError(400, 'A senha atual não confere.');
    if (current === next) throw new HttpError(400, 'A nova senha precisa ser diferente da atual.');
    const weak = checkPasswordStrength(next, { email: req.staff.email, name: req.staff.name });
    if (weak) throw new HttpError(400, weak);

    await inTransaction(async (db) => {
      await db.query(
        'UPDATE staff_users SET password_hash = $2, password_changed_at = now(), updated_at = now() WHERE id = $1',
        [req.staff.id, await hashPassword(next)],
      );
      await revokeStaffSessions(req.staff.id, { keepToken: req.staffToken, db });
      await audit({ actorId: req.staff.id, action: 'password_changed', targetUserId: req.staff.id }, db);
    });
    res.status(204).end();
  },
);
