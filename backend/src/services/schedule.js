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

/** Maior bloco que um agendamento pode ocupar (todos os serviços somados), em minutos. */
export const MAX_BOOKING_MINUTES = 600;

/**
 * Serviço(s) + profissionais que fazem todos eles (todas ou uma) + expediente, agendamentos e folgas entre
 * `from` e `to`. Vários serviços são feitos em sequência pela mesma profissional: o horário precisa caber a
 * soma das durações.
 * Retorna { service: { id, ids, items: [{ id, name, duration, priceCents }], duration, priceCents }, pros, nowAbs }
 * (duration e priceCents somados; id = o primeiro serviço) no formato de services/availability.js.
 */
export async function loadSchedule({ serviceId, serviceIds, professionalId, from, to }) {
  const ids = serviceIds?.length ? serviceIds : [serviceId];
  const { rows } = await query(
    'SELECT id, name, duration_min, price_cents FROM services WHERE id = ANY($1::text[]) AND active',
    [ids],
  );
  const byId = new Map(rows.map((s) => [s.id, s]));
  if (ids.some((id) => !byId.has(id))) {
    throw new HttpError(
      404,
      ids.length > 1
        ? 'Um dos serviços escolhidos não está disponível. Volte e escolha de novo.'
        : 'Não encontramos esse serviço. Volte e escolha outro.',
    );
  }
  const items = ids.map((id) => {
    const s = byId.get(id);
    return { id: s.id, name: s.name, duration: s.duration_min, priceCents: s.price_cents };
  });
  const service = {
    id: ids[0],
    ids,
    items,
    duration: items.reduce((sum, s) => sum + s.duration, 0),
    priceCents: items.reduce((sum, s) => sum + s.priceCents, 0),
  };
  if (service.duration > MAX_BOOKING_MINUTES) {
    throw new HttpError(400, 'Os serviços somados passam de 10 horas. Escolha menos serviços ou faça outro agendamento.');
  }

  // Só quem faz TODOS os serviços escolhidos.
  const params = [ids, ids.length];
  let onlyOne = '';
  if (professionalId !== 'any') {
    params.push(professionalId);
    onlyOne = 'AND p.id = $3';
  }
  const { rows: proRows } = await query(
    `SELECT p.id
       FROM professionals p
       JOIN professional_services ps ON ps.professional_id = p.id
      WHERE ps.service_id = ANY($1::text[]) AND p.active ${onlyOne}
      GROUP BY p.id, p.sort, p.name
     HAVING count(DISTINCT ps.service_id) = $2
      ORDER BY p.sort, p.name`,
    params,
  );
  if (professionalId !== 'any' && !proRows.length) {
    throw new HttpError(
      404,
      ids.length > 1 ? 'Essa profissional não faz todos os serviços escolhidos.' : 'Essa profissional não faz o serviço escolhido.',
    );
  }

  const { pros, nowAbs } = await loadProfessionalsSchedule(
    proRows.map((p) => p.id),
    from,
    to,
  );
  return { service, pros, nowAbs };
}

/**
 * Expediente, agendamentos ativos e folgas das profissionais `ids` entre `from` e `to` (no fuso do salão).
 * Retorna { pros, nowAbs } no formato de services/availability.js. Usada pelo agendamento das clientes
 * (via loadSchedule) e pelos horários livres do painel.
 */
export async function loadProfessionalsSchedule(ids, from, to) {
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

  return { pros, nowAbs: now.nowAbs };
}
