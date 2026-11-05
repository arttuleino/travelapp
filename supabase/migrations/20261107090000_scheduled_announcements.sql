-- Guides can schedule announcements for later and edit them after sending.
--   send_at   when travellers see it (default: immediately)
--   edited_at set when the text changes after it has gone out ("muokattu" in the app)
--   pushed_at set once the push notification has been sent, so each announcement is pushed once

alter table public.announcements
  add column send_at timestamptz not null default now(),
  add column edited_at timestamptz,
  add column pushed_at timestamptz;

-- Existing announcements were sent (and pushed) when they were created.
update public.announcements set send_at = created_at, pushed_at = created_at;

drop index if exists public.announcements_trip_idx;
create index announcements_trip_idx on public.announcements (trip_id, send_at desc);
create index announcements_push_due_idx on public.announcements (send_at) where pushed_at is null;

-- Travellers only see announcements whose time has come; guides also see scheduled ones.
drop policy "members read announcements" on public.announcements;
create policy "members read sent announcements" on public.announcements for select to authenticated
  using (public.is_trip_member(trip_id) and (send_at <= now() or public.is_trip_guide(trip_id)));

create policy "guides edit announcements" on public.announcements for update to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));
-- Deleting is for cancelling a scheduled announcement; sent ones are edited instead.
create policy "guides cancel scheduled announcements" on public.announcements for delete to authenticated
  using (public.is_trip_guide(trip_id) and send_at > now());

create function public.announcements_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.edited_at := null;
    new.pushed_at := null;
    if new.send_at < now() then new.send_at := now(); end if;
    return new;
  end if;
  -- Ownership, history and push bookkeeping cannot be changed from the app.
  new.trip_id := old.trip_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if current_user in ('authenticated', 'anon') then
    new.pushed_at := old.pushed_at;
  end if;
  if old.send_at <= now() then
    new.send_at := old.send_at;                -- already sent: cannot be unsent or moved
    if new.title is distinct from old.title or new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  else
    new.edited_at := null;                      -- still scheduled: just a draft change
    if new.send_at < now() then new.send_at := now(); end if;   -- "send now"
  end if;
  return new;
end $$;

create trigger announcements_before_write before insert or update on public.announcements
  for each row execute function public.announcements_before_write();

-- Marks every due, not yet pushed announcement as pushed and returns their ids. Called by the
-- push edge function (service role) on new announcements and from a once-a-minute cron job.
-- Announcements more than a day late are marked but not returned (no stale notifications).
create function public.claim_due_announcements()
returns setof uuid
language sql volatile security definer set search_path = public as $$
  with due as (
    update announcements set pushed_at = now()
    where pushed_at is null and send_at <= now()
    returning id, send_at
  )
  select id from due where send_at > now() - interval '1 day'
$$;
revoke all on function public.claim_due_announcements() from public, anon, authenticated;
