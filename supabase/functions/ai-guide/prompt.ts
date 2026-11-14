// Pure helpers for the AI guide: what Claude is told, and how its answer is checked.
// No Deno or network code here, so `node --test` can run the tests.

export type TripRow = {
  name: string;
  destination: string;
  country: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string;
  hotel_name: string | null;
  hotel_stars?: number | null;
  hotel_address?: string | null;
  hotel_phone?: string | null;
  hotel_lift_distance?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
};
export type MemberRow = { display_name: string; booking_ref: string | null; party_size: number; room: string | null; room_type?: string | null };
export type GuideRow = { display_name: string; phone: string | null };
export type ProgrammeRow = { day: string; starts_at: string; title: string; details: string; previous_starts_at: string | null };
export type FlightRow = {
  direction: 'out' | 'return';
  flight_date: string;
  flight_no: string;
  airline: string | null;
  dep_code: string;
  dep_city: string | null;
  dep_time: string;
  arr_code: string;
  arr_city: string | null;
  arr_time: string;
  terminal: string | null;
  baggage: string | null;
  transfer: string | null;
};
export type AnswerRow = { question: string; answer: string };
export type AnnouncementRow = { title: string; body: string; send_at: string };

export type TripData = {
  trip: TripRow;
  member: MemberRow;
  guides: GuideRow[];
  programme: ProgrammeRow[];
  flights: FlightRow[];
  answers: AnswerRow[];
  announcements: AnnouncementRow[];
};

export const SOURCES = ['programme', 'hotel', 'flights', 'answer_bank', 'announcements', 'guide'] as const;
export type Source = (typeof SOURCES)[number];
export type GuideAnswer = { answer: string; handoff: boolean; handoff_reason: string | null; sources: Source[] };

export const MAX_QUESTION = 500;
export const MAX_TURNS = 10;

/** Standing instructions. Kept byte-for-byte stable so the prompt cache can reuse it. */
export const SYSTEM = `You are the AI guide inside a tour operator's travel app. You answer travellers' questions during their trip.

Rules:
- Use only the trip information you are given (programme, hotel, flights, the guide's answer bank, announcements). Never invent times, prices, places, phone numbers or opening hours.
- Keep answers short and friendly: 1-4 sentences, plain text, no Markdown.
- Reply in the language the traveller writes in. If unsure, use the app language you are told.
- Set handoff to true when the information is missing or uncertain, or the question is about changing or cancelling a booking, money, refunds, complaints, health or safety. Then say briefly what you do know and that the guide will take over.
- In an emergency, tell them to call 112 first (mountain rescue 140 in Austria) and set handoff to true.
- Announcements are newer than the programme text: if they conflict, trust the latest announcement and say so.
- The guide's answer bank is written by the guide for this trip: prefer it over general knowledge.
- sources lists which parts of the trip information the answer used.`;

/** JSON Schema for the answer (structured outputs). */
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    handoff: { type: 'boolean' },
    handoff_reason: { type: ['string', 'null'] },
    sources: { type: 'array', items: { type: 'string', enum: [...SOURCES] } },
  },
  required: ['answer', 'handoff', 'handoff_reason', 'sources'],
  additionalProperties: false,
} as const;

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * The trip as plain text for Claude. Deterministic (sorted, no clock) so that repeated
 * questions about the same trip hit the prompt cache; the current time goes in the question turn.
 */
