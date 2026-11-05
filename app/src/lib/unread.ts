// Pure helpers for chat feeds and unread badges (unit-tested in unread.test.ts).

export type FeedMessage = { id: string; created_at: string; sender_id: string | null; conversation_id?: string };

/** Messages newer than the reader's marker that someone else sent. No marker means nothing has been read. */
export function unreadCount(msgs: FeedMessage[], lastReadAt: string | null | undefined, me: string): number {
  return msgs.filter((m) => m.sender_id !== me && (!lastReadAt || m.created_at > lastReadAt)).length;
}

/** Same for announcements, which are written only by guides. */
export function unreadAnnouncements(items: { created_at: string; created_by?: string | null }[], lastReadAt: string | null | undefined, me: string): number {
  return items.filter((a) => a.created_by !== me && (!lastReadAt || a.created_at > lastReadAt)).length;
}

export type FeedItem<M, A> = { kind: 'message'; at: string; item: M } | { kind: 'announcement'; at: string; item: A };

/** Merges a conversation and the group's announcements into one oldest-first feed. */
export function mergeFeed<M extends { created_at: string }, A extends { created_at: string }>(msgs: M[], announcements: A[]): FeedItem<M, A>[] {
  const feed: FeedItem<M, A>[] = [
    ...msgs.map((m) => ({ kind: 'message' as const, at: m.created_at, item: m })),
    ...announcements.map((a) => ({ kind: 'announcement' as const, at: a.created_at, item: a })),
  ];
  return feed.sort((x, y) => x.at.localeCompare(y.at));
}

/** Date separator label for a feed: 'Tänään', 'Eilen' or 'ma 15.2.' (dates are compared in the trip's time zone). */
export function dayLabel(isoTime: string, today: string, timeZone: string): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoTime));
  if (d === today) return 'Tänään';
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (d === y.toISOString().slice(0, 10)) return 'Eilen';
  const dt = new Date(`${d}T00:00:00Z`);
  return `${['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'][dt.getUTCDay()]} ${dt.getUTCDate()}.${dt.getUTCMonth() + 1}.`;
}

/** 'HH:MM' in the trip's time zone. */
export function clockTime(isoTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fi-FI', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(isoTime))
    .replace('.', ':');
}
