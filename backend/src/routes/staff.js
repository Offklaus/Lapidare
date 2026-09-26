import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { formatCode } from '../lib/bookingCode.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { rateLimit } from '../lib/rateLimit.js';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  publicStaff,
  readSessionToken,
  requireStaff,
  sessionCookieOptions,
} from '../lib/staffAuth.js';
import { dayNumber } from '../lib/time.js';
import { parseDate, parseId } from '../lib/validate.js';

export const staffRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = ['pending', 'confirmed'];

// Com e-mail inexistente ainda roda o scrypt (contra este hash), para a resposta levar o mesmo tempo.
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

/* ---------- Login / logout ---------- */

staffRouter.post(
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

    const { rows } = await query(
      'SELECT id, name, email, role, professional_id, password_hash FROM staff_users WHERE email = $1 AND active',
      [email],
    );
    const user = rows[0];
    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'E-mail ou senha incorretos.');

    const token = await createSession(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.json({ user: publicStaff(user) });
  },
);

staffRouter.post('/logout', async (req, res) => {
  await destroySession(readSessionToken(req));
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions({ withMaxAge: false }));
  res.status(204).end();
});

/* ---------- Daqui para baixo, só com sessão ---------- */

staffRouter.use(requireStaff);

staffRouter.get('/me', (req, res) => {
  res.json({ user: publicStaff(req.staff) });
});

const STAFF_BOOKING_SELECT = `
  SELECT b.id, b.code, b.status, b.cancelled_by,
         to_char(b.starts_at AT TIME ZONE $1, 'YYYY-MM-DD') AS date,
         to_char(b.starts_at AT TIME ZONE $1, 'HH24:MI') AS time,
         to_char(b.ends_at AT TIME ZONE $1, 'HH24:MI') AS end_time,
         b.starts_at <= now() AS started,
         to_char(b.confirmation_sent_at AT TIME ZONE $1, 'YYYY-MM-DD"T"HH24:MI') AS confirmation_sent_at,
         b.customer_name, b.customer_phone, b.customer_email,
         s.name AS service_name, s.duration_min, s.price_cents,
         p.id AS professional_id, p.name AS professional_name
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    JOIN professionals p ON p.id = b.professional_id`;

/** Linha do banco → formato do painel, com as ações permitidas já calculadas. */
function toStaffBooking(b) {
  const active = ACTIVE.includes(b.status);
  return {
    id: b.id,
    code: formatCode(b.code),
    status: b.status,
    cancelledBy: b.cancelled_by,
    date: b.date,
    time: b.time,
    endTime: b.end_time,
    started: b.started,
    confirmationSentAt: b.confirmation_sent_at, // 'YYYY-MM-DDTHH:MM' no fuso do salão, ou null
    customer: { name: b.customer_name, phone: b.customer_phone, email: b.customer_email },
    service: { name: b.service_name, duration: b.duration_min, price: b.price_cents / 100 },
    professional: { id: b.professional_id, name: b.professional_name },
    actions: {
      cancel: active && !b.started,
      done: (active || b.status === 'no_show') && b.started,
      noShow: (active || b.status === 'done') && b.started,
      sendConfirmation: active,
    },
  };
}

/** Profissional só enxerga a própria agenda, venha o que vier na requisição. */
function scopeProfessional(req, requested) {
  if (req.staff.role === 'professional') return req.staff.professional_id;
  if (!requested || requested === 'all') return null;
  return parseId(requested, 'professionalId', 'a profissional');
}

/**
 * GET /staff/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&professionalId=|all
 * → { from, to, bookings: [...] } — inclui telefone e e-mail da cliente (só para a equipe).
 */
staffRouter.get('/bookings', async (req, res) => {
  const from = parseDate(req.query.from, 'from');
  const to = req.query.to ? parseDate(req.query.to, 'to') : from;
  if (to < from) throw new HttpError(400, 'A data final vem antes da inicial.');
  if (dayNumber(to) - dayNumber(from) > 30) throw new HttpError(400, 'Escolha um período de até 31 dias.');
  const professionalId = scopeProfessional(req, req.query.professionalId);

  const { rows } = await query(
    `${STAFF_BOOKING_SELECT}
      WHERE b.starts_at >= ($2::date::timestamp AT TIME ZONE $1)
        AND b.starts_at < (($3::date + 1)::timestamp AT TIME ZONE $1)
        AND ($4::text IS NULL OR b.professional_id = $4)
      ORDER BY b.starts_at, p.sort, p.name`,
    [config.timezone, from, to, professionalId],
  );

  // cancelMinHours vai junto para a mensagem de confirmação citar o prazo certo de cancelamento.
  res.json({ from, to, cancelMinHours: config.cancelMinHours, bookings: rows.map(toStaffBooking) });
});

