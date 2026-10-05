import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMoney, parseServiceInput, serviceSlug } from '../src/lib/serviceInput.js';

const valid = { name: '  Manicure   tradicional ', category: 'Unhas', duration: 45, price: 45.9 };

test('limpa os textos e converte o preço para centavos', () => {
  assert.deepEqual(parseServiceInput(valid), {
    name: 'Manicure tradicional',
    category: 'Unhas',
    description: '',
    durationMin: 45,
    priceCents: 4590,
    active: true,
  });
});

test('preço em texto no padrão brasileiro', () => {
  assert.equal(parseMoney('45,90'), 45.9);
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('45.90'), 45.9);
  assert.ok(Number.isNaN(parseMoney('quarenta')));
  assert.equal(parseServiceInput({ ...valid, price: '120,00' }).priceCents, 12000);
});

test('arredonda centavos sem erro de ponto flutuante', () => {
  assert.equal(parseServiceInput({ ...valid, price: 19.99 }).priceCents, 1999);
  assert.equal(parseServiceInput({ ...valid, price: 0 }).priceCents, 0);
});

test('recusa dados inválidos com mensagem para a equipe', () => {
  const bad = [
    { ...valid, name: 'A' },
    { ...valid, category: '' },
    { ...valid, duration: 0 },
    { ...valid, duration: 45.5 },
    { ...valid, duration: 601 },
    { ...valid, price: -1 },
    { ...valid, price: 'grátis' },
    { ...valid, price: 100001 },
    { ...valid, description: 'x'.repeat(201) },
    { ...valid, active: 'sim' },
  ];
  for (const body of bad) assert.throws(() => parseServiceInput(body), (err) => err.status === 400, JSON.stringify(body));
});

test('id do serviço a partir do nome', () => {
  assert.equal(serviceSlug('Esmaltação em gel'), 'esmaltacao-em-gel');
  assert.equal(serviceSlug('Depilação a laser — axilas'), 'depilacao-a-laser-axilas');
  assert.equal(serviceSlug('!!!'), 'servico');
  assert.ok(serviceSlug('a'.repeat(100)).length <= 48);
});
