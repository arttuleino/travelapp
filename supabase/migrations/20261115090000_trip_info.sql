-- Trip details for the traveller's Matka tab: flights, transfers and the hotel.
-- All of it comes from the operator's booking data via the import; nobody edits it in the app.

alter table public.trips
  add column if not exists hotel_stars int check (hotel_stars between 1 and 5),
  add column if not exists hotel_address text,
  add column if not exists hotel_phone text,
  add column if not exists hotel_lift_distance text,   -- e.g. "300 m Schattberg X-press -hissille"
  add column if not exists check_in_time time,         -- on starts_on
  add column if not exists check_out_time time;        -- on ends_on

-- Room type and board for one booking, e.g. "Kahden hengen huone, parveke, puolihoito".
alter table public.trip_members add column if not exists room_type text;

create table if not exists public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  direction text not null check (direction in ('out', 'return')),
  flight_date date not null,
  flight_no text not null,
  airline text,
  dep_code text not null,
  dep_city text,
  dep_time time not null,
  arr_code text not null,
  arr_city text,
  arr_time time not null,
  terminal text,
  baggage text,
  transfer text,                                      -- e.g. "Bussi Salzburgista hotelliin, sisältyy"
  created_at timestamptz not null default now()
);
create index if not exists trip_flights_trip_idx on public.trip_flights (trip_id, flight_date, dep_time);

alter table public.trip_flights enable row level security;
-- Members read their trip's flights; only the import (service role) writes them.
drop policy if exists "members read flights" on public.trip_flights;
create policy "members read flights" on public.trip_flights for select to authenticated
  using (public.is_trip_member(trip_id));
