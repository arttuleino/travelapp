import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toIsoDate, toTime, validateTrip } from './csv.mjs';

test('parses quoted fields, escapes and newlines', () => {
  const rows = parseCsv('title,details\n"Lounas, Rosswald","Sano ""moi""\nrivi 2"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Lounas, Rosswald');
  assert.equal(rows[0].details, 'Sano "moi"\nrivi 2');
  assert.equal(rows[0]._line, 2);
});

test('detects semicolon-separated Excel exports and BOM', () => {
  const rows = parseCsv('﻿email;display_name\r\nA@X.FI;Anna\r\n');
  assert.deepEqual([rows[0].email, rows[0].display_name], ['A@X.FI', 'Anna']);
});

test('date and time normalisation', () => {
  assert.equal(toIsoDate('15.2.2027'), '2027-02-15');
  assert.equal(toIsoDate('2027-02-15'), '2027-02-15');
  assert.equal(toIsoDate('15/2/2027'), null);
  assert.equal(toTime('9.15'), '09:15');
  assert.equal(toTime('09:15:00'), '09:15');
  assert.equal(toTime('25:00'), null);
});

test('validateTrip reports row-level errors', () => {
  const trip = [{ _line: 2, external_ref: 'X', name: 'N', destination: 'D', starts_on: '13.2.2027', ends_on: '2027-02-20' }];
  const members = [
    { _line: 2, email: 'Guide@Example.com', role: 'guide', display_name: 'G' },
    { _line: 3, email: 'guide@example.com', role: 'traveller', display_name: 'Dup' },
    { _line: 4, email: 'bad', role: 'boss', display_name: '' },
  ];
  const programme = [
    { _line: 2, day: '2027-02-15', starts_at: '9:15', title: 'Lasku' },
    { _line: 3, day: '2027-03-01', starts_at: 'x', title: '' },
  ];
  const r = validateTrip(trip, members, programme);
  assert.equal(r.trip.starts_on, '2027-02-13');
  assert.equal(r.members[0].email, 'guide@example.com');
  assert.equal(r.programme[0].starts_at, '09:15');
  const text = r.errors.join('\n');
  assert.match(text, /members.csv rivi 3: sähköposti guide@example.com on jo listalla/);
  assert.match(text, /members.csv rivi 4: virheellinen sähköposti/);
  assert.match(text, /members.csv rivi 4: role/);
  assert.match(text, /programme.csv rivi 3: 2027-03-01 ei ole matkan aikana/);
  assert.match(text, /programme.csv rivi 3: starts_at/);
  assert.match(text, /programme.csv rivi 3: title puuttuu/);
});
