import type { Extra, PaymentMethod, Signup } from './extras-calc';
import { supabase } from './supabase';
import { useLiveTable } from './trip';

// Stable query functions for useLiveTable. Only the trip's guides pass row-level security.
const extrasQuery = (tripId: string) => supabase.from('extras').select('*').eq('trip_id', tripId).order('day').order('starts_at');
const signupsQuery = (tripId: string) => supabase.from('extra_signups').select('*').eq('trip_id', tripId);

export function useExtras(tripId: string) {
  const { rows, loading } = useLiveTable<Extra>('extras', 'trip_id', tripId, extrasQuery);
  return { extras: rows, loading };
}

/** All signups on the trip (filter by extra_id on screen). */
export function useSignups(tripId: string) {
  return useLiveTable<Signup>('extra_signups', 'trip_id', tripId, signupsQuery).rows;
}

export type ExtraInput = { title: string; day: string; starts_at: string | null; price: number; programme_item_id: string | null; notes: string };

export async function saveExtra(tripId: string, input: ExtraInput, id?: string): Promise<string> {
  const row = { ...input, title: input.title.trim(), notes: input.notes.trim() };
  if (id) {
    const { error } = await supabase.from('extras').update(row).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('extras').insert({ trip_id: tripId, ...row }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteExtra(id: string) {
  const { error } = await supabase.from('extras').delete().eq('id', id);
  if (error) throw error;
}

/** Adds bookings to an extra (persons default to the booking's party size). */
export async function addSignups(extraId: string, members: { id: string; party_size: number }[]) {
  if (!members.length) return;
  const { error } = await supabase
    .from('extra_signups')
    .insert(members.map((m) => ({ extra_id: extraId, member_id: m.id, persons: m.party_size })));
  if (error) throw error;
}

export async function removeSignup(id: string) {
  const { error } = await supabase.from('extra_signups').delete().eq('id', id);
  if (error) throw error;
}

export async function setPersons(id: string, persons: number) {
  const { error } = await supabase.from('extra_signups').update({ persons }).eq('id', id);
  if (error) throw error;
}

/** Marks a booking paid on the spot; the database also records the income in the cash book. */
export async function recordPayment(signupId: string, method: PaymentMethod) {
  const { error } = await supabase.rpc('record_extra_payment', { p_signup: signupId, p_method: method });
  if (error) throw error;
}

/** Undoes an on-the-spot payment and its cash book entry. */
export async function undoPayment(signupId: string) {
  const { error } = await supabase.rpc('undo_extra_payment', { p_signup: signupId });
  if (error) throw error;
}
