import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeDays, computeSlots, slotsForProfessional } from '../src/services/availability.js';
import { addDays, isISODate, toAbs, weekday } from '../src/lib/time.js';

// 2026-09-29 é uma terça-feira (weekday 2).
const TUE = '2026-09-29';
const LONG_AGO = 0; // "agora" bem no passado: nenhum horário vencido

const pro = (id, extra = {}) => ({
  id,
  windows: { 2: [{ start: 9 * 60, end: 12 * 60 }] }, // terça 09:00–12:00
  busy: [],
  blocked: [],
  ...extra,
});

test('datas e dias da semana', () => {
  assert.equal(weekday(TUE), 2);
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('29/09/2026'));
});

test('só oferece inícios em que a duração inteira cabe no expediente', () => {
  const slots = slotsForProfessional({ pro: pro('a'), date: TUE, duration: 60, step: 30, nowAbs: LONG_AGO });
  assert.deepEqual(
    slots.map((s) => s.time),
    ['09:00', '09:30', '10:00', '10:30', '11:00'],
  );
  assert.ok(slots.every((s) => s.status === 'available' && s.professionalId === 'a'));
});

test('agendamento existente ocupa todos os inícios que se sobrepõem a ele', () => {
  const busy = [{ start: toAbs(TUE, 10 * 60), end: toAbs(TUE, 10 * 60 + 30) }]; // 10:00–10:30
  const slots = slotsForProfessional({ pro: pro('a', { busy }), date: TUE, duration: 60, step: 30, nowAbs: LONG_AGO });
  const status = Object.fromEntries(slots.map((s) => [s.time, s.status]));
  assert.equal(status['09:00'], 'available'); // termina 10:00, encosta mas não sobrepõe
  assert.equal(status['09:30'], 'booked');
  assert.equal(status['10:00'], 'booked');
  assert.equal(status['10:30'], 'available');
});

test('folga e horário passado aparecem como blocked', () => {
  const blocked = [{ start: toAbs(TUE, 11 * 60), end: toAbs(TUE, 12 * 60) }];
  const nowAbs = toAbs(TUE, 9 * 60 + 15); // agora = 09:15
  const slots = slotsForProfessional({ pro: pro('a', { blocked }), date: TUE, duration: 30, step: 30, nowAbs });
  const status = Object.fromEntries(slots.map((s) => [s.time, s.status]));
  assert.equal(status['09:00'], 'blocked'); // já passou
  assert.equal(status['09:30'], 'available');
  assert.equal(status['11:00'], 'blocked'); // folga
  assert.equal(status['11:30'], 'blocked');
});

test('"primeiro horário livre" escolhe a primeira profissional disponível em cada horário', () => {
  const busyA = [{ start: toAbs(TUE, 9 * 60), end: toAbs(TUE, 10 * 60) }];
  const slots = computeSlots({
    pros: [pro('a', { busy: busyA }), pro('b')],
    date: TUE,
    duration: 60,
    step: 60,
    nowAbs: LONG_AGO,
  });
  assert.deepEqual(
    slots.map((s) => `${s.time} ${s.status} ${s.professionalId}`),
    ['09:00 available b', '10:00 available a', '11:00 available a'],
  );
});

test('dias sem expediente ou sem horário livre vêm como indisponíveis', () => {
  const days = computeDays({ pros: [pro('a')], from: '2026-09-27', days: 3, duration: 60, step: 30, nowAbs: LONG_AGO });
  assert.deepEqual(days, [
    { date: '2026-09-27', available: false }, // domingo
    { date: '2026-09-28', available: false }, // segunda sem expediente neste teste
    { date: '2026-09-29', available: true },
  ]);
});

test('serviço mais longo que o expediente não gera horário', () => {
  const slots = slotsForProfessional({ pro: pro('a'), date: TUE, duration: 240, step: 30, nowAbs: LONG_AGO });
  assert.equal(slots.length, 0);
});
