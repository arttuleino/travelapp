import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, currentIndex, formatDay, formatRange, normalizeTime, pickActiveTrip, tripClock, tripDays, zonedTimeToUtc } from './time.ts';

test('tripClock uses the destination time zone', () => {
  // 09:40 UTC = 10:40 in Vienna (CET, winter)
  assert.deepEqual(tripClock('Europe/Vienna', new Date('2027-02-15T09:40:00Z')), { date: '2027-02-15', time: '10:40' });
  // just after midnight in Vienna is still the previous day in UTC
  assert.deepEqual(tripClock('Europe/Vienna', new Date('2027-02-14T23:30:00Z')), { date: '2027-02-15', time: '00:30' });
});

test('tripClock override pins the clock', () => {
  assert.deepEqual(tripClock('Europe/Vienna', new Date(), '2027-02-15T10:40'), { date: '2027-02-15', time: '10:40' });
});

test('currentIndex finds the item in progress', () => {
  const items = [{ starts_at: '08:45:00' }, { starts_at: '09:15:00' }, { starts_at: '12:30:00' }];
  assert.equal(currentIndex(items, '08:00'), -1);
  assert.equal(currentIndex(items, '09:15'), 1);
  assert.equal(currentIndex(items, '10:40'), 1);
  assert.equal(currentIndex(items, '23:59'), 2);
});

test('tripDays is inclusive and crosses months', () => {
  assert.equal(tripDays('2027-02-13', '2027-02-20').length, 8);
  assert.deepEqual(tripDays('2027-02-27', '2027-03-01'), ['2027-02-27', '2027-02-28', '2027-03-01']);
});

test('Finnish date formatting', () => {
  assert.equal(formatDay('2027-02-15'), 'ma 15.2.');
  assert.equal(formatRange('2027-02-13', '2027-02-20'), '13.–20.2.2027');
  assert.equal(formatRange('2027-02-27', '2027-03-06'), '27.2.–6.3.2027');
  assert.equal(formatRange('2026-12-28', '2027-01-04'), '28.12.2026–4.1.2027');
});

test('normalizeTime accepts common inputs', () => {
  assert.equal(normalizeTime('9:15'), '09:15');
  assert.equal(normalizeTime('0915'), '09:15');
  assert.equal(normalizeTime('9.15'), '09:15');
  assert.equal(normalizeTime('24:00'), null);
  assert.equal(normalizeTime('abc'), null);
});

test('pickActiveTrip prefers ongoing, then upcoming, then latest', () => {
  const past = { starts_on: '2026-01-01', ends_on: '2026-01-08' };
  const now = { starts_on: '2027-02-13', ends_on: '2027-02-20' };
  const next = { starts_on: '2027-03-01', ends_on: '2027-03-08' };
  assert.equal(pickActiveTrip([past, now, next], '2027-02-15'), now);
  assert.equal(pickActiveTrip([past, next], '2027-02-15'), next);
  assert.equal(pickActiveTrip([past], '2027-02-15'), past);
  assert.equal(pickActiveTrip([], '2027-02-15'), null);
});

test('zonedTimeToUtc converts destination wall-clock time to an instant', () => {
  assert.equal(zonedTimeToUtc('2027-02-15', '08:45', 'Europe/Vienna'), '2027-02-15T07:45:00.000Z'); // winter, UTC+1
  assert.equal(zonedTimeToUtc('2027-07-01', '08:45', 'Europe/Vienna'), '2027-07-01T06:45:00.000Z'); // summer, UTC+2
  assert.equal(zonedTimeToUtc('2027-03-28', '12:00', 'Europe/Vienna'), '2027-03-28T10:00:00.000Z'); // DST change day
  assert.equal(zonedTimeToUtc('2027-02-15', '00:30', 'Europe/Helsinki'), '2027-02-14T22:30:00.000Z');
});

test('addDays crosses months', () => {
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
});
