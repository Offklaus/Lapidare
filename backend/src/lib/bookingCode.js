/* Código do agendamento: 8 caracteres sem I, O, 0 e 1 (32⁸ ≈ 1 trilhão de combinações).
   Guardado sem hífen ('K7QM4XZP'); exibido e aceito como 'K7QM-4XZP'. */
import { randomInt } from 'node:crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

export function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** 'k7qm-4xzp' → 'K7QM4XZP'; null se não tem cara de código. */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

/** 'K7QM4XZP' → 'K7QM-4XZP' */
export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
