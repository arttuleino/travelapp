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
    if (seen.has(r.token)) continue; // one notification per device
    seen.add(r.token);
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

/** Maps a database webhook payload to the kind of event push_recipients() understands. */
export function eventFromWebhook(payload: unknown): { kind: 'message' | 'announcement'; id: string } | null {
  const p = payload as { type?: string; table?: string; record?: { id?: string } } | null;
  if (!p || p.type !== 'INSERT' || !p.record?.id) return null;
  if (p.table === 'messages') return { kind: 'message', id: p.record.id };
  if (p.table === 'announcements') return { kind: 'announcement', id: p.record.id };
  return null;
}
