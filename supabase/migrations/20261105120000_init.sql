-- Core data model for phase 1: operators, trips, trip members, programme and announcements.
-- Trip data comes from the operator's booking system (via import), not from travellers.

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand_color text not null default '#FFE76A',
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  external_ref text,                         -- id in the operator's booking system
  name text not null,
  destination text not null,
  country text,
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'Europe/Vienna',
  hotel_name text,
  created_at timestamptz not null default now(),
  constraint trips_dates check (ends_on >= starts_on),
  unique (operator_id, external_ref)
);

create type public.trip_role as enum ('traveller', 'guide');

-- People on a trip. Matched to a login by email, so travellers sign in with the
-- address they gave when booking and need no separate registration.
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null check (email = lower(email)),  -- stored lowercase; import lowercases it
  role public.trip_role not null default 'traveller',
  display_name text not null,
  booking_ref text,
  party_size int not null default 1 check (party_size > 0),
  room text,
  phone text,
  created_at timestamptz not null default now(),
  unique (trip_id, email)
);
create index trip_members_email_idx on public.trip_members (email);

create table public.programme_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  starts_at time not null,
  title text not null check (length(title) between 1 and 200),
  details text not null default '',
  previous_starts_at time,                   -- set automatically when a guide moves the item
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index programme_items_trip_day_idx on public.programme_items (trip_id, day, starts_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index announcements_trip_idx on public.announcements (trip_id, created_at desc);

-- ---------- helpers ----------
create function public.current_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function public.is_trip_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members m where m.trip_id = t and m.email = public.current_email())
$$;

create function public.is_trip_guide(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members m where m.trip_id = t and m.role = 'guide' and m.email = public.current_email())
$$;

-- Keep previous_starts_at so travellers see "moved 09:00 -> 09:15".
create function public.programme_items_before_update() returns trigger
language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.previous_starts_at := coalesce(old.previous_starts_at, old.starts_at);
    if new.previous_starts_at = new.starts_at then
      new.previous_starts_at := null;        -- moved back to the original time
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger programme_items_before_update before update on public.programme_items
  for each row execute function public.programme_items_before_update();

-- ---------- row level security ----------
alter table public.operators enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.programme_items enable row level security;
alter table public.announcements enable row level security;

create policy "members read their operator" on public.operators for select to authenticated
  using (exists (select 1 from trips t where t.operator_id = operators.id and public.is_trip_member(t.id)));

create policy "members read their trips" on public.trips for select to authenticated
  using (public.is_trip_member(id));

create policy "read own membership, guides read all" on public.trip_members for select to authenticated
  using (email = public.current_email() or public.is_trip_guide(trip_id));

create policy "members read programme" on public.programme_items for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "guides add programme" on public.programme_items for insert to authenticated
  with check (public.is_trip_guide(trip_id));
create policy "guides edit programme" on public.programme_items for update to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));
create policy "guides delete programme" on public.programme_items for delete to authenticated
  using (public.is_trip_guide(trip_id));

create policy "members read announcements" on public.announcements for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "guides post announcements" on public.announcements for insert to authenticated
  with check (public.is_trip_guide(trip_id) and created_by = auth.uid());

-- Live updates to the app
alter publication supabase_realtime add table public.programme_items, public.announcements;
