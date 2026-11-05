import type { CashBook, CashEntry, EntryAccount, EntryKind, ReportLabels } from './cashbook';
import type { Translate } from './i18n';
import { supabase } from './supabase';
import { useLiveTable } from './trip';

// Stable query functions for useLiveTable. Only the trip's guides pass row-level security.
const bookQuery = (tripId: string) => supabase.from('cash_books').select('*').eq('trip_id', tripId);
const entriesQuery = (tripId: string) =>
  supabase.from('cash_entries').select('*').eq('trip_id', tripId).order('entry_date').order('voucher_no');

export function useCashBook(tripId: string) {
  const { rows, loading } = useLiveTable<CashBook>('cash_books', 'trip_id', tripId, bookQuery);
  return { book: rows[0] ?? null, loading };
}

export function useCashEntries(tripId: string) {
  const { rows, loading } = useLiveTable<CashEntry>('cash_entries', 'trip_id', tripId, entriesQuery);
  return { entries: rows, loading };
}

export type BookInput = Omit<CashBook, 'trip_id' | 'currency'>;

/** Creates the trip's cash book or updates its details and opening balances. */
export async function saveCashBook(tripId: string, input: BookInput) {
  const { error } = await supabase.from('cash_books').upsert({ trip_id: tripId, ...input }, { onConflict: 'trip_id' });
  if (error) throw error;
}

export type EntryInput = {
  kind: Exclude<EntryKind, 'transfer'>;
  account: EntryAccount;
  amount: number; // positive; the sign follows from the kind
  entry_date: string;
  comment: string;
  programme_item_id: string | null;
};
export type TransferInput = { from: EntryAccount; to: EntryAccount; amount: number; entry_date: string; comment: string };

const signed = (kind: EntryKind, amount: number) => (kind.startsWith('cost') ? -Math.abs(amount) : Math.abs(amount));

/** Records a cost or income (new), or changes one (`id`). The database numbers the voucher. */
export async function saveEntry(tripId: string, input: EntryInput, id?: string) {
  const row = { ...input, amount: signed(input.kind, input.amount), comment: input.comment.trim() };
  const { error } = id
    ? await supabase.from('cash_entries').update(row).eq('id', id)
    : await supabase.from('cash_entries').insert({ trip_id: tripId, ...row });
  if (error) throw error;
}

/** A transfer is two vouchers: money out of one account and into another, sharing a transfer id. */
export async function saveTransfer(tripId: string, input: TransferInput, transferId?: string) {
  const common = { kind: 'transfer', entry_date: input.entry_date, comment: input.comment.trim(), programme_item_id: null };
  const out = { ...common, account: input.from, amount: -Math.abs(input.amount) };
  const into = { ...common, account: input.to, amount: Math.abs(input.amount) };
  if (!transferId) {
    const id = uuid();
    const { error } = await supabase.from('cash_entries').insert([
      { trip_id: tripId, transfer_id: id, ...out },
      { trip_id: tripId, transfer_id: id, ...into },
    ]);
    if (error) throw error;
    return;
  }
  const a = await supabase.from('cash_entries').update(out).eq('transfer_id', transferId).lt('amount', 0);
  if (a.error) throw a.error;
  const b = await supabase.from('cash_entries').update(into).eq('transfer_id', transferId).gt('amount', 0);
  if (b.error) throw b.error;
}

/** Deletes an entry; for a transfer, both halves. */
export async function deleteEntry(entry: CashEntry) {
  const q = supabase.from('cash_entries').delete();
  const { error } = entry.transfer_id ? await q.eq('transfer_id', entry.transfer_id) : await q.eq('id', entry.id);
  if (error) throw error;
}

export const kindLabel = (t: Translate, k: EntryKind) =>
  t(
    k === 'cost_other'
      ? 'kindCostOther'
      : k === 'cost_arrangement'
        ? 'kindCostArrangement'
        : k === 'transfer'
          ? 'kindTransfer'
          : k === 'income_arrangement'
            ? 'kindIncomeArrangement'
            : 'kindIncomeOther',
  );

export const accountLabel = (t: Translate, a: EntryAccount) =>
  t(a === 'bank' ? 'accBank' : a === 'cash' ? 'accCash' : a === 'mobile' ? 'accMobile' : 'accBankcard');

/** Column labels for the CSV report, in the app language. */
export function reportLabels(t: Translate, arrangement: (id: string | null) => string): ReportLabels {
  return {
    kind: (k) => kindLabel(t, k),
    account: (a) => accountLabel(t, a),
    arrangement,
    headers: [t('csvVoucher'), t('csvKind'), t('department'), t('csvAmount'), t('csvDate'), t('account'), t('destNumber'), t('csvComment'), t('csvArrangement')],
  };
}

/** Random v4 UUID (crypto.randomUUID is not available on every React Native engine). */
function uuid() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
