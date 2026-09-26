/* Datas 'YYYY-MM-DD' e horários 'HH:MM' do salão, sem depender do fuso do servidor.
   "Minutos absolutos" = minutos desde 1970-01-01 00:00 no horário local do salão;
   servem só para comparar e somar intervalos. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Data de calendário válida? ('2026-02-30' → false) */
export function isISODate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const isTime = (value) => typeof value === 'string' && TIME_RE.test(value);

/** '09:30' → 570 */
export function timeToMin(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 570 → '09:30' */
export const minToTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** '2026-09-26' → dias desde 1970-01-01 */
export function dayNumber(iso) {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
}

/** addDays('2026-09-30', 1) → '2026-10-01' */
export const addDays = (iso, n) => new Date((dayNumber(iso) + n) * 86400000).toISOString().slice(0, 10);

/** 0 = domingo … 6 = sábado */
export const weekday = (iso) => new Date(dayNumber(iso) * 86400000).getUTCDay();

/** Data + minutos do dia → minutos absolutos */
export const toAbs = (iso, min) => dayNumber(iso) * 1440 + min;

/** 'YYYY-MM-DDTHH:MM' (horário local) → minutos absolutos */
export const stampToAbs = (stamp) => toAbs(stamp.slice(0, 10), timeToMin(stamp.slice(11, 16)));
