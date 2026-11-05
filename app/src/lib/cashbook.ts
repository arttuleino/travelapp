// Trip cash book calculations, kept free of app imports so they can be unit tested with node.

export type EntryKind = 'cost_other' | 'cost_arrangement' | 'transfer' | 'income_arrangement' | 'income_other';
/** Where the money moved. 'bankcard' is a cost paid with the guide's bank card; it counts towards 'bank'. */
export type EntryAccount = 'bankcard' | 'bank' | 'cash' | 'mobile';
export type Account = 'bank' | 'cash' | 'mobile';

export const ACCOUNTS: Account[] = ['bank', 'cash', 'mobile'];
export const KINDS: EntryKind[] = ['cost_arrangement', 'cost_other', 'income_arrangement', 'income_other', 'transfer'];

export type CashBook = {
  trip_id: string;
  dest_number: string;
  department: string;
  responsible: string;
  currency: string;
  opening_bank: number;
  opening_cash: number;
  opening_mobile: number;
};

export type CashEntry = {
  id: string;
  trip_id: string;
  voucher_no: number;
  kind: EntryKind;
  account: EntryAccount;
  amount: number; // negative = money out
  entry_date: string; // 'YYYY-MM-DD'
  comment: string;
  programme_item_id: string | null;
  transfer_id: string | null;
  created_at: string;
};

export const isCost = (k: EntryKind) => k === 'cost_other' || k === 'cost_arrangement';
export const isIncome = (k: EntryKind) => k === 'income_other' || k === 'income_arrangement';
/** Kinds that can be tied to a programme item (required for arrangement income). */
export const takesArrangement = (k: EntryKind) => k === 'cost_arrangement' || k === 'income_arrangement' || k === 'income_other';
/** The accounts a guide can pick for a kind of entry. */
export const accountsFor = (k: EntryKind): EntryAccount[] => (isCost(k) ? ['cash', 'bankcard'] : isIncome(k) ? ['mobile', 'cash', 'bank'] : ['bank', 'cash', 'mobile']);
export const balanceAccount = (a: EntryAccount): Account => (a === 'bankcard' ? 'bank' : a);

export type Balances = Record<Account, number>;

/** Opening balance, result for the period and closing balance of each account. */
export function balances(book: Pick<CashBook, 'opening_bank' | 'opening_cash' | 'opening_mobile'> | null, entries: CashEntry[]) {
  const opening: Balances = { bank: num(book?.opening_bank), cash: num(book?.opening_cash), mobile: num(book?.opening_mobile) };
  const result: Balances = { bank: 0, cash: 0, mobile: 0 };
  for (const e of entries) result[balanceAccount(e.account)] = cents(result[balanceAccount(e.account)] + num(e.amount));
  const closing: Balances = { bank: cents(opening.bank + result.bank), cash: cents(opening.cash + result.cash), mobile: cents(opening.mobile + result.mobile) };
  const total = cents(closing.bank + closing.cash + closing.mobile);
  return { opening, result, closing, total };
}

export type ArrangementSummary = { id: string; income: number; cost: number; net: number; count: number };

/** Income, costs and net per programme item, for items that have entries. */
export function arrangementSummaries(entries: CashEntry[]): ArrangementSummary[] {
  const by = new Map<string, ArrangementSummary>();
  for (const e of entries) {
    if (!e.programme_item_id) continue;
    const s = by.get(e.programme_item_id) ?? { id: e.programme_item_id, income: 0, cost: 0, net: 0, count: 0 };
    const a = num(e.amount);
    if (a > 0) s.income = cents(s.income + a);
    else s.cost = cents(s.cost - a);
    s.net = cents(s.income - s.cost);
    s.count += 1;
    by.set(s.id, s);
  }
  return [...by.values()];
}

/** Parses what a guide types as a euro amount ("12,50", "1 200", "€8") into a positive number, or null. */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** Parses an opening balance, which may be zero or negative. */
export function parseBalance(input: string): number | null {
  const s = input.replace(/[\s €]/g, '').replace(',', '.').replace('−', '-');
  if (s === '') return 0;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/** "1 234,50" style amount with a proper minus sign; `sign` adds "+" to positive amounts. */
export function money(n: number, locale = 'fi-FI', sign = false): string {
  const v = num(n);
  const text = Math.abs(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `−${text}` : sign && v > 0 ? `+${text}` : text;
}

/** Entries sorted newest first (by date, then voucher). */
export const newestFirst = (entries: CashEntry[]) =>
  [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.voucher_no - a.voucher_no);

export type ReportLabels = {
  kind: (k: EntryKind) => string;
  account: (a: EntryAccount) => string;
  arrangement: (id: string | null) => string;
  headers: string[]; // voucher, kind, department, amount, date, account, destination no, comment, arrangement
};

/**
 * The weekly cash report as CSV (semicolon separated, decimal comma, as Finnish Excel expects),
 * one row per voucher in voucher order, in the office's column order.
 */
export function reportCsv(book: CashBook | null, entries: CashEntry[], labels: ReportLabels): string {
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const amount = (n: number) => num(n).toFixed(2).replace('.', ',');
  const rows = [...entries]
    .sort((a, b) => a.voucher_no - b.voucher_no)
    .map((e) => [
      String(e.voucher_no),
      labels.kind(e.kind),
      book?.department ?? '',
      amount(e.amount),
      e.entry_date,
      labels.account(e.account),
      book?.dest_number ?? '',
      e.comment,
      labels.arrangement(e.programme_item_id),
    ]);
  return [labels.headers, ...rows].map((r) => r.map(cell).join(';')).join('\n');
}

// Supabase returns numeric columns as strings; keep sums in whole cents to avoid float drift.
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const cents = (n: number) => Math.round(n * 100) / 100;
