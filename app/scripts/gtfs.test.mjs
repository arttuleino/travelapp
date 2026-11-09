import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceM, feedRange, parseCsvLine, projectDates, resolveTime, rowReader, serviceDates } from './gtfs.mjs';

test('parseCsvLine handles quotes and escapes', () => {
  assert.deepEqual(parseCsvLine('1,"Saalbach, Postamt","Sag ""hi""",\r'), ['1', 'Saalbach, Postamt', 'Sag "hi"', '']);
  const read = rowReader('﻿stop_id,stop_name');
  assert.deepEqual(read('at:45:1,Hinterglemm'), { stop_id: 'at:45:1', stop_name: 'Hinterglemm' });
});

test('distanceM: Saalbach to Hinterglemm is about 4.5 km', () => {
  const d = distanceM(47.3913, 12.6364, 47.3771, 12.5843);
  assert.ok(d > 4000 && d < 4500, String(d));
});

const cal = [
  { service_id: 'WK', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20261201', end_date: '20261212' },
  { service_id: 'SA', monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '1', sunday: '0', start_date: '20261201', end_date: '20261212' },
];
const ex = [
  { service_id: 'WK', date: '20261208', exception_type: '2' }, // holiday (Tue)
  { service_id: 'SA', date: '20261208', exception_type: '1' }, // runs the Saturday timetable instead
];

test('serviceDates applies weekdays and exceptions', () => {
  const s = serviceDates(cal, ex, ['2026-12-05', '2026-12-07', '2026-12-08']);
  assert.deepEqual([...s.get('WK')], ['2026-12-07']);
  assert.deepEqual([...s.get('SA')].sort(), ['2026-12-05', '2026-12-08']);
});

test('projectDates fills days after the feed from the same weekday of its last week', () => {
  const range = feedRange(cal, ex);
  assert.deepEqual(range, { start: '2026-12-01', end: '2026-12-12' });
  const p = projectDates(['2026-12-11', '2027-02-15', '2027-02-20'], range);
  assert.equal(p.get('2026-12-11'), '2026-12-11'); // covered
  assert.equal(p.get('2027-02-15'), '2026-12-07'); // Monday → last Monday
  assert.equal(p.get('2027-02-20'), '2026-12-12'); // Saturday → last day itself
});

test('resolveTime rolls times past midnight to the next day', () => {
  assert.deepEqual(resolveTime('2027-02-15', '08:05:00'), { date: '2027-02-15', time: '08:05:00' });
  assert.deepEqual(resolveTime('2027-02-15', '25:10:00'), { date: '2027-02-16', time: '01:10:00' });
});
