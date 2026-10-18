import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkPasswordStrength } from '../src/lib/password.js';
import { open, seal } from '../src/lib/secretBox.js';
import { base32Decode, base32Encode, generateSecret, hotp, otpauthUrl, verifyTotp } from '../src/lib/totp.js';

// Segredo do RFC 6238 (apêndice B): "12345678901234567890" em base32.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

test('TOTP bate com os vetores oficiais do RFC 6238 (SHA-1)', () => {
  // Tempos do RFC → código de 8 dígitos; os 6 últimos são o que o app mostra.
  const vectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ];
  for (const [seconds, code] of vectors) {
    assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30), 8), code);
    assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30)), code.slice(-6));
  }
});

test('TOTP aceita ±30 s, recusa código já usado e lixo', () => {
  const nowMs = 1234567890 * 1000;
  const step = Math.floor(1234567890 / 30);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { nowMs }), step);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { nowMs }), step - 1);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), { nowMs }), null); // velho demais
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { nowMs, afterStep: step }), null); // reuso
  for (const junk of ['', '12345', '1234567', 'abcdef', null, 123456]) {
    assert.equal(verifyTotp(RFC_SECRET, junk, { nowMs }), null);
  }
});

test('segredo novo tem 160 bits e vira um endereço otpauth válido', () => {
  const secret = generateSecret();
  assert.equal(base32Decode(secret).length, 20);
  assert.match(
    otpauthUrl({ secret, account: 'nicole@exemplo.com' }),
    /^otpauth:\/\/totp\/Lapidare%20Beauty%3Anicole%40exemplo\.com\?secret=/,
  );
});

test('cifra do segredo: abre o que fechou; texto mexido ou de outro propósito é recusado', () => {
  const sealed = seal('SEGREDO-DE-TESTE');
  assert.match(sealed, /^v1\./);
  assert.ok(!sealed.includes('SEGREDO'));
  assert.equal(open(sealed), 'SEGREDO-DE-TESTE');
  assert.notEqual(seal('SEGREDO-DE-TESTE'), sealed, 'cada cifra usa um IV novo');

  const parts = sealed.split('.');
  const tampered = [...parts.slice(0, 3), Buffer.from('outro texto').toString('base64url')].join('.');
  assert.throws(() => open(tampered));
  assert.throws(() => open(sealed, 'outro-proposito'));
  assert.throws(() => open('lixo'));
});

test('senha da equipe: tamanho, comuns, só números, nome ou e-mail', () => {
  const who = { email: 'nicole.pereira@exemplo.com', name: 'Nicole Pereira' };
  const weak = ['curta', '1234567890', 'aaaaaaaaaa', 'Senha12345', 'lapidare123', 'nicole-2026-xx', 'pereira-bonita', 'x'.repeat(129)];
  for (const password of weak) {
    assert.ok(checkPasswordStrength(password, who), `deveria recusar: ${password.slice(0, 20)}`);
  }
  assert.equal(checkPasswordStrength('Girassol-de-vidro-42', who), null);
  assert.equal(checkPasswordStrength('três palavras quaisquer juntas', who), null);
});
