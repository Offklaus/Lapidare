/* Área da cliente: login com Google e "Minhas reservas". Não dá acesso a nada da equipe. */
import { Router } from 'express';

import { config } from '../config.js';
import { query } from '../db/pool.js';
import { formatCode } from '../lib/bookingCode.js';
import { customerSessions, publicCustomer, requireCustomer } from '../lib/customerAuth.js';
import { verifyGoogleCredential } from '../lib/google.js';
import { rateLimit } from '../lib/rateLimit.js';

export const customerRouter = Router();

/** GET /customer/config → { googleClientId } (null enquanto o login com Google não estiver configurado) */
customerRouter.get('/config', (req, res) => {
  res.json({ googleClientId: config.googleClientId || null });
});

/**
 * POST /customer/login/google { credential }  (ID token entregue pelo botão do Google)
 * → { customer } + cookie de sessão · 401 token inválido · 503 login com Google não configurado
 */
customerRouter.post(
  '/login/google',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas de login. Espere alguns minutos.' }),
  async (req, res) => {
    const profile = await verifyGoogleCredential(req.body?.credential);

    // Cria a conta no primeiro login; nos seguintes, atualiza nome, e-mail e foto vindos do Google.
    const { rows } = await query(
      `INSERT INTO customers (google_sub, email, name, picture_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_sub) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name, picture_url = EXCLUDED.picture_url, last_login_at = now()
       RETURNING id, name, email, picture_url`,
      [profile.sub, profile.email, profile.name, profile.picture],
    );

    const token = await customerSessions.create(rows[0].id);
    res.cookie(customerSessions.cookieName, token, customerSessions.cookieOptions());
    res.json({ customer: publicCustomer(rows[0]) });
  },
);

customerRouter.post('/logout', async (req, res) => {
  await customerSessions.destroy(customerSessions.read(req));
  res.clearCookie(customerSessions.cookieName, customerSessions.cookieOptions({ withMaxAge: false }));
  res.status(204).end();
});

/* ---------- Daqui para baixo, só com a cliente logada ---------- */

customerRouter.use(requireCustomer);

customerRouter.get('/me', (req, res) => {
  res.json({ customer: publicCustomer(req.customer) });
});

/**
 * GET /customer/bookings → [{ code, status, date, time, isPast, service, professional, cancellation }]
 * Reservas feitas logada + reservas antigas com o mesmo e-mail (confirmado pelo Google). Mais recentes primeiro.
 */
customerRouter.get('/bookings', async (req, res) => {
  const { rows } = await query(
    `SELECT b.code, b.status,
            to_char(b.starts_at AT TIME ZONE $3, 'YYYY-MM-DD') AS date,
            to_char(b.starts_at AT TIME ZONE $3, 'HH24:MI') AS time,
            b.ends_at < now() AS is_past,
            (b.status IN ('pending', 'confirmed') AND now() <= b.starts_at - make_interval(hours => $4::int)) AS can_cancel,
            s.name AS service_name, s.duration_min, s.price_cents,
            p.name AS professional_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN professionals p ON p.id = b.professional_id
      WHERE b.customer_id = $1 OR lower(b.customer_email) = $2
      ORDER BY b.starts_at DESC
      LIMIT 100`,
    [req.customer.id, req.customer.email, config.timezone, config.cancelMinHours],
  );

  res.json(
    rows.map((b) => ({
      code: formatCode(b.code),
      status: b.status,
      date: b.date,
      time: b.time,
      isPast: b.is_past,
      service: { name: b.service_name, duration: b.duration_min, price: b.price_cents / 100 },
      professional: { name: b.professional_name },
      cancellation: { allowed: b.can_cancel },
    })),
  );
});
