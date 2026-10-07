import { Router } from 'express';

import { config } from '../config.js';
import { rateLimit } from '../lib/rateLimit.js';
import { addDays, dayNumber } from '../lib/time.js';
import { parseDate, parseDays, parseProfessionalId, parseServiceIds } from '../lib/validate.js';
import { computeDays, computeSlots } from '../services/availability.js';
import { loadSchedule, salonNow } from '../services/schedule.js';

export const availabilityRouter = Router();

// Cada consulta de agenda vai ao banco: limite folgado para uso normal, que barra robôs.
availabilityRouter.use(
  rateLimit({ windowMs: 60 * 1000, max: 120, message: 'Muitas consultas seguidas. Aguarde um minuto e tente de novo.' }),
);

/** Último dia (dayNumber) em que a cliente pode agendar: hoje + BOOKING_MAX_DAYS_AHEAD. */
const lastBookableDay = (nowAbs) => Math.floor(nowAbs / 1440) + config.bookingMaxDaysAhead;

/**
 * GET /availability?serviceIds=a,b (ou serviceId=)&professionalId=|any&from=YYYY-MM-DD&days=14
 * → { days: [{ date, available }] }. Vários serviços: horários em que cabe a sequência inteira.
 */
availabilityRouter.get('/', async (req, res) => {
  const serviceIds = parseServiceIds(req.query);
  const professionalId = parseProfessionalId(req.query.professionalId);
  const days = parseDays(req.query.days);
  const from = req.query.from ? parseDate(req.query.from, 'from') : (await salonNow()).today;

  const { service, pros, nowAbs } = await loadSchedule({ serviceIds, professionalId, from, to: addDays(from, days - 1) });
  const last = lastBookableDay(nowAbs);

  res.json({
    days: computeDays({ pros, from, days, duration: service.duration, step: config.slotStepMin, nowAbs }).map((d) =>
      dayNumber(d.date) > last ? { ...d, available: false } : d,
    ),
  });
});

/** GET /availability/slots?serviceIds=a,b (ou serviceId=)&professionalId=&date= → [{ time, status, professionalId }] */
availabilityRouter.get('/slots', async (req, res) => {
  const serviceIds = parseServiceIds(req.query);
  const professionalId = parseProfessionalId(req.query.professionalId);
  const date = parseDate(req.query.date, 'date');

  const { service, pros, nowAbs } = await loadSchedule({ serviceIds, professionalId, from: date, to: date });
  if (dayNumber(date) > lastBookableDay(nowAbs)) return res.json([]);

  res.json(computeSlots({ pros, date, duration: service.duration, step: config.slotStepMin, nowAbs }));
});
