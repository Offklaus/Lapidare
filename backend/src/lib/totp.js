/* Códigos do app autenticador (Google Authenticator, Authy, 1Password…) — TOTP, RFC 6238.
   HMAC-SHA1, 6 dígitos, passo de 30 s. Só node:crypto, sem dependências. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Segredo base32 inválido.');
    value = ((value << 5) | idx) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Segredo novo (160 bits, o tamanho recomendado para HMAC-SHA1), em base32. */
export const generateSecret = () => base32Encode(randomBytes(20));

/** Código de `digits` dígitos para o passo `step` (= floor(segundos / 30)). */
export function hotp(secretBase32, step, digits = DIGITS) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const currentStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/**
 * Confere o código. Aceita o passo atual e um vizinho (±30 s de diferença no relógio do celular),
 * mas nunca um passo já usado (afterStep): o mesmo código não serve duas vezes.
 * → número do passo aceito, ou null.
 */
export function verifyTotp(secretBase32, code, { nowMs = Date.now(), window = 1, afterStep = null } = {}) {
  const clean = typeof code === 'string' ? code.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(clean)) return null;
  const now = currentStep(nowMs);
  for (let step = now - window; step <= now + window; step += 1) {
    if (afterStep !== null && afterStep !== undefined && step <= Number(afterStep)) continue;
    const expected = Buffer.from(hotp(secretBase32, step));
    if (timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

/** Endereço que o app autenticador entende (vira o QR code). */
export function otpauthUrl({ secret, account, issuer = 'Lapidare Beauty' }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
