import { Router } from 'express';
import { query } from '../db/pool.js';

export const servicesRouter = Router();

/** GET /services → [{ id, category, name, description, duration, price }] — preço em reais. */
servicesRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, category, name, description, duration_min, price_cents
       FROM services
      WHERE active
      ORDER BY sort, name`,
  );
  res.json(
    rows.map((s) => ({
      id: s.id,
      category: s.category,
      name: s.name,
      description: s.description,
      duration: s.duration_min,
      price: s.price_cents / 100,
    })),
  );
});
