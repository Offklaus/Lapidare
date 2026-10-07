/* Pedido de agendamento feito pela recepção no painel. Mensagens dizem como corrigir. */
import { HttpError } from './errors.js';
import { isISODate, isTime } from './time.js';
import { parseCustomer, parseId, parseServiceIds } from './validate.js';

/** Canais por onde a cliente marcou com a recepção ('site' é só para o agendamento feito por ela). */
export const ORIGINS = ['whatsapp', 'instagram', 'telefone', 'presencial'];

const START_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * { clientId | client: { name, phone }, serviceIds: [...] (ou serviceId), professionalId,
 *   start: 'YYYY-MM-DDTHH:MM' (fuso do salão),
 *   origin, notes?, fitIn?, confirmFitIn? } → dados limpos.
 * O fim do atendimento não vem do front: é calculado pela duração do serviço.
 */
export function parseManualBooking(body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Envie os dados do agendamento.');

  let clientId = null;
  let client = null;
  if (body.clientId !== undefined && body.clientId !== null) {
    clientId = Number(body.clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) throw new HttpError(400, 'Cliente inválida. Busque de novo.');
  } else if (body.client) {
    const { name, phone } = parseCustomer(body.client);
    client = { name, phone };
  } else {
    throw new HttpError(400, 'Escolha a cliente ou faça o cadastro rápido.');
  }

  const serviceIds = parseServiceIds(body); // vários = em sequência, com a mesma profissional
  if (body.professionalId === 'any') throw new HttpError(400, 'Escolha a profissional.');
  const professionalId = parseId(body.professionalId, 'professionalId', 'a profissional');

  const m = typeof body.start === 'string' ? body.start.match(START_RE) : null;
  if (!m || !isISODate(m[1]) || !isTime(m[2])) {
    throw new HttpError(400, 'Informe a data e o horário (start) no formato AAAA-MM-DDTHH:MM.');
  }

  if (!ORIGINS.includes(body.origin)) {
    throw new HttpError(400, 'Escolha por onde a cliente marcou: WhatsApp, Instagram Direct, telefone ou presencial.');
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    throw new HttpError(400, 'Observações devem ser texto.');
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > 500) throw new HttpError(400, 'As observações podem ter no máximo 500 caracteres.');

  if (body.fitIn !== undefined && typeof body.fitIn !== 'boolean') throw new HttpError(400, 'fitIn deve ser true ou false.');
  const fitIn = body.fitIn === true;
  // Encaixe exige confirmação explícita de quem está agendando.
  if (fitIn && body.confirmFitIn !== true) {
    throw new HttpError(400, 'Confirme o encaixe: o horário está fora da lista de horários livres.');
  }

  return {
    clientId,
    client,
    serviceIds,
    professionalId,
    date: m[1],
    time: m[2],
    origin: body.origin,
    notes: notes || null,
    fitIn,
  };
}

/** Busca de clientes: texto de 2 a 60 caracteres. Só dígitos (3+) busca pelo WhatsApp. */
export function parseClientQuery(value) {
  const q = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (q.length < 2 || q.length > 60) throw new HttpError(400, 'Digite ao menos 2 letras do nome ou números do WhatsApp.');
  const digits = q.replace(/\D/g, '');
  const byPhone = digits.length >= 3 && /^[\d\s()+-]+$/.test(q);
  return { text: q, digits: byPhone ? digits : null };
}
