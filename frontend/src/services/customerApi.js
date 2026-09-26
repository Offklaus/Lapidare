/* Área da cliente (login com Google). Usa o cookie de sessão da cliente (credentials: 'include'),
   que é separado do da equipe e nunca abre o painel. */
import { request } from './api.js';

const withSession = { credentials: 'include' };

/** GET /customer/config → { googleClientId } (null = login com Google ainda não configurado) */
export const getCustomerConfig = () => request('/customer/config');

/** POST /customer/login/google { credential } → { customer } e grava o cookie de sessão */
export const loginWithGoogle = (credential) =>
  request('/customer/login/google', { method: 'POST', body: { credential }, ...withSession });

export const customerLogout = () => request('/customer/logout', { method: 'POST', ...withSession });

/** GET /customer/me → { customer: { id, name, email, picture } } · 401 sem login */
export const getCustomerMe = () => request('/customer/me', withSession);

/** GET /customer/bookings → reservas da cliente, mais recentes primeiro */
export const getMyBookings = () => request('/customer/bookings', withSession);
