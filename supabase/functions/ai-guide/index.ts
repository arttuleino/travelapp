// AI guide: answers a traveller's question from their own trip's data with Claude.
// The Anthropic API key lives only here (supabase secrets set ANTHROPIC_API_KEY=...), never in the app.
//
// POST { trip_id, question, history?: [{role, content}], locale?, now_local? }
// with the signed-in user's Authorization header (supabase.functions.invoke sends it).
// All trip data is read AS THAT USER, so row level security decides what Claude may see:
// a traveller's question can only use what that traveller could open in the app anyway.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { ANSWER_SCHEMA, cleanHistory, localNow, MAX_QUESTION, parseAnswer, pinnedNow, SYSTEM, tripContext, type TripData } from './prompt.ts';

// Default model; set AI_GUIDE_MODEL (e.g. claude-haiku-5-5) to trade quality for cost.
const MODEL = Deno.env.get('AI_GUIDE_MODEL') || 'claude-opus-5-5';
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'not_configured' }, 503);

  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tripId = typeof body?.trip_id === 'string' ? body.trip_id : '';
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : '';
  const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 10) : 'fi';
  if (!tripId || !question) return json({ error: 'bad_request' }, 400);

  // A client acting as the signed-in user: every read below goes through row level security.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData } = await db.auth.getUser();
  const email = userData.user?.email?.toLowerCase();
  if (!email) return json({ error: 'unauthorized' }, 401);

  const [trip, me, guides, programme, flights, answers, announcements] = await Promise.all([
    db.from('trips').select('*').eq('id', tripId).maybeSingle(),
    db.from('trip_members').select('display_name, booking_ref, party_size, room, room_type').eq('trip_id', tripId).eq('email', email).maybeSingle(),
    db.from('trip_members').select('display_name, phone').eq('trip_id', tripId).eq('role', 'guide'),
    db.from('programme_items').select('day, starts_at, title, details, previous_starts_at').eq('trip_id', tripId),
    db.from('trip_flights').select('*').eq('trip_id', tripId),
    db.from('answer_bank').select('question, answer').eq('trip_id', tripId),
    db.from('announcements').select('title, body, send_at').eq('trip_id', tripId).lte('send_at', new Date().toISOString()),
  ]);
  if (!trip.data || !me.data) return json({ error: 'not_member' }, 403);

  const data: TripData = {
    trip: trip.data,
    member: me.data,
    guides: guides.data ?? [],
    programme: programme.data ?? [],
    flights: flights.data ?? [], // table may be missing on older databases: treated as no flights
    answers: answers.data ?? [],
    announcements: announcements.data ?? [],
  };
  // The app may pin its clock for demos (EXPO_PUBLIC_DEMO_NOW, trip-local 'YYYY-MM-DDTHH:MM').
  const pinned = typeof body?.now_local === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(body.now_local) ? body.now_local : null;
  const nowText = pinned ? pinnedNow(pinned) : localNow(new Date(), data.trip.timezone);

  try {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      system: [
        { type: 'text', text: SYSTEM },
        // The trip text is the same for every question on this trip: cache it.
        { type: 'text', text: tripContext(data), cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        ...cleanHistory(body?.history),
        { role: 'user', content: `Local time on the trip now: ${nowText}. App language: ${locale}.\n\nQuestion: ${question}` },
      ],
    });
    if (res.stop_reason === 'refusal') return json({ answer: '', handoff: true, handoff_reason: 'refusal', sources: [] });
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return json(parseAnswer(text));
  } catch (e) {
    console.error('ai-guide failed', e);
    const status = e instanceof Anthropic.RateLimitError ? 429 : 502;
    return json({ error: status === 429 ? 'busy' : 'upstream' }, status);
  }
});
