/* Validação da entrada. Mensagens dizem como corrigir. */
import { HttpError } from './errors.js';
import { isISODate, isTime } from './time.js';
import { config } from '../config.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseId(value, field, label) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `Informe ${label} (${field}).`);
  if (value.length > 64) throw new HttpError(400, `${field} inválido.`);
  return value.trim();
}

/** Quantos serviços cabem num mesmo agendamento (feitos em sequência pela mesma profissional). */
export const MAX_SERVICES = 4;

/**
 * Serviços do agendamento, na ordem em que serão feitos. Aceita `serviceIds` (lista, ou texto "a,b" na URL)
 * ou o antigo `serviceId` (um só). → ['manicure', 'pedicure']
 */
export function parseServiceIds({ serviceIds, serviceId } = {}) {
  let list;
  if (Array.isArray(serviceIds) && serviceIds.length) list = serviceIds;
  else if (typeof serviceIds === 'string' && serviceIds.trim()) list = serviceIds.split(',');
  else return [parseId(serviceId, 'serviceId', 'o serviço')];

  const ids = list.map((id) => (typeof id === 'string' ? id.trim() : ''));
  if (!ids.length || ids.some((id) => !id || id.length > 64)) throw new HttpError(400, 'Informe os serviços (serviceIds).');
  if (ids.length > MAX_SERVICES) {
    throw new HttpError(400, `Dá para agendar até ${MAX_SERVICES} serviços de uma vez. Para mais, faça outro agendamento.`);
  }
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Cada serviço só pode aparecer uma vez no agendamento.');
  return ids;
}

/** Ausente ou 'any' → 'any' (primeiro horário livre). */
export function parseProfessionalId(value) {
  if (value === undefined || value === '' || value === 'any') return 'any';
  return parseId(value, 'professionalId', 'a profissional');
}

export function parseDate(value, field) {
  if (!isISODate(value)) throw new HttpError(400, `Informe ${field} no formato AAAA-MM-DD.`);
  return value;
}

export function parseTime(value) {
  if (!isTime(value)) throw new HttpError(400, 'Informe o horário (time) no formato HH:MM.');
  return value;
}

export function parseDays(value) {
  if (value === undefined || value === '') return 14;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > config.maxDays) {
    throw new HttpError(400, `days deve ser um número entre 1 e ${config.maxDays}.`);
  }
  return n;
}

/** { name, phone, email? } → dados limpos (telefone só com dígitos). */
export function parseCustomer(customer) {
  if (!customer || typeof customer !== 'object') throw new HttpError(400, 'Envie os dados da cliente (customer).');

  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Escreva o nome completo da cliente.');

  const phone = typeof customer.phone === 'string' ? customer.phone.replace(/\D/g, '') : '';
  if (phone.length < 10 || phone.length > 11) {
    throw new HttpError(400, 'Confira o WhatsApp: coloque o DDD e todos os dígitos.');
  }

  let email = null;
  if (customer.email !== undefined && customer.email !== null && customer.email !== '') {
    email = typeof customer.email === 'string' ? customer.email.trim() : '';
    if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'Confira o e-mail — parece incompleto.');
  }

  return { name, phone, email };
}
