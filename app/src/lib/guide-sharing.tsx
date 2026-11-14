import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { shouldSend, type GuideLocation, type LatLng } from './guide-location';
import { supabase } from './supabase';
import { useLiveTable } from './trip';

/**
 * Guide location sharing. Lives in the trip layout, so sharing keeps going while the guide moves
 * between tabs. Uses the browser's location (navigator.geolocation), which only runs while the app
 * is open: when the phone locks or the tab closes, updates stop and travellers see the position age.
 */
type SharingState = {
  /** Location is available on this device. */
  supported: boolean;
  sharing: boolean;
  /** Waiting for the first position (the permission prompt is usually showing). */
  starting: boolean;
  error: 'denied' | 'unavailable' | 'save' | null;
  /** Last position this phone sent. */
  last: (LatLng & { at: number; accuracy: number | null }) | null;
  start: () => void;
  stop: () => void;
};

const noop = () => {};
const SharingContext = createContext<SharingState>({
  supported: false,
  sharing: false,
  starting: false,
  error: null,
  last: null,
  start: noop,
  stop: noop,
});
export const useGuideSharing = () => useContext(SharingContext);

const geo = () => (typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null);
const prefKey = (memberId: string) => `groupglide.shareLocation.${memberId}`;
const readPref = (memberId: string) => {
  try {
    return globalThis.localStorage?.getItem(prefKey(memberId)) === '1';
  } catch {
    return false;
  }
};
const writePref = (memberId: string, on: boolean) => {
  try {
    if (on) globalThis.localStorage?.setItem(prefKey(memberId), '1');
    else globalThis.localStorage?.removeItem(prefKey(memberId));
  } catch {
    // Private mode: the switch just won't be remembered.
  }
};

export function GuideSharingProvider({
  enabled,
  memberId,
  tripId,
  children,
}: {
  /** Only guides share; for travellers the provider does nothing. */
  enabled: boolean;
  memberId: string;
  tripId: string;
  children: ReactNode;
}) {
  const supported = enabled && geo() != null;
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<SharingState['error']>(null);
  const [last, setLast] = useState<SharingState['last']>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<(LatLng & { at: number }) | null>(null);

  const clearWatch = () => {
    if (watchId.current != null) geo()?.clearWatch(watchId.current);
    watchId.current = null;
  };

  const begin = useCallback(() => {
    const g = geo();
    if (!g || watchId.current != null) return;
    setError(null);
    setStarting(true);
    setSharing(true);
    writePref(memberId, true);
    lastSent.current = null;
    watchId.current = g.watchPosition(
      (pos) => {
        setStarting(false);
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const now = Date.now();
        if (!shouldSend(lastSent.current, next, now)) return;
        lastSent.current = { ...next, at: now };
        const accuracy = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
        supabase
          .from('guide_locations')
          .upsert({ member_id: memberId, trip_id: tripId, ...next, accuracy }, { onConflict: 'member_id' })
          .then(({ error: e }) => {
            if (e) {
              lastSent.current = null; // try again with the next position
              setError('save');
            } else {
              setError(null);
              setLast({ ...next, at: now, accuracy });
            }
          });
      },
      (e) => {
        setStarting(false);
        if (e.code === e.PERMISSION_DENIED) {
          clearWatch();
          setSharing(false);
          writePref(memberId, false);
          setError('denied');
        } else {
          setError('unavailable'); // keeps watching; GPS often comes back
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
  }, [memberId, tripId]);

  const stop = useCallback(() => {
    clearWatch();
    setSharing(false);
    setStarting(false);
    setError(null);
    setLast(null);
    writePref(memberId, false);
    lastSent.current = null;
    supabase.from('guide_locations').delete().eq('member_id', memberId).then(() => {});
  }, [memberId]);

  // Resume after a reload if the guide left sharing on and the browser already allows location.
  useEffect(() => {
    if (!supported || !readPref(memberId)) return;
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (!perms?.query) return;
    perms
      .query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted') begin();
      })
      .catch(() => {});
  }, [supported, memberId, begin]);

  useEffect(() => clearWatch, []);

  const value: SharingState = { supported, sharing, starting, error, last, start: begin, stop };
  return <SharingContext.Provider value={value}>{children}</SharingContext.Provider>;
}

const locationsQuery = (tripId: string) => supabase.from('guide_locations').select('*').eq('trip_id', tripId);

/** The trip's guides' shared positions, live. `now` ticks every 20 s so the age labels stay current. */
export function useGuideLocations(tripId: string) {
  const { rows } = useLiveTable<GuideLocation>('guide_locations', 'trip_id', tripId, locationsQuery, 60_000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  return { locations: rows, now };
}