/** Em qual situação cada mudança de status é permitida. */
const STATUS_RULES = {
  cancelled: `status IN ('pending', 'confirmed') AND starts_at > now()`,
  done: `status IN ('pending', 'confirmed', 'no_show') AND starts_at <= now()`,
  no_show: `status IN ('pending', 'confirmed', 'done') AND starts_at <= now()`,
};

/**
 * PATCH /staff/bookings/:id/status  { status: 'done' | 'no_show' | 'cancelled' }
 * → 200 com o agendamento atualizado · 404 não existe (ou é de outra profissional) · 409 mudança não permitida agora
 */
staffRouter.patch('/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Agendamento não encontrado.');

  const status = req.body?.status;
  if (!Object.hasOwn(STATUS_RULES, status)) {
    throw new HttpError(400, 'Status inválido. Use done, no_show ou cancelled.');
  }
  const own = req.staff.role === 'professional' ? req.staff.professional_id : null;

  const { rowCount } = await query(
    `UPDATE bookings
        SET status = $2::text,
            updated_by_staff_id = $3,
            cancelled_at = CASE WHEN $2::text = 'cancelled' THEN now() ELSE cancelled_at END,
            cancelled_by = CASE WHEN $2::text = 'cancelled' THEN 'staff' ELSE cancelled_by END
      WHERE id = $1
        AND ($4::text IS NULL OR professional_id = $4)
        AND ${STATUS_RULES[status]}`,
    [id, status, req.staff.id, own],
  );

  if (!rowCount) {
    const { rows } = await query(
      'SELECT status, professional_id, starts_at <= now() AS started FROM bookings WHERE id = $1',
      [id],
    );
    const b = rows[0];
    // De outra profissional: responde como se não existisse.
    if (!b || (own && b.professional_id !== own)) throw new HttpError(404, 'Agendamento não encontrado.');
    if (b.status === 'cancelled') throw new HttpError(409, 'Este agendamento foi cancelado e não pode mudar de status.');
    if (status === 'cancelled') {
      throw new HttpError(409, 'Esse atendimento já começou. Marque como concluído ou como falta.');
    }
    throw new HttpError(409, 'Só dá para marcar concluído ou falta depois que o horário começar.');
  }

  const { rows } = await query(`${STAFF_BOOKING_SELECT} WHERE b.id = $2`, [config.timezone, id]);
  res.json(toStaffBooking(rows[0]));
});

/**
 * POST /staff/bookings/:id/confirmation-sent
 * A equipe clicou em "Enviar confirmação" (link wa.me): registra quando e quem. Pode repetir (reenvio).
 * → 200 com o agendamento atualizado · 404 não existe (ou é de outra profissional) · 409 não está mais ativo
 */
staffRouter.post('/bookings/:id/confirmation-sent', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Agendamento não encontrado.');
  const own = req.staff.role === 'professional' ? req.staff.professional_id : null;

  const { rowCount } = await query(
    `UPDATE bookings
        SET confirmation_sent_at = now(), confirmation_sent_by = $2
      WHERE id = $1
        AND ($3::text IS NULL OR professional_id = $3)
        AND status IN ('pending', 'confirmed')`,
    [id, req.staff.id, own],
  );

  if (!rowCount) {
    const { rows } = await query('SELECT professional_id FROM bookings WHERE id = $1', [id]);
    if (!rows.length || (own && rows[0].professional_id !== own)) throw new HttpError(404, 'Agendamento não encontrado.');
    throw new HttpError(409, 'Este agendamento não está mais ativo.');
  }

  const { rows } = await query(`${STAFF_BOOKING_SELECT} WHERE b.id = $2`, [config.timezone, id]);
  res.json(toStaffBooking(rows[0]));
});
