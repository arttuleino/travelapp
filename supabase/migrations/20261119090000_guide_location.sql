-- Guide live location on the Map tab.
--
-- A guide can switch on location sharing; the app then keeps one row per guide up to date
-- (at most every ~15 s, and only when the guide has moved). Switching it off deletes the row.
-- Only members of the same trip can read it, and a guide can only write their own row.
-- The browser shares location only while the app is open on the guide's phone, so the app
-- shows how old the position is and hides it after a while.

create table if not exists public.guide_locations (
  member_id uuid primary key references public.trip_members(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy real,
  -- Copied from trip_members by the trigger, because travellers cannot read the guide's membership row.
  guide_name text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists guide_locations_trip_idx on public.guide_locations (trip_id);

-- The server's clock decides how fresh a position is, not the phone's.
create or replace function public.guide_locations_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.guide_name := coalesce((select display_name from trip_members where id = new.member_id), '');
  return new;
end $$;
drop trigger if exists guide_locations_touch on public.guide_locations;
create trigger guide_locations_touch before insert or update on public.guide_locations
  for each row execute function public.guide_locations_touch();

-- True when member `m` of trip `t` is a guide and is the signed-in user.
create or replace function public.is_own_guide_row(m uuid, t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members tm
    where tm.id = m and tm.trip_id = t and tm.role = 'guide' and tm.email = public.current_email()
  )
$$;

alter table public.guide_locations enable row level security;

drop policy if exists "members read guide location" on public.guide_locations;
create policy "members read guide location" on public.guide_locations for select to authenticated
  using (public.is_trip_member(trip_id));
drop policy if exists "guide shares own location" on public.guide_locations;
create policy "guide shares own location" on public.guide_locations for insert to authenticated
  with check (public.is_own_guide_row(member_id, trip_id));
drop policy if exists "guide moves own location" on public.guide_locations;
create policy "guide moves own location" on public.guide_locations for update to authenticated
  using (public.is_own_guide_row(member_id, trip_id)) with check (public.is_own_guide_row(member_id, trip_id));
drop policy if exists "guide stops sharing" on public.guide_locations;
create policy "guide stops sharing" on public.guide_locations for delete to authenticated
  using (public.is_own_guide_row(member_id, trip_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guide_locations'
  ) then
    alter publication supabase_realtime add table public.guide_locations;
  end if;
end $$;

-- Demo trip: the demo guide "Sanna" stands at the Schattberg X-press valley station, so the
-- live location shows straight away. Refreshed on every demo sign-in, unless someone signed in as
-- the demo guide is sharing a real location right now (updated in the last 15 minutes).
create or replace function public.refresh_demo_guide_location() returns void
language plpgsql security definer set search_path = public as $$
declare
  trip constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  guide constant uuid := 'd0000000-0000-4000-8000-0000000000c1';
begin
  if not exists (select 1 from trip_members where id = guide and trip_id = trip) then
    return;
  end if;
  if exists (select 1 from guide_locations where member_id = guide and updated_at > now() - interval '15 minutes') then
    return;
  end if;
  insert into guide_locations (member_id, trip_id, lat, lng, accuracy)
  values (guide, trip, 47.39046, 12.63478, 12)
  on conflict (member_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy;
end $$;

create or replace function public.ensure_demo_trip() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from trips
    where id = 'd0000000-0000-4000-8000-0000000000a1'
      and (created_at at time zone timezone)::date = (now() at time zone timezone)::date
  ) then
    perform reset_demo_trip();
  end if;
  perform refresh_demo_guide_location();
end $$;

revoke all on function public.refresh_demo_guide_location() from public, anon, authenticated;
revoke all on function public.ensure_demo_trip() from public, anon, authenticated;
grant execute on function public.refresh_demo_guide_location(), public.ensure_demo_trip() to service_role;
