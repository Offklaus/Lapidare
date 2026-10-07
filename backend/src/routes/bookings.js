import { Router } from 'express';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { formatCode, normalizeCode } from '../lib/bookingCode.js';
import { findCustomer } from '../lib/customerAuth.js';
import { HttpError } from '../lib/errors.js';
import { rateLimit } from '../lib/rateLimit.js';
import { dayNumber } from '../lib/time.js';
import { parseCustomer, parseDate, parseProfessionalId, parseServiceIds, parseTime } from '../lib/validate.js';
import { BOOKING_SERVICES_SQL, bookingServicesView } from '../services/bookingServices.js';
import { TAKEN, findSlot, insertBooking, upsertClient } from '../services/createBooking.js';
import { loadSchedule } from '../services/schedule.js';

export const bookingsRouter = Router();

const NOT_FOUND = 'Não encontramos agendamento com esse código. Confira as letras e os números.';

/**
 * Agendamento como a cliente vê: sem telefone, e-mail ou sobrenome (quem tem o código vê a página).
 * cancellation.allowed = ativo e ainda dentro do prazo de CANCEL_MIN_HOURS antes do horário.
 */
async function findPublicBooking(code) {
  const { rows } = await query(
    `SELECT b.code, b.status, b.customer_name,
            to_char(b.starts_at AT TIME ZONE $2, 'YYYY-MM-DD') AS date,
            to_char(b.starts_at AT TIME ZONE $2, 'HH24:MI') AS time,
            b.ends_at < now() AS is_past,
            (b.status IN ('pending', 'confirmed') AND now() <= b.starts_at - make_interval(hours => $3::int)) AS can_cancel,
            to_char((b.starts_at - make_interval(hours => $3::int)) AT TIME ZONE $2, 'YYYY-MM-DD"T"HH24:MI') AS cancel_until,
            s.name AS service_name, b.price_cents, -- preço e duração do momento do agendamento
            (EXTRACT(EPOCH FROM b.ends_at - b.starts_at) / 60)::int AS duration_min,
            p.name AS professional_name,
            ${BOOKING_SERVICES_SQL}
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN professionals p ON p.id = b.professional_id
      WHERE b.code = $1`,
    [code, config.timezone, config.cancelMinHours],
  );
  if (!rows.length) return null;

  const b = rows[0];
  return {
    code: formatCode(b.code),
    status: b.status,
    date: b.date,
    time: b.time,
    isPast: b.is_past,
    customerFirstName: b.customer_name.split(/\s+/)[0],
    ...bookingServicesView(b), // service (resumo) + services (cada parte, com o horário)
    professional: { name: b.professional_name },
    cancellation: {
      allowed: b.can_cancel,
      deadline: { date: b.cancel_until.slice(0, 10), time: b.cancel_until.slice(11, 16) },
      minHours: config.cancelMinHours,
    },
  };
}

/**
 * POST /bookings
 * { serviceIds: ['manicure', 'pedicure'] (ou serviceId), professionalId | 'any', date: 'YYYY-MM-DD', time: 'HH:MM',
 *   customer: { name, phone, email? } } — vários serviços são feitos em sequência pela mesma profissional.
 * → 201 { id, code, status, professionalId } · 409 se o horário não está mais livre
 */
// Contra agendamentos falsos em massa: poucos agendamentos por hora vindos do mesmo endereço.
const createLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Muitos agendamentos seguidos. Tente de novo mais tarde ou fale com o salão.',
});

