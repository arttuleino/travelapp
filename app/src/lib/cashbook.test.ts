import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangementSummaries, balances, money, parseAmount, parseBalance, reportCsv, statement, statementHtml, type CashEntry } from './cashbook.ts';

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

test('statement: opening balance includes everything before the range', () => {
  const book = { opening_bank: 1200, opening_cash: 300, opening_mobile: 0 };
  const more = [...entries, e({ voucher_no: 6, kind: 'cost_other', account: 'cash', amount: -20, entry_date: '2027-02-16' })];
  const s = statement(book, more, '2027-02-15', '2027-02-15');
  // All sample entries are on 14.2., so they are in the opening balance of 15.2.
  assert.deepEqual(s.opening, { bank: 613.6, cash: 380, mobile: 590 });
  assert.equal(s.entries.length, 0);
  assert.deepEqual(statement(book, more, '2027-02-13', '2027-02-13').opening, { bank: 1200, cash: 300, mobile: 0 });
  const s2 = statement(book, more, '2027-02-15', '2027-02-20');
  assert.deepEqual(s2.opening, { bank: 613.6, cash: 380, mobile: 590 });
  assert.deepEqual(s2.result, { bank: 0, cash: -20, mobile: 0 });
  assert.deepEqual(s2.closing, { bank: 613.6, cash: 360, mobile: 590 });
  assert.deepEqual(s2.byKind, [{ kind: 'cost_other', amount: -20, count: 1 }]);
  const all = statement(book, more, '2027-02-13', '2027-02-20');
  assert.deepEqual(all.byKind.map((k) => [k.kind, k.amount, k.count]), [
    ['cost_arrangement', -420, 1],
    ['cost_other', -106.4, 2],
    ['income_arrangement', 590, 1],
    ['transfer', 0, 2],
  ]);
});

test('statementHtml escapes guide text', () => {
  const s = statement(null, [e({ voucher_no: 1, comment: '<b>Taxi</b> & co' })], '2027-02-14', '2027-02-14');
  const words = Object.fromEntries(['account', 'opening', 'change', 'closing', 'total', 'byKind', 'count', 'entries', 'voucher', 'date', 'kindCol', 'comment', 'amount', 'none', 'generated'].map((k) => [k, k]));
  const html = statementHtml(s, {
    title: 'Tiliote',
    facts: [['Matka', 'Saalbach']],
    money: (n) => n.toFixed(2),
    date: (d) => d,
    kind: (k) => k,
    account: (a) => a,
    arrangement: () => '',
    words: words as never,
  });
  assert.ok(html.includes('&lt;b&gt;Taxi&lt;/b&gt; &amp; co'));
  assert.ok(!html.includes('<b>Taxi'));
  assert.ok(html.includes('<td class="n">-1.00</td>'));
});
