// Pure helpers for chat feeds and unread badges (unit-tested in unread.test.ts).

export type FeedMessage = { id: string; created_at: string; sender_id: string | null; conversation_id?: string };

/** Messages newer than the reader's marker that someone else sent. No marker means nothing has been read. */
export function unreadCount(msgs: FeedMessage[], lastReadAt: string | null | undefined, me: string): number {
  return msgs.filter((m) => m.sender_id !== me && (!lastReadAt || m.created_at > lastReadAt)).length;
}

/** Same for announcements, which are written only by guides. Scheduled ones count from their send time. */
export function unreadAnnouncements(items: { send_at: string; created_by?: string | null }[], lastReadAt: string | null | undefined, me: string): number {
  return items.filter((a) => a.created_by !== me && (!lastReadAt || a.send_at > lastReadAt)).length;
}

export type FeedItem<M, A> = { kind: 'message'; at: string; item: M } | { kind: 'announcement'; at: string; item: A };

/** Merges a conversation and the group's announcements into one oldest-first feed. */
export function mergeFeed<M extends { created_at: string }, A extends { send_at: string }>(msgs: M[], announcements: A[]): FeedItem<M, A>[] {
  const feed: FeedItem<M, A>[] = [
    ...msgs.map((m) => ({ kind: 'message' as const, at: m.created_at, item: m })),
    ...announcements.map((a) => ({ kind: 'announcement' as const, at: a.send_at, item: a })),
  ];
  return feed.sort((x, y) => x.at.localeCompare(y.at));
}

export type DayWords = { today: string; yesterday: string; tomorrow: string };
const FI_WORDS: DayWords = { today: 'Tänään', yesterday: 'Eilen', tomorrow: 'Huomenna' };

/** Date label: 'Tänään', 'Eilen', 'Huomenna' or 'ma 15.2.' (dates are compared in the trip's time zone). Pass `words` and `locale` for other languages. */
export function dayLabel(isoTime: string, today: string, timeZone: string, words: DayWords = FI_WORDS, locale = 'fi-FI'): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoTime));
  if (d === today) return words.today;
  const shift = (n: number) => {
    const x = new Date(`${today}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  if (d === shift(-1)) return words.yesterday;
  if (d === shift(1)) return words.tomorrow;
  const dt = new Date(`${d}T00:00:00Z`);
  // Same format as formatDay() in time.ts (kept local so the unit tests can import this file on its own).
  if (locale.startsWith('fi')) return `${['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'][dt.getUTCDay()]} ${dt.getUTCDate()}.${dt.getUTCMonth() + 1}.`;
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt);
}

/** 'HH:MM' in the trip's time zone. */
export function clockTime(isoTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fi-FI', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(isoTime))
    .replace('.', ':');
}
