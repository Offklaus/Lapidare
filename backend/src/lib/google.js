/* Login com Google: o front recebe um "ID token" do Google e o servidor confere a assinatura,
   o público (nosso Client ID) e a validade antes de confiar nele. */
import { OAuth2Client } from 'google-auth-library';

import { config } from '../config.js';
import { HttpError } from './errors.js';

let client = null;

/** Payload do token → perfil que usamos. Exige e-mail verificado pelo Google. */
export function profileFromGooglePayload(payload) {
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new HttpError(401, 'Sua conta Google precisa ter um e-mail verificado.');
  }
  const email = payload.email.trim().toLowerCase();
  const name = (payload.name || payload.given_name || email.split('@')[0]).trim().slice(0, 120);
  return { sub: payload.sub, email, name, picture: payload.picture || null };
}

export async function verifyGoogleCredential(credential) {
  if (!config.googleClientId) {
    throw new HttpError(503, 'O login com Google ainda não foi configurado no salão.');
  }
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) {
    throw new HttpError(400, 'Login com Google inválido. Tente de novo.');
  }

  client ||= new OAuth2Client(config.googleClientId);
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: config.googleClientId });
  } catch {
    throw new HttpError(401, 'Não conseguimos confirmar seu login com o Google. Tente de novo.');
  }
  return profileFromGooglePayload(ticket.getPayload());
}
