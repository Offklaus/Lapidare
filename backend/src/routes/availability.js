import { Router } from 'express';

import { config } from '../config.js';
import { addDays } from '../lib/time.js';
import { parseDate, parseDays, parseId, parseProfessionalId } from '../lib/validate.js';
import { computeDays, computeSlots } from '../services/availability.js';
import { loadSchedule, salonNow } from '../services/schedule.js';

export const availabilityRouter = Router();

/** GET /availability?serviceId=&professionalId=|any&from=YYYY-MM-DD&days=14 → { days: [{ date, available }] } */
availabilityRouter.get('/', async (req, res) => {
  const serviceId = parseId(req.query.serviceId, 'serviceId', 'o serviço');
  const professionalId = parseProfessionalId(req.query.professionalId);
  const days = parseDays(req.query.days);
  const from = req.query.from ? parseDate(req.query.from, 'from') : (await salonNow()).today;

  const { service, pros, nowAbs } = await loadSchedule({ serviceId, professionalId, from, to: addDays(from, days - 1) });

  res.json({
    days: computeDays({ pros, from, days, duration: service.duration, step: config.slotStepMin, nowAbs }),
  });
});

/** GET /availability/slots?serviceId=&professionalId=&date= → [{ time, status, professionalId }] */
availabilityRouter.get('/slots', async (req, res) => {
  const serviceId = parseId(req.query.serviceId, 'serviceId', 'o serviço');
  const professionalId = parseProfessionalId(req.query.professionalId);
  const date = parseDate(req.query.date, 'date');

  const { service, pros, nowAbs } = await loadSchedule({ serviceId, professionalId, from: date, to: date });

  res.json(computeSlots({ pros, date, duration: service.duration, step: config.slotStepMin, nowAbs }));
});
