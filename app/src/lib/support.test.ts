import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CUSTOMER_SERVICE, hoursText, isOpen, marketFor } from './support.ts';

test('marketFor uses the booking market, else the app language', () => {
  assert.equal(marketFor('NO', 'fi'), 'NO');
  assert.equal(marketFor(null, 'sv'), 'SE');
  assert.equal(marketFor(null, 'no'), 'NO');
  assert.equal(marketFor(undefined, 'de'), 'FI');
});

test('hoursText', () => {
  assert.equal(hoursText(CUSTOMER_SERVICE.FI), '10–13 & 15–17');
  assert.equal(hoursText(CUSTOMER_SERVICE.SE), '9–12 & 14–16');
});

test('isOpen follows the office time zone', () => {
  // Monday 15.2.2027 10:30 UTC = 12:30 in Helsinki (open), 11:30 in Stockholm (open)
  assert.equal(isOpen(CUSTOMER_SERVICE.FI, new Date('2027-02-15T10:30:00Z')), true);
  assert.equal(isOpen(CUSTOMER_SERVICE.SE, new Date('2027-02-15T10:30:00Z')), true);
  // 11:30 UTC = 13:30 Helsinki (lunch break), 12:30 Stockholm (lunch break)
  assert.equal(isOpen(CUSTOMER_SERVICE.FI, new Date('2027-02-15T11:30:00Z')), false);
  assert.equal(isOpen(CUSTOMER_SERVICE.NO, new Date('2027-02-15T11:30:00Z')), false);
  // Saturday
  assert.equal(isOpen(CUSTOMER_SERVICE.FI, new Date('2027-02-20T10:30:00Z')), false);
});
