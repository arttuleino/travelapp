import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import { DEMO_NOW, supabase } from './supabase';
import { pickActiveTrip, tripClock, type Clock } from './time';
import type { Announcement, Membership, ProgrammeItem } from './types';

type TripState = {
  loading: boolean;
  error: string | null;
  membership: Membership | null;
  reload: () => void;
};
const TripContext = createContext<TripState>({ loading: true, error: null, membership: null, reload: () => {} });

async function fetchMembership(email: string): Promise<Omit<TripState, 'reload'>> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('id, role, display_name, booking_ref, party_size, room, trip:trips(*)')
    .eq('email', email);
  if (error) return { loading: false, error: error.message, membership: null };
  const rows = (data ?? []) as unknown as Membership[];
  const today = tripClock('Europe/Helsinki', new Date(), DEMO_NOW).date;
  const trip = pickActiveTrip(rows.map((r) => r.trip), today);
  return { loading: false, error: null, membership: rows.find((r) => r.trip === trip) ?? null };
}

/** Loads the signed-in person's trip. Membership is matched by the email they booked with. */
export function TripProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const email = session?.user.email?.toLowerCase() ?? null;
  const [result, setResult] = useState<{ email: string; state: Omit<TripState, 'reload'> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetchMembership(email).then((state) => {
      if (!cancelled) setResult({ email, state });
    });
    return () => {
      cancelled = true;
    };
  }, [email, attempt]);

  // Derive what to show: nothing signed in, still loading for this email, or the loaded result.
  const state: Omit<TripState, 'reload'> = !email
    ? { loading: false, error: null, membership: null }
    : result?.email === email
      ? result.state
      : { loading: true, error: null, membership: null };
  const reload = useCallback(() => {
    setResult(null);
    setAttempt((a) => a + 1);
  }, []);

  return <TripContext.Provider value={{ ...state, reload }}>{children}</TripContext.Provider>;
}

export const useTrip = () => useContext(TripContext);

/** The current membership; only call inside screens that render after the trip has loaded. */
export function useMembership(): Membership {
  const { membership } = useTrip();
  if (!membership) throw new Error('useMembership() used before a trip was loaded');
  return membership;
}

/** Destination wall-clock time, refreshed every 30 s. */
export function useTripClock(timeZone: string): Clock {
  const [clock, setClock] = useState(() => tripClock(timeZone, new Date(), DEMO_NOW));
  useEffect(() => {
    const id = setInterval(() => setClock(tripClock(timeZone, new Date(), DEMO_NOW)), 30_000);
    return () => clearInterval(id);
  }, [timeZone]);
  return clock;
}

/** Subscribes to a table for one trip and reloads whenever a row changes (guide edits reach travellers live). */
/** `query` must be a stable (module-level) function. */
function useLiveTable<T>(table: string, tripId: string, query: (tripId: string) => PromiseLike<{ data: T[] | null }>) {
  const [state, setState] = useState<{ tripId: string; rows: T[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      query(tripId).then(({ data }) => {
        if (!cancelled) setState({ tripId, rows: data ?? [] });
      });
    load();
    const channel = supabase
      // Unique name: several screens may watch the same table at once.
      .channel(`${table}:${tripId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, tripId, query]);

  const fresh = state?.tripId === tripId;
  return { rows: fresh ? state.rows : [], loading: !fresh };
}

const programmeQuery = (tripId: string) =>
  supabase.from('programme_items').select('*').eq('trip_id', tripId).order('day').order('starts_at');
const latestAnnouncementQuery = (tripId: string) =>
  supabase.from('announcements').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(1);

export function useProgramme(tripId: string) {
  const { rows, loading } = useLiveTable<ProgrammeItem>('programme_items', tripId, programmeQuery);
  return { items: rows, loading };
}

export function useLatestAnnouncement(tripId: string): Announcement | null {
  const { rows } = useLiveTable<Announcement>('announcements', tripId, latestAnnouncementQuery);
  return rows[0] ?? null;
}
