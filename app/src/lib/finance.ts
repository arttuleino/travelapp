import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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
  /** Costs only: the guide has the receipt. */
  receipt: boolean;
};
export type TransferInput = { from: EntryAccount; to: EntryAccount; amount: number; entry_date: string; comment: string };

const signed = (kind: EntryKind, amount: number) => (kind.startsWith('cost') ? -Math.abs(amount) : Math.abs(amount));

/** Records a cost or income (new), or changes one (`id`). The database numbers the voucher. */
export async function saveEntry(tripId: string, input: EntryInput, id?: string) {
  const row = { ...input, amount: signed(input.kind, input.amount), comment: input.comment.trim(), receipt: input.kind.startsWith('cost') && input.receipt };
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

/** Ticks or unticks "receipt kept" on a cost straight from the checks. */
export async function setReceipt(id: string, receipt: boolean) {
  const { error } = await supabase.from('cash_entries').update({ receipt }).eq('id', id);
  if (error) throw error;
}

/** Records that the weekly report was sent to the office now. */
export async function markReportSent(tripId: string) {
  const { error } = await supabase
    .from('cash_books')
    .upsert({ trip_id: tripId, report_sent_at: new Date().toISOString() }, { onConflict: 'trip_id' });
  if (error) throw error;
}

/**
 * Hands the weekly report CSV to the guide: the share sheet on a phone (mail, WhatsApp, Files),
 * a download in the browser.
 */
export async function shareCsv(csv: string, fileName: string, dialogTitle: string) {
  // A byte order mark makes Excel read the file as UTF-8 (ä, ö).
  const text = `\uFEFF${csv}`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!FileSystem.cacheDirectory) throw new Error('no cache directory');
  const target = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(target, text);
  await Sharing.shareAsync(target, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle });
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

/**
 * Turns `html` into a PDF and opens the share sheet, so the guide can save it to Files or send it.
 * In the browser, opens the print dialog instead (where "Save as PDF" is available).
 */
export async function sharePdf(html: string, fileName: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  // A4 at 72 dpi.
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  // Give the file a readable name (the printer names it with a random id).
  let target = uri;
  if (FileSystem.cacheDirectory) {
    target = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: target });
  }
  await Sharing.shareAsync(target, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}
