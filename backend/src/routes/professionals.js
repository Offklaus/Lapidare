import { Router } from 'express';
import { query } from '../db/pool.js';
import { parseServiceIds } from '../lib/validate.js';

export const professionalsRouter = Router();

/**
 * GET /professionals?serviceIds=a,b (ou serviceId=) → [{ id, name, role, specialties, photo }].
 * Com serviços, só quem faz TODOS eles (vários serviços são feitos em sequência pela mesma profissional);
 * sem serviço, todas.
 */
professionalsRouter.get('/', async (req, res) => {
  const serviceIds = req.query.serviceIds || req.query.serviceId ? parseServiceIds(req.query) : null;

  const { rows } = await query(
    `SELECT p.id, p.name, p.role, p.photo_url,
            COALESCE(array_agg(DISTINCT s.category ORDER BY s.category) FILTER (WHERE s.id IS NOT NULL), '{}') AS specialties
       FROM professionals p
       LEFT JOIN professional_services ps ON ps.professional_id = p.id
       LEFT JOIN services s ON s.id = ps.service_id AND s.active
      WHERE p.active
        AND ($1::text[] IS NULL OR (
              SELECT count(DISTINCT x.service_id) FROM professional_services x
               WHERE x.professional_id = p.id AND x.service_id = ANY($1::text[])) = cardinality($1::text[]))
      GROUP BY p.id
      ORDER BY p.sort, p.name`,
    [serviceIds],
  );

  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      specialties: p.specialties,
      photo: p.photo_url,
    })),
  );
});
