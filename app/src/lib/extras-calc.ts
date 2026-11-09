// Paid extras: who owes what. Free of app imports so it can be unit tested with node.

export type PaymentStatus = 'unpaid' | 'prepaid' | 'paid';
export type PaymentMethod = 'mobile' | 'cash';

export type Extra = {
  id: string;
  trip_id: string;
  title: string;
  day: string; // 'YYYY-MM-DD'
  starts_at: string | null; // 'HH:MM:SS'
  price: number; // per person
  programme_item_id: string | null;
  notes: string;
};

export type Signup = {
  id: string;
  extra_id: string;
  member_id: string;
  persons: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  amount_paid: number | null;
  paid_at: string | null;
};

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const cents = (n: number) => Math.round(n * 100) / 100;

/** What a booking owes for an extra (price × persons). */
export const dueOf = (extra: Pick<Extra, 'price'>, s: Pick<Signup, 'persons'>) => cents(num(extra.price) * s.persons);

/** Totals for one extra: bookings and persons, how many still owe, collected and outstanding money. */
export function summarize(extra: Pick<Extra, 'price'>, signups: Signup[]) {
  let persons = 0;
  let unpaid = 0;
  let prepaid = 0;
  let collected = 0;
  let outstanding = 0;
  for (const s of signups) {
    persons += s.persons;
    const due = dueOf(extra, s);
    if (s.status === 'unpaid') {
      unpaid += 1;
      outstanding = cents(outstanding + due);
    } else if (s.status === 'prepaid') prepaid = cents(prepaid + due);
    else collected = cents(collected + (s.amount_paid == null ? due : num(s.amount_paid)));
  }
  return { bookings: signups.length, persons, unpaid, prepaid, collected, outstanding };
}

/** Unpaid first, then by name. */
export function checklistOrder<T extends { status: PaymentStatus; name: string }>(rows: T[]): T[] {
  const rank = (s: PaymentStatus) => (s === 'unpaid' ? 0 : 1);
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name, 'fi'));
}
