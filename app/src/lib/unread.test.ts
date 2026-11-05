import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockTime, dayLabel, mergeFeed, unreadAnnouncements, unreadCount } from './unread.ts';

const m = (id: string, at: string, sender: string) => ({ id, created_at: at, sender_id: sender });

test('unreadCount ignores own messages and anything before the marker', () => {
  const msgs = [m('1', '2027-02-15T08:00:00Z', 'guide'), m('2', '2027-02-15T09:00:00Z', 'me'), m('3', '2027-02-15T10:00:00Z', 'guide')];
  assert.equal(unreadCount(msgs, null, 'me'), 2);
  assert.equal(unreadCount(msgs, '2027-02-15T08:30:00Z', 'me'), 1);
  assert.equal(unreadCount(msgs, '2027-02-15T10:00:00Z', 'me'), 0);
});

test('unreadAnnouncements', () => {
  const a = [{ send_at: '2027-02-15T07:45:00Z', created_by: 'g' }];
  assert.equal(unreadAnnouncements(a, undefined, 'me'), 1);
  assert.equal(unreadAnnouncements(a, '2027-02-15T08:00:00Z', 'me'), 0);
  assert.equal(unreadAnnouncements(a, undefined, 'g'), 0);
});

test('mergeFeed sorts oldest first across both sources', () => {
  const feed = mergeFeed([{ created_at: '2027-02-15T09:00:00Z' }], [{ send_at: '2027-02-15T08:00:00Z' }, { send_at: '2027-02-15T10:00:00Z' }]);
  assert.deepEqual(feed.map((f) => f.kind), ['announcement', 'message', 'announcement']);
});

test('day labels and times use the trip time zone', () => {
  // 23:30 UTC on the 14th is 00:30 on the 15th in Vienna
  assert.equal(dayLabel('2027-02-14T23:30:00Z', '2027-02-15', 'Europe/Vienna'), 'Tänään');
  assert.equal(dayLabel('2027-02-14T08:00:00Z', '2027-02-15', 'Europe/Vienna'), 'Eilen');
  assert.equal(dayLabel('2027-02-13T08:00:00Z', '2027-02-15', 'Europe/Vienna'), 'la 13.2.');
  assert.equal(dayLabel('2027-02-16T08:00:00Z', '2027-02-15', 'Europe/Vienna'), 'Huomenna');
  assert.equal(clockTime('2027-02-15T07:45:00Z', 'Europe/Vienna'), '08:45');
});
