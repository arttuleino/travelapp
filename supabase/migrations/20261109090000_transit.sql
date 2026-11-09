-- Public transport near the destination: bus stops on the map and their timetabled departures.
-- Imported per trip from open GTFS timetable data (scripts/import-transit.mjs, service role).
-- Departures are scheduled times, not live: the app labels them so. A live delay can be filled
-- into delay_s later if a realtime source becomes available.

create table public.transit_imports (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  source text not null,                 -- e.g. 'Mobilitätsverbünde Österreich GTFS 2026'
  -- Set when some trip days were outside the feed's dates and were filled from the same weekday
  -- of the feed's last week (next season's timetable not published yet).
  projected boolean not null default false,
  imported_at timestamptz not null default now()
);

create table public.transit_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_ref text not null,               -- GTFS stop_id
  name text not null,
  lat double precision not null,
  lon double precision not null,
  unique (trip_id, stop_ref)
);

create table public.transit_departures (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_id uuid not null references public.transit_stops(id) on delete cascade,
  service_date date not null,           -- local date of the departure
  departs_at time not null,             -- local time
  route text not null default '',       -- line, e.g. '680'
  headsign text not null default '',    -- direction, e.g. 'Hinterglemm Lindlingalm'
  delay_s integer                       -- live delay, when known (not used yet)
);
create index transit_departures_stop_idx on public.transit_departures (stop_id, service_date, departs_at);
create index transit_departures_trip_idx on public.transit_departures (trip_id);

alter table public.transit_imports enable row level security;
alter table public.transit_stops enable row level security;
alter table public.transit_departures enable row level security;

-- Everyone on the trip can read; only the import (service role) writes.
create policy "members read transit import" on public.transit_imports for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "members read stops" on public.transit_stops for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "members read departures" on public.transit_departures for select to authenticated
  using (public.is_trip_member(trip_id));
