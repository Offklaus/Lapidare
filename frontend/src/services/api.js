/* Cliente da API de agendamento.
   Contrato definido no design system (README → "Contrato com o back-end").
   Com VITE_USE_MOCK=true (padrão) usa src/services/mock.js no lugar do servidor. */
import * as mock from './mock.js';

// Local: http://localhost:3333/api. Produção (site e API no mesmo serviço): "/api", relativo ao próprio site.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333/api').replace(/\/$/, '');
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** credentials: 'include' envia o cookie de sessão (painel da equipe). */
export async function request(path, { method = 'GET', params, body, credentials } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials,
    });
  } catch {
    throw new ApiError('Não conseguimos falar com o salão agora. Confira sua conexão e tente de novo.', 0);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message || 'Algo deu errado. Tente de novo em instantes.', res.status, data);
  }
  return data;
}

/** GET /services → [{ id, category, name, description, duration, price }] */
export function getServices(professionalId) {
  if (USE_MOCK) return mock.getServices(professionalId);
  // Com professionalId, só os serviços que essa profissional faz ('any' ou vazio = todos).
  return request('/services', { params: { professionalId } });
}

/** GET /professionals?serviceId= → [{ id, name, role, specialties, photo }] */
export function getProfessionals(serviceId) {
  if (USE_MOCK) return mock.getProfessionals(serviceId);
  return request('/professionals', { params: { serviceId } });
}

/** GET /availability → { days: [{ date, available }] } */
export function getAvailability({ serviceId, professionalId = 'any', from, days = 14 }) {
  if (USE_MOCK) return mock.getAvailability({ serviceId, professionalId, from, days });
  return request('/availability', { params: { serviceId, professionalId, from, days } });
}

/** GET /availability/slots → [{ time, status, professionalId }] */
export function getSlots({ serviceId, professionalId = 'any', date }) {
  if (USE_MOCK) return mock.getSlots({ serviceId, professionalId, date });
  return request('/availability/slots', { params: { serviceId, professionalId, date } });
}

/** POST /bookings → 201 { id, code, status } · 409 se o horário foi reservado nesse meio-tempo */
export function createBooking(payload) {
  if (USE_MOCK) return mock.createBooking(payload);
  // credentials: se a cliente estiver logada, a reserva fica ligada à conta dela.
  return request('/bookings', { method: 'POST', body: payload, credentials: 'include' });
}

/** GET /bookings/:code → { code, status, date, time, isPast, customerFirstName, service, professional } · 404 se não existe */
export function getBooking(code) {
  if (USE_MOCK) return mock.getBooking(code);
  return request(`/bookings/${encodeURIComponent(code)}`);
}

/** POST /bookings/:code/cancel { phoneLast4 } → agendamento atualizado · 403 dígitos não conferem · 409 fora do prazo */
export function cancelBooking(code, phoneLast4) {
  if (USE_MOCK) return mock.cancelBooking(code, phoneLast4);
  return request(`/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST', body: { phoneLast4 } });
}
