/* Hash de senha com scrypt (node:crypto, sem dependências).
   Formato guardado: scrypt$N$r$p$salt(base64)$hash(base64) — os parâmetros vão junto para poder mudar no futuro. */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

// Senhas que aparecem no topo das listas de vazamentos (e variações óbvias do salão).
const COMMON = new Set([
  '1234567890', '12345678910', '0123456789', '1111111111', '0000000000', 'qwertyuiop', 'asdfghjkl1',
  'password123', 'password12', 'senha12345', 'senha123456', 'mudar12345', 'trocar1234', 'abc1234567',
  'iloveyou12', 'q1w2e3r4t5', 'qwerty1234', '123mudar123', 'admin12345', 'administrador',
  'lapidare123', 'lapidare2024', 'lapidare2025', 'lapidare2026', 'lapidarebeauty', 'salao12345',
]);

/**
 * Regras para senha nova da equipe. → mensagem dizendo o que corrigir, ou null se está boa.
 * Sem exigir símbolo "por obrigação": tamanho e não ser óbvia protegem mais.
 */
export function checkPasswordStrength(password, { email = '', name = '' } = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'Essa senha é muito comum. Escolha outra.';
  if (/^(.)\1+$/.test(password)) return 'A senha não pode ser um caractere repetido.';
  if (/^\d+$/.test(password)) return 'Use letras também, não só números.';
  const parts = [email.split('@')[0], ...String(name).split(/\s+/)]
    .map((p) => p.toLowerCase())
    .filter((p) => p.length >= 4);
  if (parts.some((p) => lower.includes(p))) return 'A senha não pode conter seu nome ou seu e-mail.';
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** true se a senha confere com o hash guardado. Comparação em tempo constante. */
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt' || typeof password !== 'string') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
