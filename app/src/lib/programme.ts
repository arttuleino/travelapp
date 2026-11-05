import { supabase } from './supabase';
import { formatDay, hhmm } from './time';
import type { ProgrammeItem } from './types';

export type ItemInput = { trip_id: string; day: string; starts_at: string; title: string; details: string };

/** Creates or updates a programme item. Only guides pass the database's row-level security. */
export async function saveItem(input: ItemInput, id?: string) {
  const row = { ...input, title: input.title.trim(), details: input.details.trim() };
  const { error } = id
    ? await supabase.from('programme_items').update(row).eq('id', id)
    : await supabase.from('programme_items').insert(row);
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('programme_items').delete().eq('id', id);
  if (error) throw error;
}

/** Text of the notice sent to the group after a guide edit. */
export function changeNotice(before: ProgrammeItem | null, after: ItemInput | null): { title: string; body: string } {
  if (!after && before) {
    return { title: 'Ohjelmamuutos', body: `Peruttu: ${before.title} (${formatDay(before.day)} klo ${hhmm(before.starts_at)}).` };
  }
  if (!after) throw new Error('changeNotice needs an item');
  const when = `${formatDay(after.day)} klo ${after.starts_at}`;
  if (!before) return { title: 'Uusi ohjelmakohta', body: `${when}: ${after.title}.` };
  if (before.day !== after.day || hhmm(before.starts_at) !== after.starts_at) {
    return {
      title: 'Aikataulumuutos',
      body: `${after.title} on nyt ${when} (oli ${formatDay(before.day)} klo ${hhmm(before.starts_at)}).`,
    };
  }
  return { title: 'Ohjelma päivittyi', body: `${when}: ${after.title}${after.details ? `. ${after.details}` : ''}.` };
}

/** Sends now, or at `sendAt` (ISO) if given. */
export async function postAnnouncement(tripId: string, title: string, body: string, authorName: string, sendAt?: string) {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('announcements')
    .insert({ trip_id: tripId, title, body, author_name: authorName, created_by: data.user?.id, ...(sendAt ? { send_at: sendAt } : {}) });
  if (error) throw error;
}

/**
 * Edits an announcement. A sent one keeps its send time and is marked "muokattu"; a scheduled
 * one can also be moved (`sendAt`), or sent right away by passing the current time.
 */
export async function updateAnnouncement(id: string, title: string, body: string, sendAt?: string) {
  const { error } = await supabase
    .from('announcements')
    .update({ title, body, ...(sendAt ? { send_at: sendAt } : {}) })
    .eq('id', id);
  if (error) throw error;
}

/** Cancels a scheduled announcement (the database refuses to delete one that has gone out). */
export async function cancelAnnouncement(id: string) {
  const { error, count } = await supabase.from('announcements').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw new Error('already sent');
}
