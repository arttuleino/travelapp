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
    { _line: 5, email: 'sv@example.com', role: 'traveller', display_name: 'S', market: 'se' },
    { _line: 6, email: 'dk@example.com', role: 'traveller', display_name: 'D', market: 'DK' },
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
  assert.equal(r.members[3].market, 'SE');
  assert.equal(r.members[0].market, null);
  assert.match(text, /members.csv rivi 6: market pitää olla FI, SE tai NO/);
  assert.match(text, /programme.csv rivi 3: 2027-03-01 ei ole matkan aikana/);
  assert.match(text, /programme.csv rivi 3: starts_at/);
  assert.match(text, /programme.csv rivi 3: title puuttuu/);
});

test('validateTrip reads hotel details and the optional flights file', () => {
  const trip = [{ _line: 2, external_ref: 'X', name: 'N', destination: 'D', starts_on: '20.2.2027', ends_on: '27.2.2027', hotel_stars: '4', check_in_time: '15.00' }];
  const members = [{ _line: 2, email: 'g@x.fi', role: 'guide', display_name: 'G' }, { _line: 3, email: 't@x.fi', display_name: 'T', room_type: 'Kahden hengen huone' }];
  const flights = [
    { _line: 2, direction: 'OUT', flight_date: '20.2.2027', flight_no: 'AY1661', dep_code: 'hel', dep_time: '6:45', arr_code: 'SZG', arr_time: '8:35' },
    { _line: 3, direction: 'back', flight_date: '', flight_no: '', dep_code: 'SZG', dep_time: '25:00', arr_code: 'HEL', arr_time: '13:15' },
  ];
  const r = validateTrip(trip, members, [], flights);
  assert.equal(r.trip.hotel_stars, 4);
  assert.equal(r.trip.check_in_time, '15:00');
  assert.equal(r.members[1].room_type, 'Kahden hengen huone');
  assert.deepEqual([r.flights[0].direction, r.flights[0].dep_code, r.flights[0].dep_time], ['out', 'HEL', '06:45']);
  assert.deepEqual(r.errors, [
    'flights.csv rivi 3: direction pitää olla out tai return, ei "back"',
    'flights.csv rivi 3: flight_date ei ole päivämäärä: ""',
    'flights.csv rivi 3: dep_time ei ole kellonaika: "25:00"',
    'flights.csv rivi 3: flight_no puuttuu',
  ]);
  assert.match(validateTrip([{ ...trip[0], hotel_stars: '6' }], members, []).errors[0], /hotel_stars/);
});
