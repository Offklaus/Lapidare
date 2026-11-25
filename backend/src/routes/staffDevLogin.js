/* Entrada rápida de admin SÓ NO COMPUTADOR DE DESENVOLVIMENTO: pula senha e 2FA para testar o painel.
   Três travas, todas obrigatórias:
     1. só é montada com DEV_STAFF_LOGIN=true no backend/.env;
     2. nunca em produção (com NODE_ENV=production o servidor nem sobe se a variável estiver ligada — config.js);
     3. só aceita pedidos vindos do próprio computador (127.0.0.1 / ::1), nunca da rede.
   Entra sempre na conta "Admin (dev)" <admin.dev@lapidare.test>, criada aqui se não existir, sem senha
   utilizável: ela não entra pelo login normal. Cada entrada fica no registro de ações (dev_login). */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { query } from '../db/pool.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { publicStaff, startSession } from '../lib/staffAuth.js';

export const DEV_ADMIN_EMAIL = 'admin.dev@lapidare.test';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const staffDevLoginRouter = Router();

/** POST /staff/dev-login → { user } + cookie de sessão de admin (só desenvolvimento). */
staffDevLoginRouter.post('/dev-login', async (req, res) => {
  // Endereço da conexão, não cabeçalho: X-Forwarded-For não engana esta conferência.
  if (!LOOPBACK.has(req.socket.remoteAddress)) throw new HttpError(404, 'Não encontrado.');

  // Senha aleatória que ninguém conhece: a conta só entra por aqui.
  const unusable = await hashPassword(randomBytes(32).toString('base64url'));
  const { rows } = await query(
    `INSERT INTO staff_users (email, name, password_hash, role, active)
     VALUES ($1, 'Admin (dev)', $2, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', active = true, professional_id = NULL, updated_at = now()
     RETURNING id, name, email, role, professional_id, totp_enabled_at`,
    [DEV_ADMIN_EMAIL, unusable],
  );
  const user = rows[0];

  await audit({ actorId: user.id, action: 'dev_login', targetUserId: user.id });
  await startSession(res, user);
  res.json({ user: publicStaff(user) });
});
