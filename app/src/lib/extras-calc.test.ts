import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checklistOrder, dueOf, summarize, type Signup } from './extras-calc.ts';

const s = (p: Partial<Signup>): Signup => ({ id: 'x', extra_id: 'e', member_id: 'm', persons: 1, status: 'unpaid', method: null, amount_paid: null, paid_at: null, ...p });

test('summarize counts what is collected, prepaid and still owed', () => {
  const extra = { price: '25.00' as unknown as number }; // numeric arrives as a string
  const sum = summarize(extra, [
    s({ persons: 2, status: 'prepaid' }),
    s({ persons: 1, status: 'paid', method: 'cash', amount_paid: 25 }),
    s({ persons: 2 }),
    s({ persons: 1 }),
  ]);
  assert.deepEqual(sum, { bookings: 4, persons: 6, unpaid: 2, prepaid: 50, collected: 25, outstanding: 75 });
  assert.equal(dueOf({ price: 12.5 }, { persons: 3 }), 37.5);
});

test('checklistOrder puts unpaid bookings first, then by name', () => {
  const rows = checklistOrder([
    { name: 'Virta', status: 'paid' as const },
    { name: 'Salonen', status: 'unpaid' as const },
    { name: 'Korhonen', status: 'unpaid' as const },
    { name: 'Ahonen', status: 'prepaid' as const },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['Korhonen', 'Salonen', 'Ahonen', 'Virta']);
});
