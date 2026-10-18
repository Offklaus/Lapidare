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
export const updateProfessional = (id, { name, role, active }) =>
  request(`/staff/professionals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { name, role, active },
    ...withSession,
  });

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

/* ---------- Agendamento pela recepção (só admin) ---------- */

/** GET /staff/clients?q= → [{ id, name, phone, bookings, lastBookingDate }] — por nome ou WhatsApp */
export const searchClients = (q) => request('/staff/clients', { params: { q }, ...withSession });

/** POST /staff/clients { name, phone } → { id, name, phone, existing? } (não duplica o mesmo WhatsApp) */
export const createClient = ({ name, phone }) =>
  request('/staff/clients', { method: 'POST', body: { name, phone }, ...withSession });

/** GET /staff/free-slots?date=&professionalId= → { date, step, professionals: [{ id, name, times }] } */
export const getFreeSlots = ({ date, professionalId }) =>
  request('/staff/free-slots', { params: { date, professionalId }, ...withSession });

/**
 * POST /staff/bookings { clientId | client, serviceId, professionalId, start: 'YYYY-MM-DDTHH:MM', origin, notes,
 * fitIn, confirmFitIn } → 201 { id, code, date, time, endTime, client } · 409 { message, conflicts }
 */
export const createStaffBooking = (booking) =>
  request('/staff/bookings', { method: 'POST', body: booking, ...withSession });

/* ---------- Acesso: 2FA da admin, convite, usuários e a própria conta ---------- */

/** POST /staff/login/2fa { challenge, code } → { user } e grava o cookie de sessão */
export const verifyStaff2fa = (challenge, code) =>
  request('/staff/login/2fa', { method: 'POST', body: { challenge, code }, ...withSession });

/** GET /staff/invites/:token → { name, email, role, purpose } · 404 link vencido ou usado */
export const getStaffInvite = (token) => request(`/staff/invites/${encodeURIComponent(token)}`);

/** POST /staff/invites/:token { password } → { ok, role, needs2fa } */
export const acceptStaffInvite = (token, password) =>
  request(`/staff/invites/${encodeURIComponent(token)}`, { method: 'POST', body: { password } });

/** GET /staff/users → { users, maxAdmins } (só admin) */
export const getStaffUsers = () => request('/staff/users', withSession);

/** POST /staff/users { name, email, role, professionalId | newProfessional } → { user, link } (só admin) */
export const inviteStaffUser = (data) => request('/staff/users', { method: 'POST', body: data, ...withSession });

/** PATCH /staff/users/:id { name?, role?, professionalId?, active? } → { user } (só admin) */
export const updateStaffUser = (id, data) =>
  request(`/staff/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, ...withSession });

/** POST /staff/users/:id/link → { user, link } — convite de novo ou redefinição de senha (só admin) */
export const newStaffLink = (id) =>
  request(`/staff/users/${encodeURIComponent(id)}/link`, { method: 'POST', ...withSession });

/** POST /staff/users/:id/reset-2fa → { user } (só admin) */
export const resetStaff2fa = (id) =>
  request(`/staff/users/${encodeURIComponent(id)}/reset-2fa`, { method: 'POST', ...withSession });

/** DELETE /staff/users/:id → 204 — só convites nunca usados (só admin) */
export const deleteStaffInvite = (id) =>
  request(`/staff/users/${encodeURIComponent(id)}`, { method: 'DELETE', ...withSession });

/** GET /staff/audit → { entries } — registro de ações sobre contas (só admin) */
export const getStaffAudit = () => request('/staff/audit', withSession);

/** PUT /staff/account/password { currentPassword, newPassword } → 204 */
export const changeMyStaffPassword = (currentPassword, newPassword) =>
  request('/staff/account/password', { method: 'PUT', body: { currentPassword, newPassword }, ...withSession });
