/* Formatação no padrão brasileiro (datas, valores, duração, telefone). */

export const cx = (...classes) => classes.filter(Boolean).join(' ');

export const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 180 → "R$ 180,00"; strings passam direto ("a partir de R$ 90"). */
export function formatPrice(value) {
  return typeof value === 'number'
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : value;
}

/** 150 → "2 h 30 min"; 45 → "45 min". */
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 'YYYY-MM-DD' → Date ao meio-dia local (evita pular de dia por fuso). */
export function parseISODate(iso) {
  return new Date(`${iso}T12:00:00`);
}

/** Date → 'YYYY-MM-DD' no horário local. */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** '2026-09-29' → "ter, 29 de set". */
export function formatShortDate(iso) {
  const dt = parseISODate(iso);
  return `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}`;
}

/** Só dígitos, no máximo 11 (DDD + 9 dígitos). */
export function phoneDigits(value) {
  return value.replace(/\D/g, '').slice(0, 11);
}

/** Máscara progressiva: "11912345678" → "(11) 91234-5678". */
export function formatPhone(value) {
  const d = phoneDigits(value);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Iniciais para o avatar: "Ana Paula Souza" → "AP". */
export function initials(name = '?') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
