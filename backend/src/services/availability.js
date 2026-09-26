/* Cálculo de horários — funções puras, sem banco (testadas em test/availability.test.js).

   Uma profissional (`pro`) chega assim:
   {
     id: 'pro-1',
     windows: { 1: [{ start: 540, end: 720 }, …], … },  // expediente por dia da semana, em minutos do dia
     busy:    [{ start, end }],                         // agendamentos ativos, em minutos absolutos
     blocked: [{ start, end }],                         // folgas/pausas, em minutos absolutos
   }
*/
import { addDays, minToTime, toAbs, weekday } from '../lib/time.js';

const overlaps = (list, start, end) => list.some((i) => i.start < end && start < i.end);

/** Horários de início de uma profissional num dia. Só inícios em que a duração inteira cabe no expediente. */
export function slotsForProfessional({ pro, date, duration, step, nowAbs }) {
  const windows = pro.windows[weekday(date)] || [];
  const slots = [];

  for (const w of windows) {
    for (let s = w.start; s + duration <= w.end; s += step) {
      const start = toAbs(date, s);
      const end = start + duration;
      let status = 'available';
      if (start <= nowAbs || overlaps(pro.blocked, start, end)) status = 'blocked';
      else if (overlaps(pro.busy, start, end)) status = 'booked';
      slots.push({ time: minToTime(s), status, professionalId: pro.id });
    }
  }
  return slots;
}

/** Junta as agendas ("Primeiro horário livre"): em cada horário fica a primeira profissional livre, na ordem recebida. */
export function mergeSlots(lists) {
  const byTime = new Map();
  for (const list of lists) {
    for (const slot of list) {
      const current = byTime.get(slot.time);
      if (!current || (current.status !== 'available' && slot.status === 'available')) byTime.set(slot.time, slot);
    }
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function computeSlots({ pros, date, duration, step, nowAbs }) {
  return mergeSlots(pros.map((pro) => slotsForProfessional({ pro, date, duration, step, nowAbs })));
}

/** [{ date, available }] para `days` dias a partir de `from`. */
export function computeDays({ pros, from, days, duration, step, nowAbs }) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const slots = computeSlots({ pros, date, duration, step, nowAbs });
    return { date, available: slots.some((s) => s.status === 'available') };
  });
}
