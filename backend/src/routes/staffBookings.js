/* Agendamento pela recepção (só admin): busca e cadastro rápido de clientes, horários livres do dia
   e criação do agendamento. Montado em staff.js, depois do login (requireStaff). */
import { Router } from 'express';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { formatCode } from '../lib/bookingCode.js';
import { HttpError } from '../lib/errors.js';
import { parseClientQuery, parseManualBooking } from '../lib/manualBookingInput.js';
import { requireAdmin } from '../lib/staffAuth.js';
import { minToTime, timeToMin, toAbs } from '../lib/time.js';
import { parseCustomer, parseDate } from '../lib/validate.js';
import { slotsForProfessional } from '../services/availability.js';
import { findConflicts, findSlot, insertBooking, upsertClient } from '../services/createBooking.js';
import { loadProfessionalsSchedule, loadSchedule } from '../services/schedule.js';

export const staffBookingsRouter = Router();

const publicClient = (c) => ({ id: c.id, name: c.name, phone: c.phone });

/** GET /staff/clients?q= → [{ id, name, phone, bookings, lastBookingDate }] (até 10; por nome ou WhatsApp) */
staffBookingsRouter.get('/clients', requireAdmin, async (req, res) => {
  const { text, digits } = parseClientQuery(req.query.q);
  const { rows } = await query(
    `SELECT c.id, c.name, c.phone,
            count(b.id)::int AS bookings,
            to_char(max(b.starts_at) AT TIME ZONE $3, 'YYYY-MM-DD') AS last_booking_date
       FROM clients c
       LEFT JOIN bookings b ON b.client_id = c.id
      WHERE ($2::text IS NOT NULL AND c.phone LIKE '%' || $2 || '%')
         OR ($2::text IS NULL AND lower(c.name) LIKE '%' || lower($1) || '%')
      GROUP BY c.id
      ORDER BY (lower(c.name) LIKE lower($1) || '%') DESC, max(b.starts_at) DESC NULLS LAST, c.name
      LIMIT 10`,
    [text.replace(/[\\%_]/g, (ch) => `\\${ch}`), digits, config.timezone],
  );
  res.json(
    rows.map((c) => ({ ...publicClient(c), bookings: c.bookings, lastBookingDate: c.last_booking_date })),
  );
});

/**
 * POST /staff/clients { name, phone } — cadastro rápido.
 * → 201 { id, name, phone } novo · 200 { ..., existing: true } se o WhatsApp já estava cadastrado (não duplica)
 */
staffBookingsRouter.post('/clients', requireAdmin, async (req, res) => {
  const { name, phone } = parseCustomer(req.body);
  const client = await upsertClient({ name, phone }, { createdByStaffId: req.staff.id });
  if (client.created) return res.status(201).json(publicClient(client));
  return res.json({ ...publicClient(client), existing: true });
});

/**
 * GET /staff/free-slots?date=YYYY-MM-DD&professionalId= → { date, step, professionals: [{ id, name, times }] }
 * Inícios livres de cada profissional no dia, de `step` em `step` minutos (mesmo cálculo do site), para a
 * recepção clicar e abrir o agendamento já preenchido.
 */
staffBookingsRouter.get('/free-slots', requireAdmin, async (req, res) => {
  const date = parseDate(req.query.date, 'date');
  const only =
    typeof req.query.professionalId === 'string' && req.query.professionalId && req.query.professionalId !== 'all'
      ? req.query.professionalId
      : null;
  const { rows: list } = await query(
    'SELECT id, name FROM professionals WHERE active AND ($1::text IS NULL OR id = $1) ORDER BY sort, name',
    [only],
  );
  const { pros, nowAbs } = await loadProfessionalsSchedule(
    list.map((p) => p.id),
    date,
    date,
  );
  const step = config.slotStepMin;
  res.json({
    date,
    step,
    professionals: list.map((p, i) => ({
      id: p.id,
      name: p.name,
      times: slotsForProfessional({ pro: pros[i], date, duration: step, step, nowAbs })
        .filter((s) => s.status === 'available')
        .map((s) => s.time),
    })),
  });
});

