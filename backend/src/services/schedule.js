/* Carrega do banco tudo o que o cálculo de horários precisa, já no fuso do salão. */
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { stampToAbs, timeToMin } from '../lib/time.js';

const LOCAL = `'YYYY-MM-DD"T"HH24:MI'`;

/** Data de hoje e "agora" no fuso do salão. */
export async function salonNow() {
  const { rows } = await query(`SELECT to_char(now() AT TIME ZONE $1, ${LOCAL}) AS now`, [config.timezone]);
  return { today: rows[0].now.slice(0, 10), nowAbs: stampToAbs(rows[0].now) };
}

/**
 * Serviço + profissionais que o fazem (todas ou uma) + expediente, agendamentos e folgas entre `from` e `to`.
 * Retorna { service: { id, duration, priceCents }, pros: [...], nowAbs } no formato de services/availability.js.
 */
export async function loadSchedule({ serviceId, professionalId, from, to }) {
  const { rows: services } = await query(
    'SELECT id, duration_min, price_cents FROM services WHERE id = $1 AND active',
    [serviceId],
  );
  if (!services.length) throw new HttpError(404, 'Não encontramos esse serviço. Volte e escolha outro.');
  const service = { id: services[0].id, duration: services[0].duration_min, priceCents: services[0].price_cents };

  const params = [serviceId];
  let onlyOne = '';
  if (professionalId !== 'any') {
    params.push(professionalId);
    onlyOne = 'AND p.id = $2';
  }
  const { rows: proRows } = await query(
    `SELECT p.id
       FROM professionals p
       JOIN professional_services ps ON ps.professional_id = p.id
      WHERE ps.service_id = $1 AND p.active ${onlyOne}
      ORDER BY p.sort, p.name`,
    params,
  );
  if (professionalId !== 'any' && !proRows.length) {
    throw new HttpError(404, 'Essa profissional não faz o serviço escolhido.');
  }

  const ids = proRows.map((p) => p.id);
  const tz = config.timezone;
  // Intervalo [início de `from`, início do dia seguinte a `to`) no fuso do salão.
  const range = [ids, tz, from, to];
  const inRange = `starts_at < (($4::date + 1)::timestamp AT TIME ZONE $2)
               AND ends_at > ($3::date::timestamp AT TIME ZONE $2)`;

  const [hours, bookings, timeOff, now] = await Promise.all([
    query(
      `SELECT professional_id, weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
         FROM working_hours
        WHERE professional_id = ANY($1)`,
      [ids],
    ),
    query(
      `SELECT professional_id,
              to_char(starts_at AT TIME ZONE $2, ${LOCAL}) AS start,
              to_char(ends_at AT TIME ZONE $2, ${LOCAL}) AS "end"
         FROM bookings
        WHERE professional_id = ANY($1) AND status IN ('pending', 'confirmed') AND ${inRange}`,
      range,
    ),
    query(
      `SELECT professional_id,
              to_char(starts_at AT TIME ZONE $2, ${LOCAL}) AS start,
              to_char(ends_at AT TIME ZONE $2, ${LOCAL}) AS "end"
         FROM time_off
        WHERE professional_id = ANY($1) AND ${inRange}`,
      range,
    ),
    salonNow(),
  ]);

  const pros = ids.map((id) => ({ id, windows: {}, busy: [], blocked: [] }));
  const byId = new Map(pros.map((p) => [p.id, p]));

  for (const h of hours.rows) {
    const pro = byId.get(h.professional_id);
    (pro.windows[h.weekday] ||= []).push({ start: timeToMin(h.start), end: timeToMin(h.end) });
  }
  for (const pro of pros) {
    for (const list of Object.values(pro.windows)) list.sort((a, b) => a.start - b.start);
  }
  for (const b of bookings.rows) {
    byId.get(b.professional_id).busy.push({ start: stampToAbs(b.start), end: stampToAbs(b.end) });
  }
  for (const t of timeOff.rows) {
    byId.get(t.professional_id).blocked.push({ start: stampToAbs(t.start), end: stampToAbs(t.end) });
  }

  return { service, pros, nowAbs: now.nowAbs };
}