bookingsRouter.post('/', createLimit, async (req, res) => {
  const body = req.body || {};
  const serviceIds = parseServiceIds(body);
  const professionalId = parseProfessionalId(body.professionalId);
  const date = parseDate(body.date, 'date');
  const time = parseTime(body.time);
  const customer = parseCustomer(body.customer);

  // Confere com a mesma regra que gerou os horários mostrados para a cliente.
  const { service, pros, nowAbs } = await loadSchedule({ serviceIds, professionalId, from: date, to: date });
  if (dayNumber(date) > Math.floor(nowAbs / 1440) + config.bookingMaxDaysAhead) {
    throw new HttpError(400, `Agendamentos podem ser feitos até ${config.bookingMaxDaysAhead} dias à frente.`);
  }

  // Um mesmo WhatsApp não segura a agenda: no máximo N horários futuros marcados.
  const { rows: active } = await query(
    `SELECT count(*)::int AS n FROM bookings
      WHERE customer_phone = $1 AND status IN ('pending', 'confirmed') AND starts_at > now()`,
    [customer.phone],
  );
  if (active[0].n >= config.bookingMaxActivePerPhone) {
    throw new HttpError(
      409,
      `Este WhatsApp já tem ${active[0].n} agendamentos marcados. Para marcar mais, fale com o salão.`,
    );
  }
  const slot = findSlot({ service, pros, date, time, nowAbs });
  if (!slot) throw new HttpError(400, 'Esse horário não faz parte do expediente. Escolha um dos horários da lista.');
  if (slot.status !== 'available') throw new HttpError(409, TAKEN);

  // Cliente logada (login com Google): a reserva fica ligada à conta e aparece em "Minhas reservas".
  const account = await findCustomer(req);

  try {
    // Cadastro da cliente pelo WhatsApp (o mesmo que a recepção usa no painel); não duplica.
    const client = await upsertClient(customer);
    const booking = await insertBooking({
      serviceId: service.id,
      professionalId: slot.professionalId,
      date,
      time,
      duration: service.duration,
      customer,
      customerAccountId: account?.id ?? null,
      priceCents: service.priceCents,
      items: service.items,
      clientId: client.id,
    });
    res.status(201).json({
      id: booking.id,
      code: formatCode(booking.code),
      status: booking.status,
      professionalId: booking.professional_id,
    });
  } catch (err) {
    // 23P01 = bookings_no_overlap: outra cliente confirmou o mesmo horário no mesmo instante.
    if (err.code === '23P01') throw new HttpError(409, TAKEN);
    throw err;
  }
});

/**
 * GET /bookings/:code → { code, status, date, time, isPast, customerFirstName, service, professional, cancellation }
 * Limite de consultas por IP para ninguém sair testando códigos.
 */
bookingsRouter.get(
  '/:code',
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Muitas consultas seguidas. Espere alguns minutos e tente de novo.' }),
  async (req, res) => {
    const code = normalizeCode(req.params.code);
    const booking = code && (await findPublicBooking(code));
    if (!booking) throw new HttpError(404, NOT_FOUND);
    res.json(booking);
  },
);

/**
 * POST /bookings/:code/cancel  { phoneLast4: '6666' }
 * → 200 com o agendamento atualizado (mesmo formato do GET)
 * · 400 dígitos inválidos · 403 dígitos não conferem · 404 código não existe
 * · 409 já cancelado, já aconteceu ou fora do prazo de cancelamento
 * Os 4 dígitos têm só 10 mil combinações: por isso o limite por código, além do limite por IP.
 */
bookingsRouter.post(
  '/:code/cancel',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' }),
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    key: (req) => `code:${normalizeCode(req.params.code) || req.params.code}`,
    message: 'Muitas tentativas para este agendamento. Espere uma hora ou fale com o salão.',
  }),
  async (req, res) => {
    const code = normalizeCode(req.params.code);
    if (!code) throw new HttpError(404, NOT_FOUND);

    const raw = req.body?.phoneLast4;
    const last4 = typeof raw === 'string' || typeof raw === 'number' ? String(raw).replace(/\D/g, '') : '';
    if (last4.length !== 4) throw new HttpError(400, 'Digite os 4 últimos dígitos do WhatsApp usado no agendamento.');

    // Uma única instrução: só cancela se tudo bater ao mesmo tempo (sem janela para corrida).
    const { rowCount } = await query(
      `UPDATE bookings
          SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
        WHERE code = $1
          AND status IN ('pending', 'confirmed')
          AND right(customer_phone, 4) = $2
          AND now() <= starts_at - make_interval(hours => $3::int)`,
      [code, last4, config.cancelMinHours],
    );

    if (!rowCount) {
      // Não cancelou: descobre o motivo para dizer à cliente o que fazer.
      const { rows } = await query(
        `SELECT status, right(customer_phone, 4) = $2 AS phone_ok, ends_at < now() AS is_past
           FROM bookings WHERE code = $1`,
        [code, last4],
      );
      if (!rows.length) throw new HttpError(404, NOT_FOUND);
      const r = rows[0];
      if (!r.phone_ok) {
        throw new HttpError(403, 'Os 4 últimos dígitos não conferem com o WhatsApp usado no agendamento. Confira e tente de novo.');
      }
      if (r.status === 'cancelled') throw new HttpError(409, 'Este agendamento já estava cancelado.');
      if (r.status === 'done' || r.is_past) throw new HttpError(409, 'Este atendimento já aconteceu, então não dá mais para cancelar.');
      throw new HttpError(
        409,
        `Faltam menos de ${config.cancelMinHours} h para o seu horário. Para cancelar ou remarcar, fale com o salão.`,
      );
    }

    res.json(await findPublicBooking(code));
  },
);
