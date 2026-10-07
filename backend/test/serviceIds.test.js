import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SERVICES, parseServiceIds } from '../src/lib/validate.js';

test('lista de serviços: corpo JSON, texto da URL ou o antigo serviceId', () => {
  assert.deepEqual(parseServiceIds({ serviceIds: ['manicure', 'pedicure'] }), ['manicure', 'pedicure']);
  assert.deepEqual(parseServiceIds({ serviceIds: 'manicure, pedicure' }), ['manicure', 'pedicure']);
  assert.deepEqual(parseServiceIds({ serviceId: 'manicure' }), ['manicure']);
  assert.deepEqual(parseServiceIds({ serviceIds: [], serviceId: 'manicure' }), ['manicure']);
});

test('mantém a ordem escolhida (é a ordem em que os serviços são feitos)', () => {
  assert.deepEqual(parseServiceIds({ serviceIds: ['pedicure', 'manicure'] }), ['pedicure', 'manicure']);
});

test('recusa lista vazia, repetida ou grande demais', () => {
  for (const body of [
    {},
    { serviceIds: ['manicure', ''] },
    { serviceIds: ['manicure', 'manicure'] },
    { serviceIds: Array.from({ length: MAX_SERVICES + 1 }, (_, i) => `s${i}`) },
    { serviceIds: [1, 2] },
  ]) {
    assert.throws(() => parseServiceIds(body), (err) => err.status === 400, JSON.stringify(body));
  }
});
