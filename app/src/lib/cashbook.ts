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

export type Statement = {
  from: string;
  to: string;
  opening: Balances;
  result: Balances;
  closing: Balances;
  /** Entries dated within the range, in voucher order. */
  entries: CashEntry[];
  /** Totals per kind of entry within the range (kinds with entries only). */
  byKind: { kind: EntryKind; amount: number; count: number }[];
};

/**
 * Account statement for the days `from`..`to` (inclusive): balances at the start of `from`
 * (opening balance plus everything earlier), the change within the range and the closing balance.
 */
export function statement(book: Pick<CashBook, 'opening_bank' | 'opening_cash' | 'opening_mobile'> | null, entries: CashEntry[], from: string, to: string): Statement {
  const before = balances(book, entries.filter((e) => e.entry_date < from));
  const inRange = entries.filter((e) => e.entry_date >= from && e.entry_date <= to).sort((a, b) => a.voucher_no - b.voucher_no);
  const within = balances({ opening_bank: before.closing.bank, opening_cash: before.closing.cash, opening_mobile: before.closing.mobile }, inRange);
  const byKind = KINDS.map((kind) => {
    const of = inRange.filter((e) => e.kind === kind);
    return { kind, amount: cents(of.reduce((s, e) => s + num(e.amount), 0)), count: of.length };
  }).filter((k) => k.count > 0);
  return { from, to, opening: within.opening, result: within.result, closing: within.closing, entries: inRange, byKind };
}

export type StatementText = {
  title: string;
  /** Header facts, e.g. trip, destination number, guide, period, currency. */
  facts: [string, string][];
  money: (n: number) => string;
  date: (d: string) => string;
  kind: (k: EntryKind) => string;
  account: (a: EntryAccount) => string;
  arrangement: (id: string | null) => string;
  /** Column and section labels. */
  words: {
    account: string;
    opening: string;
    change: string;
    closing: string;
    total: string;
    byKind: string;
    count: string;
    entries: string;
    voucher: string;
    date: string;
    kindCol: string;
    comment: string;
    amount: string;
    none: string;
    generated: string;
  };
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The statement as a printable A4 HTML page (turned into a PDF on the phone). */
export function statementHtml(s: Statement, x: StatementText): string {
  const w = x.words;
  const m = (n: number) => esc(x.money(n));
  const sum = (b: Balances) => b.bank + b.cash + b.mobile;
  const balanceRows = ACCOUNTS.map(
    (a) => `<tr><td>${esc(x.account(a))}</td><td class="n">${m(s.opening[a])}</td><td class="n">${m(s.result[a])}</td><td class="n b">${m(s.closing[a])}</td></tr>`,
  ).join('');
  const kindRows = s.byKind
    .map((k) => `<tr><td>${esc(x.kind(k.kind))}</td><td class="n">${k.count}</td><td class="n">${m(k.amount)}</td></tr>`)
    .join('');
  const entryRows = s.entries
    .map((e) => {
      const detail = [x.kind(e.kind), x.arrangement(e.programme_item_id)].filter(Boolean).map(esc).join('<br><span class="muted">') + (x.arrangement(e.programme_item_id) ? '</span>' : '');
      return `<tr><td>${e.voucher_no}</td><td class="nw">${esc(x.date(e.entry_date))}</td><td>${detail}</td><td>${esc(x.account(e.account))}</td><td>${esc(e.comment)}</td><td class="n">${m(num(e.amount))}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(x.title)}</title><style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #16160F; font-size: 10.5pt; margin: 0; }
h1 { font-size: 18pt; margin: 0 0 2mm; }
h2 { font-size: 11.5pt; margin: 7mm 0 2mm; }
.bar { height: 2.2mm; background: #FFE76A; border-radius: 2mm; margin: 0 0 4mm; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 1mm 6mm; margin: 0; }
.facts dt { color: #5E5B48; } .facts dd { margin: 0; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; color: #5E5B48; border-bottom: 1.5px solid #16160F; padding: 1.5mm 2mm; font-size: 9pt; }
td { padding: 1.5mm 2mm; border-bottom: 0.5px solid #E8E2C2; vertical-align: top; }
tr { page-break-inside: avoid; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
th.n { text-align: right; }
.b { font-weight: 700; } .nw { white-space: nowrap; } .muted { color: #5E5B48; font-size: 9pt; }
tfoot td { border-bottom: none; border-top: 1.5px solid #16160F; font-weight: 700; }
.foot { margin-top: 8mm; color: #5E5B48; font-size: 8.5pt; }
</style></head><body>
<h1>${esc(x.title)}</h1><div class="bar"></div>
<dl class="facts">${x.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<div style="height:5mm"></div>
<table><thead><tr><th>${esc(w.account)}</th><th class="n">${esc(w.opening)}</th><th class="n">${esc(w.change)}</th><th class="n">${esc(w.closing)}</th></tr></thead>
<tbody>${balanceRows}</tbody>
<tfoot><tr><td>${esc(w.total)}</td><td class="n">${m(sum(s.opening))}</td><td class="n">${m(sum(s.result))}</td><td class="n">${m(sum(s.closing))}</td></tr></tfoot></table>
${s.byKind.length ? `<h2>${esc(w.byKind)}</h2><table><thead><tr><th>${esc(w.kindCol)}</th><th class="n">${esc(w.count)}</th><th class="n">${esc(w.amount)}</th></tr></thead><tbody>${kindRows}</tbody></table>` : ''}
<h2>${esc(w.entries)}</h2>
${
  s.entries.length
    ? `<table><thead><tr><th>${esc(w.voucher)}</th><th>${esc(w.date)}</th><th>${esc(w.kindCol)}</th><th>${esc(w.account)}</th><th>${esc(w.comment)}</th><th class="n">${esc(w.amount)}</th></tr></thead><tbody>${entryRows}</tbody></table>`
    : `<p class="muted">${esc(w.none)}</p>`
}
<p class="foot">${esc(w.generated)}</p>
</body></html>`;
}
