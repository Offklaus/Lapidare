/* Cifra de segredos guardados no banco (ex.: segredo do 2FA), com AES-256-GCM.
   A chave sai de APP_SECRET (variável de ambiente, nunca no git) por HKDF: quem copiar só o banco não
   consegue usar os segredos. Formato guardado: v1.iv.tag.texto (base64url). */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import { config } from '../config.js';

// Só para o computador de quem desenvolve: em produção APP_SECRET é obrigatório (ver hasSecretKey).
const DEV_FALLBACK = 'lapidare-dev-only-secret-nao-use-em-producao-0000000';

export const hasSecretKey = () => Boolean(config.appSecret) || !config.isProduction;

function key(purpose) {
  const secret = config.appSecret || (config.isProduction ? null : DEV_FALLBACK);
  if (!secret) throw new Error('APP_SECRET não configurado.');
  return Buffer.from(hkdfSync('sha256', secret, 'lapidare', `secretbox:${purpose}`, 32));
}

export function seal(plaintext, purpose = 'totp') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(purpose), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** Abre o que `seal` guardou. Se alguém mexeu no texto (ou a chave mudou), lança erro. */
export function open(sealed, purpose = 'totp') {
  const [version, iv, tag, data] = String(sealed).split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Segredo em formato desconhecido.');
  const decipher = createDecipheriv('aes-256-gcm', key(purpose), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
