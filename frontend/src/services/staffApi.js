/* Chamadas do painel da equipe. Usam o cookie de sessão (credentials: 'include')
   e sempre a API real: o painel não tem modo de exemplo. */
import { request } from './api.js';

const withSession = { credentials: 'include' };

/** POST /staff/login → { user } e grava o cookie de sessão */
export const staffLogin = (email, password) =>
  request('/staff/login', { method: 'POST', body: { email, password }, ...withSession });

export const staffLogout = () => request('/staff/logout', { method: 'POST', ...withSession });

/** GET /staff/me → { user: { id, name, email, role: 'admin' | 'professional', professionalId } } · 401 sem sessão */
export const getStaffMe = () => request('/staff/me', withSession);

/** GET /staff/bookings → { from, to, bookings: [...] } */
export const getStaffBookings = ({ from, to, professionalId }) =>
  request('/staff/bookings', { params: { from, to, professionalId }, ...withSession });

/** POST /staff/bookings/:id/confirmation-sent → agendamento atualizado (registra o envio da confirmação) */
export const markConfirmationSent = (id) =>
  request(`/staff/bookings/${encodeURIComponent(id)}/confirmation-sent`, { method: 'POST', ...withSession });

/** POST /staff/bookings/:id/reminder-sent → agendamento atualizado (registra o envio do lembrete) */
export const markReminderSent = (id) =>
  request(`/staff/bookings/${encodeURIComponent(id)}/reminder-sent`, { method: 'POST', ...withSession });

/** GET /staff/professionals → [{ id, name, role, active }] (só admin) */
export const getStaffProfessionals = () => request('/staff/professionals', withSession);

/** PATCH /staff/professionals/:id { name, role } → profissional atualizada (só admin) */
export const updateProfessional = (id, { name, role }) =>
  request(`/staff/professionals/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name, role }, ...withSession });

/** PUT /staff/professionals/:id/services { serviceIds } → { id, serviceIds } (só admin) */
export const updateProfessionalServices = (id, serviceIds) =>
  request(`/staff/professionals/${encodeURIComponent(id)}/services`, { method: 'PUT', body: { serviceIds }, ...withSession });

/** PATCH /staff/bookings/:id/status { status: 'done' | 'no_show' | 'cancelled' } → agendamento atualizado */
export const updateBookingStatus = (id, status) =>
  request(`/staff/bookings/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status }, ...withSession });

/** GET /staff/services → [{ id, category, name, description, duration, price, active, professionalCount }] (só admin) */
export const getStaffServices = () => request('/staff/services', withSession);

/** POST /staff/services { name, category, description, duration, price, professionalIds } → serviço criado (só admin) */
export const createService = (service) => request('/staff/services', { method: 'POST', body: service, ...withSession });

/** PATCH /staff/services/:id { name, category, description, duration, price, active } → serviço atualizado (só admin) */
export const updateService = (id, service) =>
  request(`/staff/services/${encodeURIComponent(id)}`, { method: 'PATCH', body: service, ...withSession });
