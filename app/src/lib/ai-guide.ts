import { DEMO_MODE, DEMO_NOW, supabase } from './supabase';

// The AI guide answers a traveller's question from their own trip's data. The call goes to the
// `ai-guide` Supabase Edge Function, which holds the Claude API key; the app never sees the key.

export type AiSource = 'programme' | 'hotel' | 'flights' | 'answer_bank' | 'announcements' | 'guide';
export type AiAnswer = { answer: string; handoff: boolean; handoff_reason: string | null; sources: AiSource[] };
export type AiTurn = { role: 'user' | 'assistant'; content: string };
/** Why no answer came: not set up on this server, too many requests, or anything else. */
export type AiFailure = 'unavailable' | 'busy' | 'failed';

export class AiGuideError extends Error {
  constructor(readonly reason: AiFailure) {
    super(reason);
  }
}

const failureFor = (status: number | undefined): AiFailure =>
  status === 503 || status === 404 ? 'unavailable' : status === 429 ? 'busy' : 'failed';

export async function askAiGuide(tripId: string, question: string, history: AiTurn[], locale: string): Promise<AiAnswer> {
  const body = { trip_id: tripId, question, history, locale, now_local: DEMO_NOW };
  if (DEMO_MODE) return askDemoServer(body);
  const { data, error } = await supabase.functions.invoke<AiAnswer>('ai-guide', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new AiGuideError(failureFor(status));
  }
  if (!data || typeof data.answer !== 'string') throw new AiGuideError('failed');
  return data;
}

/** Demo mode has no Supabase: the demo server may offer the same endpoint at /demo-api/ai-guide. */
async function askDemoServer(body: object): Promise<AiAnswer> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_DEMO_API_URL ?? ''}/demo-api/ai-guide`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) throw new AiGuideError(failureFor(res?.status));
  return (await res.json()) as AiAnswer;
}

/** The turns to send as context: answered questions only, newest last, at most `max`. */
export function historyFor(turns: { role: 'user' | 'assistant'; text: string; failed?: boolean }[], max = 10): AiTurn[] {
  const ok = turns.filter((t) => !t.failed && t.text.trim());
  return ok.slice(-max).map((t) => ({ role: t.role, content: t.text }));
}
