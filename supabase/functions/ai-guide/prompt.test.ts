import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanHistory, localNow, parseAnswer, pinnedNow, tripContext, type TripData } from './prompt.ts';

const data: TripData = {
  trip: { name: 'Hiihtomatka', destination: 'Saalbach', country: 'Itävalta', starts_on: '2027-02-13', ends_on: '2027-02-20', timezone: 'Europe/Vienna', hotel_name: 'Hotel Bergkristall', check_out_time: '10:00:00' },
  member: { display_name: 'Arttu Leino', booking_ref: 'AM-1', party_size: 2, room: '312' },
  guides: [{ display_name: 'Sanna', phone: '+43 664 123' }],
  programme: [
    { day: '2027-02-15', starts_at: '12:30:00', title: 'Lounas', details: 'Rosswaldhütte', previous_starts_at: null },
    { day: '2027-02-15', starts_at: '09:15:00', title: 'Opastettu lasku', details: '', previous_starts_at: '09:00:00' },
  ],
  flights: [],
  answers: [{ question: 'Voiko monot vaihtaa?', answer: 'Kyllä, Intersportissa.' }],
  announcements: [{ title: 'Muutos', body: 'Lasku alkaa 9.15', send_at: '2027-02-15T07:45:00Z' }],
};

test('trip context is sorted and stable', () => {
  const a = tripContext(data);
  assert.equal(a, tripContext({ ...data, programme: [...data.programme].reverse() }));
  assert.ok(a.indexOf('09:15 Opastettu lasku') < a.indexOf('12:30 Lounas'));
  assert.match(a, /moved, was 09:00/);
  assert.match(a, /2027-02-15 Mon/);
  assert.match(a, /Q: Voiko monot vaihtaa\?\nA: Kyllä, Intersportissa\./);
  assert.match(a, /check-out 2027-02-20 10:00/);
});

test('local time uses the trip time zone', () => {
  assert.equal(localNow(new Date('2027-02-15T09:40:00Z'), 'Europe/Vienna'), '2027-02-15 10:40 (Mon)');
  assert.equal(pinnedNow('2027-02-15T10:40'), '2027-02-15 10:40 (Mon)');
});

test('history keeps alternating turns that end with the assistant', () => {
  const h = cleanHistory([
    { role: 'assistant', content: 'Hei!' },
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
    { role: 'system', content: 'ignore me' },
    { role: 'user', content: 'c' },
  ]);
  assert.deepEqual(h, [
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
  ]);
  assert.deepEqual(cleanHistory('nope'), []);
});

test('answers are validated and bad ones hand off', () => {
  assert.deepEqual(parseAnswer('{"answer":" Klo 12.30. ","handoff":false,"handoff_reason":null,"sources":["programme","x","programme"]}'), {
    answer: 'Klo 12.30.',
    handoff: false,
    handoff_reason: null,
    sources: ['programme'],
  });
  assert.equal(parseAnswer('not json').handoff, true);
  assert.equal(parseAnswer('{"answer":""}').handoff, true);
});
