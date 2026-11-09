import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useLiveTable } from './trip';

export type TransitStop = { id: string; trip_id: string; stop_ref: string; name: string; lat: number; lon: number };
export type Departure = { id: number; service_date: string; departs_at: string; route: string; headsign: string; delay_s: number | null };
export type TransitImport = { trip_id: string; source: string; projected: boolean; imported_at: string };

const stopsQuery = (tripId: string) => supabase.from('transit_stops').select('*').eq('trip_id', tripId).order('name');
const importQuery = (tripId: string) => supabase.from('transit_imports').select('*').eq('trip_id', tripId);

/** Bus stops near the destination (imported from the open timetable). Empty if none were imported. */
export function useStops(tripId: string) {
  const { rows, loading } = useLiveTable<TransitStop>('transit_stops', 'trip_id', tripId, stopsQuery);
  return { stops: rows, loading };
}

export function useTransitImport(tripId: string): TransitImport | null {
  return useLiveTable<TransitImport>('transit_imports', 'trip_id', tripId, importQuery).rows[0] ?? null;
}

/**
 * The next timetabled departures from a stop after `date` `time` (destination time), refreshed
 * every minute. These are scheduled times, not live.
 */
export function useNextDepartures(stopId: string | null, date: string, time: string, limit = 8) {
  const [state, setState] = useState<{ key: string; rows: Departure[] } | null>(null);
  const key = `${stopId}:${date}:${time}`;

  useEffect(() => {
    if (!stopId) return;
    let cancelled = false;
    supabase
      .from('transit_departures')
      .select('id, service_date, departs_at, route, headsign, delay_s')
      .eq('stop_id', stopId)
      .or(`and(service_date.eq.${date},departs_at.gte.${time}),service_date.gt.${date}`)
      .order('service_date')
      .order('departs_at')
      .limit(limit)
      .then(({ data }) => {
        if (!cancelled) setState({ key, rows: (data ?? []) as Departure[] });
      });
    return () => {
      cancelled = true;
    };
  }, [key, stopId, date, time, limit]);

  const fresh = state?.key === key;
  return { departures: fresh ? state.rows : [], loading: !!stopId && !fresh };
}

/** Map region that shows all stops with a little margin. */
export function regionFor(stops: { lat: number; lon: number }[]) {
  if (!stops.length) return null;
  const lats = stops.map((s) => s.lat);
  const lons = stops.map((s) => s.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.3),
    longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.3),
  };
}
