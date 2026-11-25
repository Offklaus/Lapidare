/* Login da equipe com Google: qual conta da equipe corresponde a uma conta Google já conferida
   (lib/google.js confere assinatura, validade e e-mail verificado antes de chegar aqui).
   Regras:
     - só entra quem uma admin cadastrou em Usuários, ou um e-mail listado em ADMIN_EMAILS (config do servidor):
       esse vira admin sozinho no primeiro login com Google. Ninguém vira equipe só por ter conta Google;
     - conta já presa a uma conta Google: só aquela conta Google (pelo sub) entra;
     - conta desativada não entra, nem se o e-mail estiver em ADMIN_EMAILS (desativar continua valendo);
     - primeiro login: o e-mail verificado do Google precisa ser o mesmo da conta, e a conta Google fica presa
       a ela; links de convite ou de senha que estavam abertos deixam de valer (a pessoa já entrou). */
import { config } from '../config.js';
import { audit } from './audit.js';
import { HttpError } from './errors.js';

export const NO_STAFF_ACCESS =
  'Esta conta Google não tem acesso à área da equipe. Peça a uma admin do salão para cadastrar seu e-mail em Usuários.';

const COLUMNS = 'id, name, email, role, professional_id, totp_enabled_at, google_sub, active';

/** profile: { sub, email, name } do Google → linha da conta da equipe (dentro da transação `db`). */
export async function staffForGoogle(profile, db) {
  const bySub = await db.query(`SELECT ${COLUMNS} FROM staff_users WHERE google_sub = $1 AND active FOR UPDATE`, [
    profile.sub,
  ]);
  if (bySub.rows[0]) return bySub.rows[0];

  const byEmail = await db.query(`SELECT ${COLUMNS} FROM staff_users WHERE email = $1 FOR UPDATE`, [profile.email]);
  const user = byEmail.rows[0];

  if (!user) {
    if (!config.adminEmails.includes(profile.email)) throw new HttpError(403, NO_STAFF_ACCESS);
    return createConfiguredAdmin(profile, db);
  }
  // Desativada, ou já presa a OUTRA conta Google (mesmo e-mail não basta).
  if (!user.active || user.google_sub) throw new HttpError(403, NO_STAFF_ACCESS);

  await db.query('UPDATE staff_users SET google_sub = $2, updated_at = now() WHERE id = $1', [user.id, profile.sub]);
  await db.query('DELETE FROM staff_tokens WHERE user_id = $1', [user.id]);
  await audit({ actorId: user.id, action: 'google_linked', targetUserId: user.id }, db);
  return { ...user, google_sub: profile.sub };
}

/** E-mail de ADMIN_EMAILS entrando pela primeira vez: cria a conta admin já presa à conta Google. */
async function createConfiguredAdmin(profile, db) {
  const { rows: admins } = await db.query("SELECT count(*)::int AS n FROM staff_users WHERE role = 'admin' AND active");
  if (admins[0].n >= config.maxAdmins) {
    throw new HttpError(409, `Já existem ${config.maxAdmins} admins ativas. Desative uma em Usuários antes.`);
  }
  const name = (profile.name || profile.email.split('@')[0]).trim().slice(0, 120);
  const { rows } = await db.query(
    `INSERT INTO staff_users (email, name, role, google_sub, active) VALUES ($1, $2, 'admin', $3, true)
     RETURNING ${COLUMNS}`,
    [profile.email, name, profile.sub],
  );
  await audit({ actorId: rows[0].id, action: 'admin_from_config', targetUserId: rows[0].id, details: { role: 'admin' } }, db);
  return rows[0];
}
