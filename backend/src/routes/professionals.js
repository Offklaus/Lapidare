import { Router } from 'express';
import { query } from '../db/pool.js';
import { parseId } from '../lib/validate.js';

export const professionalsRouter = Router();

/** GET /professionals?serviceId= → [{ id, name, role, specialties, photo }]. Sem serviceId, lista todas. */
professionalsRouter.get('/', async (req, res) => {
  const serviceId = req.query.serviceId ? parseId(req.query.serviceId, 'serviceId', 'o serviço') : null;

  const { rows } = await query(
    `SELECT p.id, p.name, p.role, p.photo_url,
            COALESCE(array_agg(DISTINCT s.category ORDER BY s.category) FILTER (WHERE s.id IS NOT NULL), '{}') AS specialties
       FROM professionals p
       LEFT JOIN professional_services ps ON ps.professional_id = p.id
       LEFT JOIN services s ON s.id = ps.service_id AND s.active
      WHERE p.active
        AND ($1::text IS NULL OR EXISTS (
              SELECT 1 FROM professional_services x WHERE x.professional_id = p.id AND x.service_id = $1))
      GROUP BY p.id
      ORDER BY p.sort, p.name`,
    [serviceId],
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
