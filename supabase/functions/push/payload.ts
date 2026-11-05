// Pure helpers for the push function (no Deno APIs, so they are unit-tested with Node).

export type Recipient = { token: string; title: string; body: string; url: string };
export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { url: string };
  channelId: string;
};
export type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

/** Expo accepts at most 100 messages per request. */
export function toExpoBatches(recipients: Recipient[], size = 100): ExpoMessage[][] {
  const seen = new Set<string>();
  const msgs: ExpoMessage[] = [];
  for (const r of recipients) {
    const key = `${r.token}\n${r.title}\n${r.body}`;
    if (seen.has(key)) continue; // one notification per device and announcement/message
    seen.add(key);
    msgs.push({ to: r.token, title: r.title, body: r.body, sound: 'default', data: { url: r.url }, channelId: 'default' });
  }
  const out: ExpoMessage[][] = [];
  for (let i = 0; i < msgs.length; i += size) out.push(msgs.slice(i, i + size));
  return out;
}

/** Tokens Expo says are dead (app uninstalled or notifications turned off); tickets are in request order. */
export function deadTokens(batch: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && batch[i] ? [batch[i].to] : []));
}

export type PushEvent = { kind: 'message'; id: string } | { kind: 'due-announcements' };

/**
 * Maps a request body to what should be pushed. A new message pushes that message. A new
 * announcement, or the once-a-minute cron call `{"due": true}`, pushes every announcement whose
 * send time has come (scheduled ones included); the database makes sure each goes out once.
 */
export function eventFromWebhook(payload: unknown): PushEvent | null {
  const p = payload as { type?: string; table?: string; record?: { id?: string }; due?: boolean } | null;
  if (p?.due === true) return { kind: 'due-announcements' };
  if (!p || p.type !== 'INSERT' || !p.record?.id) return null;
  if (p.table === 'messages') return { kind: 'message', id: p.record.id };
  if (p.table === 'announcements') return { kind: 'due-announcements' };
  return null;
}
