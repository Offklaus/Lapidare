import { Router } from 'express';
import { query } from '../db/pool.js';
import { parseProfessionalId } from '../lib/validate.js';

export const servicesRouter = Router();

/**
 * GET /services?professionalId= → [{ id, category, name, description, duration, price }] — preço em reais.
 * Com professionalId, só os serviços que essa profissional faz; sem ele (ou 'any'), todos.
 */
servicesRouter.get('/', async (req, res) => {
  const professionalId = parseProfessionalId(req.query.professionalId);
  const { rows } = await query(
    `SELECT s.id, s.category, s.name, s.description, s.duration_min, s.price_cents
       FROM services s
      WHERE s.active
        AND ($1::text IS NULL OR EXISTS (
              SELECT 1
                FROM professional_services ps
                JOIN professionals p ON p.id = ps.professional_id AND p.active
               WHERE ps.service_id = s.id AND ps.professional_id = $1))
      ORDER BY s.sort, s.name`,
    [professionalId === 'any' ? null : professionalId],
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
