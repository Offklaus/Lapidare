/* Criação de agendamento: a mesma regra para o site (a cliente agenda) e para o painel (a recepção agenda).
   Um agendamento pode ter vários serviços, feitos em sequência pela mesma profissional (booking_services).
   A garantia final contra dois atendimentos ao mesmo tempo é a trava bookings_no_overlap do banco
   (erro 23P01), que vale para o bloco inteiro mesmo com dois pedidos chegando no mesmo instante. */
import { config } from '../config.js';
import { pool, query } from '../db/pool.js';
import { formatCode, generateCode } from '../lib/bookingCode.js';
import { computeSlots } from './availability.js';
import { BOOKING_SERVICE_NAMES_SQL } from './bookingServices.js';

export const TAKEN = 'Esse horário acabou de ser reservado. Escolha outro abaixo.';

/** O horário `time` na lista de horários do dia (mesma regra que gera os horários mostrados), ou undefined. */
export function findSlot({ service, pros, date, time, nowAbs }) {
  return computeSlots({ pros, date, duration: service.duration, step: config.slotStepMin, nowAbs }).find(
    (s) => s.time === time,
  );
}

/**
 * Cadastro da cliente pelo WhatsApp (só dígitos): cria se ainda não existe; se já existe, devolve o
 * cadastro que está lá, sem duplicar nem trocar o nome. → { id, name, phone, created }
 */
export async function upsertClient({ name, phone }, { createdByStaffId = null } = {}) {
  const { rows } = await query(
    `INSERT INTO clients (name, phone, created_by_staff_id) VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, name, phone, (xmax = 0) AS created`,
    [name, phone, createdByStaffId],
  );
  return rows[0];
}

const INSERT_BOOKING = `
  INSERT INTO bookings (code, service_id, professional_id, starts_at, ends_at, status,
                        customer_name, customer_phone, customer_email, customer_id, price_cents,
                        client_id, origin, notes, created_by_staff_id, fit_in)
  VALUES ($1, $2, $3,
          ($4::date + $5::time) AT TIME ZONE $6,
          ($4::date + $5::time + make_interval(mins => $7::int)) AT TIME ZONE $6,
          'confirmed', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  RETURNING id, code, status, professional_id`;

const INSERT_ITEMS = `
  INSERT INTO booking_services (booking_id, position, service_id, duration_min, price_cents)
  SELECT $1, t.position, t.service_id, t.duration_min, t.price_cents
    FROM unnest($2::text[], $3::int[], $4::int[]) WITH ORDINALITY
         AS t (service_id, duration_min, price_cents, position)`;

/**
 * Grava o agendamento e os serviços dele (b.items, na ordem em que serão feitos) numa transação só.
 * Fim = início + soma das durações (calculado aqui; o front nunca manda o fim); preço = soma dos preços.
 * Código novo; se o código sorteado já existir (raríssimo), sorteia outro. Conflito de horário sobe como
 * erro 23P01 para quem chamou. date/time no fuso do salão; no banco fica em UTC (timestamptz).
 * b.items: [{ id, duration, priceCents }] — sem items, grava um serviço só (b.serviceId, b.duration, b.priceCents).
 */
export async function insertBooking(b) {
  const items = b.items?.length ? b.items : [{ id: b.serviceId, duration: b.duration, priceCents: b.priceCents }];
  const duration = items.reduce((sum, s) => sum + s.duration, 0);
  const priceCents = items.reduce((sum, s) => sum + s.priceCents, 0);
  const values = [
    items[0].id,
    b.professionalId,
    b.date,
    b.time,
    config.timezone,
    duration,
    b.customer.name,
    b.customer.phone,
    b.customer.email ?? null,
    b.customerAccountId ?? null,
    priceCents,
    b.clientId ?? null,
    b.origin ?? 'site',
    b.notes ?? null,
    b.createdByStaffId ?? null,
    !!b.fitIn,
  ];

  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(INSERT_BOOKING, [generateCode(), ...values]);
        await client.query(INSERT_ITEMS, [
          rows[0].id,
          items.map((s) => s.id),
          items.map((s) => s.duration),
          items.map((s) => s.priceCents),
        ]);
        await client.query('COMMIT');
        return rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505' && err.constraint === 'bookings_code_key') continue;
        throw err;
      }
    }
  } finally {
    client.release();
  }
  throw new Error('Não foi possível gerar um código de agendamento único.');
}

/**
 * Atendimentos ativos da profissional que se sobrepõem a [date time, + duration) — para mostrar à
 * recepção qual agendamento está no caminho. → [{ code, customerName, service, date, time, endTime }]
 */
export async function findConflicts({ professionalId, date, time, duration }) {
  const { rows } = await query(
    `SELECT b.code, b.customer_name, COALESCE(${BOOKING_SERVICE_NAMES_SQL}, s.name) AS service_name,
            to_char(b.starts_at AT TIME ZONE $5, 'YYYY-MM-DD') AS date,
            to_char(b.starts_at AT TIME ZONE $5, 'HH24:MI') AS time,
            to_char(b.ends_at AT TIME ZONE $5, 'HH24:MI') AS end_time
       FROM bookings b
       JOIN services s ON s.id = b.service_id
      WHERE b.professional_id = $1
        AND b.status IN ('pending', 'confirmed')
        AND tstzrange(b.starts_at, b.ends_at) && tstzrange(
              ($2::date + $3::time) AT TIME ZONE $5,
              ($2::date + $3::time + make_interval(mins => $4::int)) AT TIME ZONE $5)
      ORDER BY b.starts_at`,
    [professionalId, date, time, duration, config.timezone],
  );
  return rows.map((r) => ({
    code: formatCode(r.code),
    customerName: r.customer_name,
    service: r.service_name,
    date: r.date,
    time: r.time,
    endTime: r.end_time,
  }));
}
