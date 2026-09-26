/* Sessões das clientes (cookie lp_customer, tabela customer_sessions).
   Separadas da equipe: esta sessão nunca é aceita nas rotas /staff. */
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from './errors.js';
import { hashToken, sessionStore } from './sessions.js';

export const customerSessions = sessionStore({
  table: 'customer_sessions',
  ownerColumn: 'customer_id',
  cookieName: 'lp_customer',
  days: () => config.customerSessionDays,
});

export const publicCustomer = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  picture: c.picture_url,
});

/** Cliente logada ou null (sem erro). Serve para rotas públicas que só aproveitam o login, como agendar. */
export async function findCustomer(req) {
  const token = customerSessions.read(req);
  if (!token) return null;
  const { rows } = await query(
    `SELECT c.id, c.name, c.email, c.picture_url
       FROM customer_sessions s
       JOIN customers c ON c.id = s.customer_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

/** Middleware: exige cliente logada e coloca em req.customer. */
export async function requireCustomer(req, res, next) {
  const customer = await findCustomer(req);
  if (!customer) throw new HttpError(401, 'Entre com sua conta Google para ver suas reservas.');
  req.customer = customer;
  next();
}