const conflictError = (conflicts) =>
  new HttpError(
    409,
    conflicts.length
      ? `Esse horário se sobrepõe ao atendimento de ${conflicts[0].customerName} (${conflicts[0].time}–${conflicts[0].endTime}). Escolha outro horário.`
      : 'Esse horário acabou de ser ocupado. Escolha outro.',
    { conflicts },
  );

/**
 * POST /staff/bookings
 * { clientId | client: { name, phone }, serviceIds: [...] (ou serviceId), professionalId, start: 'YYYY-MM-DDTHH:MM', origin,
 *   notes?, fitIn?, confirmFitIn? }
 * Mesma regra de horários do site; com encaixe (fitIn + confirmFitIn) pode ficar fora do expediente ou de uma
 * folga, mas nunca em cima de outro atendimento.
 * → 201 { id, code, status, professionalId, date, time, endTime, client } · 400 dados inválidos ·
 *   403 não admin · 409 conflito de horário { message, conflicts: [...] }
 */
staffBookingsRouter.post('/bookings', requireAdmin, async (req, res) => {
  const input = parseManualBooking(req.body);
  const { serviceIds, professionalId, date, time } = input;

  const { rows: services } = await query('SELECT id FROM services WHERE id = ANY($1::text[]) AND active', [serviceIds]);
  if (services.length !== serviceIds.length) throw new HttpError(400, 'Serviço não encontrado ou fora do agendamento.');
  const does = await query(
    `SELECT count(DISTINCT ps.service_id)::int AS n FROM professional_services ps
       JOIN professionals p ON p.id = ps.professional_id AND p.active
      WHERE ps.professional_id = $1 AND ps.service_id = ANY($2::text[])`,
    [professionalId, serviceIds],
  );
  if (does.rows[0].n !== serviceIds.length) {
    throw new HttpError(
      400,
      serviceIds.length > 1
        ? 'Essa profissional não faz todos os serviços escolhidos. Escolha outra ou tire um serviço.'
        : 'Essa profissional não faz esse serviço. Escolha outra.',
    );
  }

  let client;
  if (input.clientId) {
    const { rows } = await query('SELECT id, name, phone FROM clients WHERE id = $1', [input.clientId]);
    if (!rows.length) throw new HttpError(400, 'Cliente não encontrada. Busque de novo ou faça o cadastro rápido.');
    [client] = rows;
  } else {
    client = await upsertClient(input.client, { createdByStaffId: req.staff.id });
  }

  // Mesmo carregamento e cálculo de horários do site.
  const { service, pros, nowAbs } = await loadSchedule({ serviceIds, professionalId, from: date, to: date });
  if (toAbs(date, timeToMin(time)) <= nowAbs) throw new HttpError(400, 'Esse horário já passou. Escolha um horário futuro.');

  const span = { professionalId, date, time, duration: service.duration };
  if (!input.fitIn) {
    const slot = findSlot({ service, pros, date, time, nowAbs });
    if (!slot) {
      throw new HttpError(400, 'Esse horário não está na lista de horários livres. Escolha um da lista ou use o encaixe.');
    }
    if (slot.status === 'booked') throw conflictError(await findConflicts(span));
    if (slot.status !== 'available') {
      throw new HttpError(400, 'Esse horário está bloqueado (folga ou pausa da profissional). Para atender mesmo assim, use o encaixe.');
    }
  } else {
    const conflicts = await findConflicts(span);
    if (conflicts.length) throw conflictError(conflicts);
  }

  let booking;
  try {
    booking = await insertBooking({
      items: service.items,
      professionalId,
      date,
      time,
      customer: { name: client.name, phone: client.phone, email: null },
      clientId: client.id,
      origin: input.origin,
      notes: input.notes,
      createdByStaffId: req.staff.id,
      fitIn: input.fitIn,
    });
  } catch (err) {
    // 23P01 = bookings_no_overlap: outro agendamento ocupou o horário no mesmo instante (site ou painel).
    if (err.code === '23P01') throw conflictError(await findConflicts(span));
    throw err;
  }

  res.status(201).json({
    id: booking.id,
    code: formatCode(booking.code),
    status: booking.status,
    professionalId: booking.professional_id,
    date,
    time,
    endTime: minToTime((timeToMin(time) + service.duration) % 1440),
    client: publicClient(client),
  });
});
