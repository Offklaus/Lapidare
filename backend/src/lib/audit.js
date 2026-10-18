/* Registro de ações sobre as contas da equipe (staff_audit_log): quem fez, o quê, em quem e quando.
   LGPD: guarda só o necessário para responder "quem deu esse acesso?". Nunca senha, token, segredo do
   2FA, IP ou dados de clientes — `details` aceita só os campos da lista abaixo. */
import { query } from '../db/pool.js';

const ALLOWED_DETAILS = ['role', 'from', 'to', 'professionalId', 'active', 'reason'];

export async function audit({ actorId = null, action, targetUserId = null, details = {} }, db = { query }) {
  const safe = Object.fromEntries(Object.entries(details).filter(([k]) => ALLOWED_DETAILS.includes(k)));
  await db.query(
    'INSERT INTO staff_audit_log (actor_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
    [actorId, action, targetUserId, safe],
  );
}
