#!/usr/bin/env node
// Imports bus stops near a trip's destination and their timetabled departures for the trip's
// days from an open GTFS timetable, e.g. Mobilitätsverbünde Österreich's (data.mobilitaetsverbuende.at).
//
// Usage (from app/):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-transit.mjs \
//     --trip <trip uuid> --gtfs <gtfs.zip or unzipped folder> --lat 47.3913 --lon 12.6364 [--radius 6000] \
//     [--source "Mobilitätsverbünde Österreich"] [--dry-run]
//
// Re-running replaces the trip's stops and departures. Trip days after the feed's last date are
// filled from the same weekday of its last week and the import is marked "projected".
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

import { datesBetween, distanceM, feedRange, projectDates, resolveTime, rowReader, serviceDates } from './gtfs.mjs';

const { values: args } = parseArgs({
  options: {
    trip: { type: 'string' },
    gtfs: { type: 'string' },
    lat: { type: 'string' },
    lon: { type: 'string' },
    radius: { type: 'string', default: '6000' },
    source: { type: 'string', default: 'GTFS' },
    'dry-run': { type: 'boolean', default: false },
  },
});
if (!args.trip || !args.gtfs || !args.lat || !args.lon) {
  console.error('Käyttö: node scripts/import-transit.mjs --trip <uuid> --gtfs <zip|kansio> --lat <lat> --lon <lon> [--radius 6000] [--source nimi] [--dry-run]');
  process.exit(2);
}
const center = { lat: Number(args.lat), lon: Number(args.lon) };
const radius = Number(args.radius);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Aseta SUPABASE_URL ja SUPABASE_SERVICE_ROLE_KEY. Palveluavainta ei koskaan laiteta sovellukseen.');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const must = ({ data, error }, what) => {
  if (error) {
    console.error(`${what} epäonnistui: ${error.message}`);
    process.exit(1);
  }
  return data;
};

const trip = must(await db.from('trips').select('id, name, starts_on, ends_on').eq('id', args.trip).maybeSingle(), 'Matkan haku');
if (!trip) {
  console.error(`Matkaa ${args.trip} ei löytynyt.`);
  process.exit(1);
}

// ---- Reading GTFS files line by line (stop_times.txt for all of Austria is several hundred MB) ----

const isZip = existsSync(args.gtfs) && statSync(args.gtfs).isFile();

function lines(file) {
  if (isZip) {
    const unzip = spawn('unzip', ['-p', args.gtfs, file]);
    return createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  }
  const path = join(args.gtfs, file);
  if (!existsSync(path)) return null;
  return createInterface({ input: createReadStream(path), crlfDelay: Infinity });
}

/** Calls `each(row)` for every row of a GTFS file; returns false if the file is missing. */
async function eachRow(file, each) {
  const rl = lines(file);
  if (!rl) return false;
  let read = null;
  let any = false;
  for await (const line of rl) {
    if (!read) {
      read = rowReader(line);
      continue;
    }
    if (line.trim()) {
      any = true;
      each(read(line));
    }
  }
  return any || read !== null;
}

// 1. Stops within the radius (platforms and plain stops, not parent stations).
const stops = new Map();
await eachRow('stops.txt', (s) => {
  if (s.location_type && s.location_type !== '0') return;
  const lat = Number(s.stop_lat);
  const lon = Number(s.stop_lon);
  if (distanceM(center.lat, center.lon, lat, lon) <= radius) stops.set(s.stop_id, { stop_ref: s.stop_id, name: s.stop_name, lat, lon });
});
console.log(`Pysäkkejä ${radius} m säteellä: ${stops.size}`);
if (!stops.size) process.exit(1);

// 2. Stop times at those stops.
const times = [];
const tripIds = new Set();
await eachRow('stop_times.txt', (st) => {
  if (!stops.has(st.stop_id)) return;
  const t = st.departure_time || st.arrival_time;
  if (!t) return;
  times.push({ trip_id: st.trip_id, stop_id: st.stop_id, time: t.length === 7 ? `0${t}` : t });
  tripIds.add(st.trip_id);
});

// 3. Their trips and routes.
const trips = new Map();
await eachRow('trips.txt', (t) => {
  if (tripIds.has(t.trip_id)) trips.set(t.trip_id, t);
});
const routes = new Map();
await eachRow('routes.txt', (r) => routes.set(r.route_id, r.route_short_name || r.route_long_name || ''));

// 4. Which services run on which trip day.
const calendar = [];
const calendarDates = [];
await eachRow('calendar.txt', (c) => calendar.push(c));
await eachRow('calendar_dates.txt', (c) => calendarDates.push(c));
const tripDates = datesBetween(trip.starts_on, trip.ends_on);
const range = feedRange(calendar, calendarDates);
const projection = projectDates(tripDates, range);
const projected = [...projection].some(([d, src]) => d !== src);
const running = serviceDates(calendar, calendarDates, [...new Set(projection.values())]);
console.log(`Aikataulu kattaa ${range?.start}–${range?.end}.${projected ? ' Matkan päiviä täytetään aikataulun viimeisen viikon mukaan.' : ''}`);

// 5. Departures per trip day.
const departures = [];
for (const [day, src] of projection) {
  for (const st of times) {
    const t = trips.get(st.trip_id);
    if (!t || !running.get(t.service_id)?.has(src)) continue;
    const { date, time } = resolveTime(day, st.time);
    departures.push({ stop_ref: st.stop_id, service_date: date, departs_at: time, route: routes.get(t.route_id) ?? '', headsign: t.trip_headsign ?? '' });
  }
}
// Keep only stops that have departures during the trip.
const usedRefs = new Set(departures.map((d) => d.stop_ref));
const usedStops = [...stops.values()].filter((s) => usedRefs.has(s.stop_ref));
console.log(`Lähtöjä matkan aikana: ${departures.length}, pysäkkejä joilla lähtöjä: ${usedStops.length}`);
if (args['dry-run']) process.exit(0);

// ---- Write: replace the trip's stops (departures cascade) ----
must(await db.from('transit_stops').delete().eq('trip_id', trip.id), 'Vanhojen pysäkkien poisto');
const stopRows = must(
  await db
    .from('transit_stops')
    .insert(usedStops.map((s) => ({ ...s, trip_id: trip.id })))
    .select('id, stop_ref'),
  'Pysäkkien tallennus',
);
const idOf = new Map(stopRows.map((s) => [s.stop_ref, s.id]));
for (let i = 0; i < departures.length; i += 1000) {
  const batch = departures.slice(i, i + 1000).map(({ stop_ref, ...d }) => ({ ...d, trip_id: trip.id, stop_id: idOf.get(stop_ref) }));
  must(await db.from('transit_departures').insert(batch), 'Lähtöjen tallennus');
}
must(
  await db.from('transit_imports').upsert({ trip_id: trip.id, source: args.source, projected, imported_at: new Date().toISOString() }),
  'Tuonnin tietojen tallennus',
);
console.log(`Valmis: ${trip.name}, ${usedStops.length} pysäkkiä, ${departures.length} lähtöä.`);
