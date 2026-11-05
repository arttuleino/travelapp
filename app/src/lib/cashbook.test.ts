import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangementSummaries, balances, money, parseAmount, parseBalance, reportCsv, type CashEntry } from './cashbook.ts';

const e = (p: Partial<CashEntry>): CashEntry => ({
  id: String(p.voucher_no),
  trip_id: 't',
  voucher_no: 1,
  kind: 'cost_other',
  account: 'cash',
  amount: -1,
  entry_date: '2027-02-14',
  comment: '',
  programme_item_id: null,
  transfer_id: null,
  created_at: '',
  ...p,
});

const entries = [
  e({ voucher_no: 1, kind: 'cost_other', account: 'bankcard', amount: -86.4 }),
  e({ voucher_no: 2, kind: 'transfer', account: 'bank', amount: -500, transfer_id: 'x' }),
  e({ voucher_no: 3, kind: 'transfer', account: 'cash', amount: 500, transfer_id: 'x' }),
  e({ voucher_no: 4, kind: 'income_arrangement', account: 'mobile', amount: 590, programme_item_id: 'fondue' }),
  // numeric columns arrive from Supabase as strings
  e({ voucher_no: 5, kind: 'cost_arrangement', account: 'cash', amount: '-420.00' as unknown as number, programme_item_id: 'fondue', comment: 'Ennakko; "Hochalm"' }),
];

test('balances: bank card costs count towards the bank account, transfers move money', () => {
  const b = balances({ opening_bank: 1200, opening_cash: 300, opening_mobile: 0 }, entries);
  assert.deepEqual(b.result, { bank: -586.4, cash: 80, mobile: 590 });
  assert.deepEqual(b.closing, { bank: 613.6, cash: 380, mobile: 590 });
  assert.equal(b.total, 1583.6);
});

test('balances without a cash book start from zero', () => {
  assert.deepEqual(balances(null, []).closing, { bank: 0, cash: 0, mobile: 0 });
});

test('arrangementSummaries totals each programme item', () => {
  assert.deepEqual(arrangementSummaries(entries), [{ id: 'fondue', income: 590, cost: 420, net: 170, count: 2 }]);
});

test('parseAmount accepts Finnish input and rejects the rest', () => {
  assert.equal(parseAmount('12,50'), 12.5);
  assert.equal(parseAmount('1 200'), 1200);
  assert.equal(parseAmount('€8'), 8);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('1,234'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseBalance(''), 0);
  assert.equal(parseBalance('-20,5'), -20.5);
});

test('money uses a real minus sign and optional plus', () => {
  assert.equal(money(-86.4).replace(/\s/g, ' '), '−86,40');
  assert.equal(money(1200, 'fi-FI', true).replace(/\s/g, ' '), '+1 200,00');
});

test('reportCsv follows the office column order with decimal commas and quoting', () => {
  const csv = reportCsv(
    { trip_id: 't', dest_number: '274', department: 'Talvi', responsible: 'Sanna', currency: 'EUR', opening_bank: 0, opening_cash: 0, opening_mobile: 0 },
    [entries[4], entries[0]],
    { kind: (k) => k, account: (a) => a, arrangement: (id) => (id ? 'Fondue-ilta' : ''), headers: ['Tosite', 'Laji', 'Osasto', 'Summa', 'Päivä', 'Tili', 'Kohdenro', 'Kommentti', 'Järjestely'] },
  );
  assert.deepEqual(csv.split('\n'), [
    'Tosite;Laji;Osasto;Summa;Päivä;Tili;Kohdenro;Kommentti;Järjestely',
    '1;cost_other;Talvi;-86,40;2027-02-14;bankcard;274;;',
    '5;cost_arrangement;Talvi;-420,00;2027-02-14;cash;274;"Ennakko; ""Hochalm""";Fondue-ilta',
  ]);
});
