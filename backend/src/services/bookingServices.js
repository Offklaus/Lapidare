/* Serviços de um agendamento (um ou mais, em sequência — tabela booking_services) no formato da API. */
import { minToTime, timeToMin } from '../lib/time.js';

/**
 * Coluna SQL `services_json`: os serviços do agendamento `b`, na ordem, como
 * [{ id, name, duration, price }] (price em centavos). Use num SELECT que tenha `bookings b`.
 */
export const BOOKING_SERVICES_SQL = `(
  SELECT json_agg(json_build_object('id', bs.service_id, 'name', sv.name, 'duration', bs.duration_min,
                                    'price', bs.price_cents) ORDER BY bs.position)
    FROM booking_services bs
    JOIN services sv ON sv.id = bs.service_id
   WHERE bs.booking_id = b.id) AS services_json`;

/** Nomes dos serviços do agendamento `b` juntos ("Manicure + Pedicure"), para mensagens de conflito. */
export const BOOKING_SERVICE_NAMES_SQL = `(
  SELECT string_agg(sv.name, ' + ' ORDER BY bs.position)
    FROM booking_services bs
    JOIN services sv ON sv.id = bs.service_id
   WHERE bs.booking_id = b.id)`;

/**
 * Linha do banco (services_json, service_name, time 'HH:MM', duration_min e price_cents do agendamento) →
 * { service: { name, duration, price }, services: [{ id, name, duration, price, time }] }.
 * `service` é o resumo (nomes juntos, duração e preço totais) — as telas que mostram um serviço só continuam
 * funcionando; `services` traz cada parte com o horário em que começa.
 */
export function bookingServicesView(b) {
  const list = b.services_json?.length
    ? b.services_json
    : [{ id: null, name: b.service_name, duration: b.duration_min, price: b.price_cents }];
  let at = b.time ? timeToMin(b.time) : null;
  const services = list.map((s) => {
    const item = { id: s.id, name: s.name, duration: s.duration, price: s.price / 100 };
    if (at !== null) {
      item.time = minToTime(at % 1440);
      at += s.duration;
    }
    return item;
  });
  return {
    service: { name: services.map((s) => s.name).join(' + '), duration: b.duration_min, price: b.price_cents / 100 },
    services,
  };
}
