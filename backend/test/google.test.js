import { test } from 'node:test';
import assert from 'node:assert/strict';

import { profileFromGooglePayload } from '../src/lib/google.js';

test('google: usa sub, e-mail em minúsculas, nome e foto', () => {
  const profile = profileFromGooglePayload({
    sub: '1234567890',
    email: 'Maria.Silva@Gmail.com',
    email_verified: true,
    name: 'Maria Silva',
    picture: 'https://lh3.googleusercontent.com/a/foto',
  });
  assert.deepEqual(profile, {
    sub: '1234567890',
    email: 'maria.silva@gmail.com',
    name: 'Maria Silva',
    picture: 'https://lh3.googleusercontent.com/a/foto',
  });
});

test('google: sem nome, usa o começo do e-mail', () => {
  const profile = profileFromGooglePayload({ sub: '1', email: 'ana@exemplo.com', email_verified: true });
  assert.equal(profile.name, 'ana');
  assert.equal(profile.picture, null);
});

test('google: recusa e-mail não verificado ou token sem sub', () => {
  assert.throws(() => profileFromGooglePayload({ sub: '1', email: 'a@b.com', email_verified: false }), { status: 401 });
  assert.throws(() => profileFromGooglePayload({ email: 'a@b.com', email_verified: true }), { status: 401 });
  assert.throws(() => profileFromGooglePayload(undefined), { status: 401 });
});
