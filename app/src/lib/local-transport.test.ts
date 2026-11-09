import { test } from 'node:test';
import assert from 'node:assert/strict';

import { localTransportFor, normalizePlace } from './local-transport.ts';

test('normalizePlace drops accents and punctuation', () => {
  assert.equal(normalizePlace('Sölden'), 'solden');
  assert.equal(normalizePlace('St. Anton am Arlberg'), 'st anton am arlberg');
  assert.equal(normalizePlace("Sauze d'Oulx"), 'sauze d oulx');
});

test('every STS destination gets advice', () => {
  const sts = [
    'Bad Gastein',
    'Mayrhofen',
    'Saalbach-Hinterglemm',
    'Obergurgl',
    'Sölden',
    'St Anton',
    'Ischgl',
    'Schladming',
    'Zell am See',
    'Lech-Zürs',
    'Cervinia',
    'Courmayeur',
    'Champoluc',
    'Val Gardena',
    'Canazei',
    "Sauze d'Oulx",
    'Val Thorens',
    'Les Menuires',
  ];
  for (const d of sts) assert.ok(localTransportFor(d), d);
});

test('picks the regional app', () => {
  assert.equal(localTransportFor('Saalbach-Hinterglemm')?.app?.name, 'Salzburg Verkehr');
  assert.equal(localTransportFor('Sölden')?.app?.name, 'VVT SmartRide');
  assert.equal(localTransportFor('Lech-Zürs')?.app?.name, 'cleVVVer mobil');
  assert.equal(localTransportFor('Val Thorens')?.skibusFree, true);
  assert.equal(localTransportFor("Sauze d'Oulx")?.app, null);
  assert.equal(localTransportFor('Levi'), null);
});
