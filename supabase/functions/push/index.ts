// Sends Expo push notifications for new chat messages and group announcements.
// Triggered by Supabase Database Webhooks (INSERT on public.messages and public.announcements),
// which must send the header  x-webhook-secret: <PUSH_WEBHOOK_SECRET>.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { deadTokens, eventFromWebhook, toExpoBatches, type ExpoTicket, type Recipient } from './payload.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  const event = eventFromWebhook(await req.json().catch(() => null));
  if (!event) return new Response('ignored', { status: 200 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('push_recipients', { p_kind: event.kind, p_id: event.id });
  if (error) return new Response(`recipients failed: ${error.message}`, { status: 500 });

  let sent = 0;
  const dead: string[] = [];
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // optional, if push security is enabled in Expo
  for (const batch of toExpoBatches((data ?? []) as Recipient[])) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) return new Response(`expo push failed: ${res.status} ${await res.text()}`, { status: 502 });
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    dead.push(...deadTokens(batch, tickets));
    sent += batch.length;
  }
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent, removed: dead.length });
});
