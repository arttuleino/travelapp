import { test } from 'node:test';
import assert from 'node:assert/strict';

import { distanceM, freshness, initials, shouldSend } from './guide-location.ts';
import { mapFor } from './resort-map.ts';

test('distanceM: Saalbach to Hinterglemm is about 4 km', () => {
  const d = distanceM({ lat: 47.390317, lng: 12.635144 }, { lat: 47.375521, lng: 12.589408 });
  assert.ok(d > 3500 && d < 4000, String(d));
  assert.equal(distanceM({ lat: 47, lng: 12 }, { lat: 47, lng: 12 }), 0);
});

test('shouldSend throttles updates and skips GPS noise', () => {
  const at = 1_000_000;
  const last = { lat: 47.39, lng: 12.635, at };
  const moved = { lat: 47.3905, lng: 12.635 }; // ~55 m
  const jitter = { lat: 47.39005, lng: 12.635 }; // ~5 m
  assert.equal(shouldSend(null, moved, at), true);
  assert.equal(shouldSend(last, moved, at + 5_000), false, 'too soon');
  assert.equal(shouldSend(last, moved, at + 15_000), true, 'moved and 15 s passed');
  assert.equal(shouldSend(last, jitter, at + 30_000), false, 'only jitter');
  assert.equal(shouldSend(last, jitter, at + 60_000), true, 'heartbeat');
});

test('freshness: live, recent, old, hidden', () => {
  const now = Date.parse('2027-02-15T10:00:00Z');
  assert.deepEqual(freshness('2027-02-15T09:59:10Z', now), { state: 'live', minutes: 0 });
  assert.deepEqual(freshness('2027-02-15T09:50:00Z', now), { state: 'recent', minutes: 10 });
  assert.deepEqual(freshness('2027-02-15T07:00:00Z', now), { state: 'old', minutes: 180 });
  assert.equal(freshness('2027-02-14T20:00:00Z', now), null);
  assert.equal(freshness('nonsense', now), null);
  // A phone clock slightly ahead of the server never shows negative minutes.
  assert.deepEqual(freshness('2027-02-15T10:00:30Z', now), { state: 'live', minutes: 0 });
});

test('initials', () => {
  assert.equal(initials('Sanna Virtanen'), 'SV');
  assert.equal(initials('Luca'), 'L');
  assert.equal(initials('  '), '');
});

test('every place in the resort map has real coordinates near the resort', () => {
  const map = mapFor('Saalbach')!;
  const centre = { lat: 47.385, lng: 12.61 };
  for (const p of map.places) assert.ok(distanceM(centre, p) < 6000, p.id);
});