export function tripContext(d: TripData): string {
  const t = d.trip;
  const lines: string[] = [];
  lines.push(`TRIP: ${clean(t.name)} — ${clean(t.destination)}${t.country ? `, ${clean(t.country)}` : ''}, ${t.starts_on} to ${t.ends_on} (time zone ${t.timezone})`);
  const m = d.member;
  lines.push(
    `TRAVELLER: ${clean(m.display_name)}, ${m.party_size} person(s)` +
      (m.booking_ref ? `, booking ${clean(m.booking_ref)}` : '') +
      (m.room ? `, room ${clean(m.room)}` : '') +
      (m.room_type ? `, ${clean(m.room_type)}` : ''),
  );
  if (d.guides.length) lines.push(`GUIDE: ${d.guides.map((g) => clean(g.display_name) + (g.phone ? ` (${clean(g.phone)})` : '')).join(', ')}`);
  if (t.hotel_name) {
    const h = [clean(t.hotel_name), t.hotel_stars ? `${t.hotel_stars}*` : '', clean(t.hotel_address), t.hotel_phone ? `tel ${clean(t.hotel_phone)}` : '', clean(t.hotel_lift_distance)];
    if (t.check_in_time) h.push(`check-in ${t.starts_on} ${hm(t.check_in_time)}`);
    if (t.check_out_time) h.push(`check-out ${t.ends_on} ${hm(t.check_out_time)}`);
    lines.push(`HOTEL: ${h.filter(Boolean).join(', ')}`);
  }
  const flights = [...d.flights].sort((a, b) => (a.flight_date + a.dep_time).localeCompare(b.flight_date + b.dep_time));
  if (flights.length) {
    lines.push('FLIGHTS:');
    for (const f of flights)
      lines.push(
        `- ${f.direction === 'out' ? 'Outbound' : 'Return'} ${f.flight_date} ${clean(f.airline)} ${f.flight_no}: ${f.dep_code}${f.dep_city ? ` ${clean(f.dep_city)}` : ''} ${hm(f.dep_time)} → ${f.arr_code}${f.arr_city ? ` ${clean(f.arr_city)}` : ''} ${hm(f.arr_time)}` +
          (f.terminal ? `, terminal ${clean(f.terminal)}` : '') +
          (f.baggage ? `, baggage ${clean(f.baggage)}` : '') +
          (f.transfer ? `, transfer: ${clean(f.transfer)}` : ''),
      );
  }
  const items = [...d.programme].sort((a, b) => (a.day + a.starts_at).localeCompare(b.day + b.starts_at));
  if (items.length) {
    lines.push('PROGRAMME (local time):');
    let day = '';
    for (const p of items) {
      if (p.day !== day) {
        day = p.day;
        lines.push(`${day} ${weekday(day)}`);
      }
      lines.push(`- ${hm(p.starts_at)} ${clean(p.title)}${p.details ? ` — ${clean(p.details)}` : ''}${p.previous_starts_at ? ` (moved, was ${hm(p.previous_starts_at)})` : ''}`);
    }
  }
  if (d.answers.length) {
    lines.push("GUIDE'S ANSWER BANK:");
    for (const a of [...d.answers].sort((x, y) => x.question.localeCompare(y.question))) lines.push(`Q: ${clean(a.question)}\nA: ${clean(a.answer)}`);
  }
  const anns = [...d.announcements].sort((a, b) => b.send_at.localeCompare(a.send_at)).slice(0, 15);
  if (anns.length) {
    lines.push('ANNOUNCEMENTS FROM THE GUIDE (newest first):');
    for (const a of anns) lines.push(`- ${a.send_at.slice(0, 16).replace('T', ' ')} UTC ${clean(a.title)}: ${clean(a.body)}`);
  }
  return lines.join('\n');
}

function weekday(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

/** The current local time on the trip, e.g. "2027-02-15 10:40 (Mon)". */
export function localNow(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return `${day} ${get('hour').replace('24', '00')}:${get('minute')} (${weekday(day)})`;
}

/** Formats a pinned demo clock ('YYYY-MM-DDTHH:MM', already trip-local) like localNow. */
export function pinnedNow(local: string): string {
  const [day, time] = local.split('T');
  return `${day} ${time.slice(0, 5)} (${weekday(day)})`;
}

export type Turn = { role: 'user' | 'assistant'; content: string };

/** Keeps the last few well-formed turns, starting with a user turn and alternating roles. */
export function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns: Turn[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { role, content } = r as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) continue;
    const text = content.trim().slice(0, 2000);
    if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1] = { role, content: text };
    else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  // The new question is appended as a user turn, so the history must end with the assistant.
  while (turns.length && turns[turns.length - 1].role !== 'assistant') turns.pop();
  const tail = turns.slice(-MAX_TURNS);
  return tail[0]?.role === 'user' ? tail : tail.slice(1);
}

const FALLBACK_HANDOFF = (reason: string): GuideAnswer => ({ answer: '', handoff: true, handoff_reason: reason, sources: [] });

/** Checks Claude's JSON. Anything malformed becomes a handoff to the guide. */
export function parseAnswer(text: string): GuideAnswer {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return FALLBACK_HANDOFF('unreadable answer');
  }
  if (!v || typeof v !== 'object') return FALLBACK_HANDOFF('unreadable answer');
  const o = v as Record<string, unknown>;
  const answer = typeof o.answer === 'string' ? o.answer.trim() : '';
  if (!answer) return FALLBACK_HANDOFF('empty answer');
  const sources = Array.isArray(o.sources) ? (o.sources.filter((s) => (SOURCES as readonly string[]).includes(s as string)) as Source[]) : [];
  return {
    answer,
    handoff: o.handoff === true,
    handoff_reason: typeof o.handoff_reason === 'string' && o.handoff_reason.trim() ? o.handoff_reason.trim() : null,
    sources: [...new Set(sources)],
  };
}
