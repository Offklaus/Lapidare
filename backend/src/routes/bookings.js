import { Router } from 'express';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from '../lib/errors.js';
import { parseCustomer, parseDate, parseId, parseProfessionalId, parseTime } from '../lib/validate.js';
import { computeSlots } from '../services/availability.js';
import { loadSchedule } from '../services/schedule.js';

export const bookingsRouter = Router();

const TAKEN = 'Esse horário acabou de ser reservado. Escolha outro abaixo.';

/**
 * POST /bookings
 * { serviceId, professionalId | 'any', date: 'YYYY-MM-DD', time: 'HH:MM', customer: { name, phone, email? } }
 * → 201 { id, status, professionalId } · 409 se o horário não está mais livre
 */
bookingsRouter.post('/', async (req, res) => {
  const body = req.body || {};
  const serviceId = parseId(body.serviceId, 'serviceId', 'o serviço');
  const professionalId = parseProfessionalId(body.professionalId);
  const date = parseDate(body.date, 'date');
  const time = parseTime(body.time);
  const customer = parseCustomer(body.customer);

  // Confere com a mesma regra que gerou os horários mostrados para a cliente.
  const { service, pros, nowAbs } = await loadSchedule({ serviceId, professionalId, from: date, to: date });
  const slot = computeSlots({ pros, date, duration: service.duration, step: config.slotStepMin, nowAbs }).find(
    (s) => s.time === time,
  );
  if (!slot) throw new HttpError(400, 'Esse horário não faz parte do expediente. Escolha um dos horários da lista.');
  if (slot.status !== 'available') throw new HttpError(409, TAKEN);

  try {
    const { rows } = await query(
      `INSERT INTO bookings (service_id, professional_id, starts_at, ends_at, status,
                             customer_name, customer_phone, customer_email)
       VALUES ($1, $2,
               ($3::date + $4::time) AT TIME ZONE $5,
               ($3::date + $4::time + make_interval(mins => $6::int)) AT TIME ZONE $5,
               'confirmed', $7, $8, $9)
       RETURNING id, status, professional_id`,
      [service.id, slot.professionalId, date, time, config.timezone, service.duration,
        customer.name, customer.phone, customer.email],
    );
    const booking = rows[0];
    res.status(201).json({ id: booking.id, status: booking.status, professionalId: booking.professional_id });
  } catch (err) {
    // 23P01 = bookings_no_overlap: outra cliente confirmou o mesmo horário no mesmo instante.
    if (err.code === '23P01') throw new HttpError(409, TAKEN);
    throw err;
  }
});
