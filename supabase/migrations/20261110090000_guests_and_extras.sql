-- Paid extras (bar crawl, Ribs & Rodel...) and who has paid for them.
--   extras         events the guide adds for the trip, with a price per person
--   extra_signups  one row per booking taking part: persons, and whether it is paid
-- A booking is unpaid, prepaid (from the operator's booking system, later) or paid on the spot
-- by MobilePay or cash. Paying on the spot records the income in the trip cash book; undoing
-- the payment removes that entry again. Bank transfer is not an option.
-- Only the trip's guides can see or change any of this.

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  day date not null,
  starts_at time,
  price numeric(10,2) not null default 0 check (price >= 0),  -- per person, EUR
  programme_item_id uuid references public.programme_items(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index extras_trip_idx on public.extras (trip_id, day, starts_at);

create table public.extra_signups (
  id uuid primary key default gen_random_uuid(),
  extra_id uuid not null references public.extras(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  persons int not null default 1 check (persons > 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'prepaid', 'paid')),
  method text check (method in ('mobile', 'cash')),
  amount_paid numeric(10,2),
  paid_at timestamptz,
  paid_by uuid,
  cash_entry_id uuid references public.cash_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (extra_id, member_id),
  constraint extra_signups_paid check ((status = 'paid') = (method is not null))
);
create index extra_signups_trip_idx on public.extra_signups (trip_id);

alter table public.extras enable row level security;
alter table public.extra_signups enable row level security;

create policy "guides manage extras" on public.extras for all to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));
create policy "guides manage signups" on public.extra_signups for all to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));

-- A signup belongs to its extra's trip, and only a booking on that trip can sign up.
-- Payment fields are changed only through the functions below (or by the booking import).
create function public.extra_signups_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  select e.trip_id into new.trip_id from extras e where e.id = new.extra_id;
  if not exists (select 1 from trip_members m where m.id = new.member_id and m.trip_id = new.trip_id) then
    raise exception 'member is not on this trip';
  end if;
  if current_user in ('authenticated', 'anon') and coalesce(current_setting('app.payment', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.status := 'unpaid'; new.method := null; new.amount_paid := null; new.paid_at := null; new.paid_by := null; new.cash_entry_id := null;
    else
      new.status := old.status; new.method := old.method; new.amount_paid := old.amount_paid;
      new.paid_at := old.paid_at; new.paid_by := old.paid_by; new.cash_entry_id := old.cash_entry_id;
    end if;
  end if;
  return new;
end $$;

create trigger extra_signups_before_write before insert or update on public.extra_signups
  for each row execute function public.extra_signups_before_write();

-- Marks a booking as paid on the spot and records the income in the cash book, in one go.
-- Runs with the caller's rights, so only the trip's guides get through row-level security.
create function public.record_extra_payment(p_signup uuid, p_method text)
returns public.extra_signups
language plpgsql set search_path = public as $$
declare
  s extra_signups;
  x extras;
  who text;
  tz text;
  due numeric(10,2);
  entry uuid;
begin
  if p_method not in ('mobile', 'cash') then raise exception 'payment method must be mobile or cash'; end if;
  select * into s from extra_signups where id = p_signup for update;
  if not found then raise exception 'signup not found'; end if;
  if s.status <> 'unpaid' then raise exception 'already paid'; end if;
  select * into x from extras where id = s.extra_id;
  select display_name into who from trip_members where id = s.member_id;
  select timezone into tz from trips where id = s.trip_id;
  due := x.price * s.persons;
  if due > 0 then
    insert into cash_entries (trip_id, kind, account, amount, entry_date, comment, programme_item_id)
    values (
      s.trip_id,
      case when x.programme_item_id is null then 'income_other' else 'income_arrangement' end,
      p_method, due, (now() at time zone tz)::date,
      format('%s: %s, %s hlö', x.title, who, s.persons),
      x.programme_item_id
    )
    returning id into entry;
  end if;
  perform set_config('app.payment', 'on', true);
  update extra_signups
     set status = 'paid', method = p_method, amount_paid = due, paid_at = now(), paid_by = auth.uid(), cash_entry_id = entry
   where id = p_signup
  returning * into s;
  perform set_config('app.payment', 'off', true);
  return s;
end $$;

-- Undoes an on-the-spot payment (e.g. tapped the wrong booking) and removes its cash book entry.
create function public.undo_extra_payment(p_signup uuid)
returns public.extra_signups
language plpgsql set search_path = public as $$
declare
  s extra_signups;
begin
  select * into s from extra_signups where id = p_signup for update;
  if not found then raise exception 'signup not found'; end if;
  if s.status <> 'paid' then raise exception 'only payments made on the spot can be undone'; end if;
  if s.cash_entry_id is not null then delete from cash_entries where id = s.cash_entry_id; end if;
  perform set_config('app.payment', 'on', true);
  update extra_signups
     set status = 'unpaid', method = null, amount_paid = null, paid_at = null, paid_by = null, cash_entry_id = null
   where id = p_signup
  returning * into s;
  perform set_config('app.payment', 'off', true);
  return s;
end $$;

grant execute on function public.record_extra_payment(uuid, text), public.undo_extra_payment(uuid) to authenticated;

alter publication supabase_realtime add table public.extras, public.extra_signups;
