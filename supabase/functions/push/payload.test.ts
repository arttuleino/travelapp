import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadTokens, eventFromWebhook, toExpoBatches } from './payload.ts';

test('batches of 100 and one push per device', () => {
  const rs = Array.from({ length: 205 }, (_, i) => ({ token: `T${i % 201}`, title: 't', body: 'b', url: '/chat' }));
  const batches = toExpoBatches(rs);
  assert.deepEqual(batches.map((b) => b.length), [100, 100, 1]);
  assert.equal(batches[0][0].data.url, '/chat');
  // Two different announcements to the same device are both sent.
  const two = toExpoBatches([{ token: 'A', title: 't1', body: 'b', url: '/chat' }, { token: 'A', title: 't2', body: 'b', url: '/chat' }]);
  assert.equal(two[0].length, 2);
});

test('deadTokens picks DeviceNotRegistered tickets by position', () => {
  const [batch] = toExpoBatches([
    { token: 'A', title: '', body: '', url: '' },
    { token: 'B', title: '', body: '', url: '' },
    { token: 'C', title: '', body: '', url: '' },
  ]);
  const tickets = [
    { status: 'ok' as const, id: '1' },
    { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
    { status: 'error' as const, details: { error: 'MessageRateExceeded' } },
  ];
  assert.deepEqual(deadTokens(batch, tickets), ['B']);
});

test('eventFromWebhook: message inserts, announcement inserts and the cron call', () => {
  assert.deepEqual(eventFromWebhook({ type: 'INSERT', table: 'messages', record: { id: 'x' } }), { kind: 'message', id: 'x' });
  assert.deepEqual(eventFromWebhook({ type: 'INSERT', table: 'announcements', record: { id: 'y' } }), { kind: 'due-announcements' });
  assert.deepEqual(eventFromWebhook({ due: true }), { kind: 'due-announcements' });
  assert.equal(eventFromWebhook({ due: 'yes' }), null);
  assert.equal(eventFromWebhook({ type: 'UPDATE', table: 'messages', record: { id: 'x' } }), null);
  assert.equal(eventFromWebhook({ type: 'INSERT', table: 'trips', record: { id: 'x' } }), null);
  assert.equal(eventFromWebhook(null), null);
});
