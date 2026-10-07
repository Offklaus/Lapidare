/* Vários serviços no mesmo agendamento: feitos em sequência, um depois do outro, com a mesma profissional. */

/** Máximo de serviços num agendamento (o servidor recusa mais que isso). */
export const MAX_SERVICES = 4;

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const totalDuration = (services) => services.reduce((sum, s) => sum + s.duration, 0);
export const totalPrice = (services) => services.reduce((sum, s) => sum + s.price, 0);

/** "Manicure tradicional + Pedicure" */
export const servicesName = (services) => services.map((s) => s.name).join(' + ');

/** Horário de início de cada serviço a partir de `start` ('HH:MM') → [{ ...serviço, time, endTime }] */
export function inSequence(services, start) {
  let at = start ? toMin(start) : null;
  return services.map((s) => {
    if (at === null) return { ...s };
    const item = { ...s, time: toTime(at), endTime: toTime(at + s.duration) };
    at += s.duration;
    return item;
  });
}

/** Fim da sequência que começa em `start`: '10:00' + 1h45 → '11:45' */
export const endOf = (services, start) => (start ? toTime(toMin(start) + totalDuration(services)) : '');

/**
 * Texto para resumos (uma linha por serviço quando são vários):
 * "10:00 · Manicure tradicional\n10:45 · Pedicure" — sem horário, só os nomes.
 */
export function servicesLines(services, start) {
  if (services.length < 2) return services[0]?.name || '';
  return inSequence(services, start)
    .map((s) => (s.time ? `${s.time} · ${s.name}` : s.name))
    .join('\n');
}
