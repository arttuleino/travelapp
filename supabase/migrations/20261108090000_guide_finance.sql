-- Guide finance: the trip cash book ("matkakassa"), modelled on the operator's weekly cash report.
-- Only the trip's guides can see or change it; travellers never see it.
--   cash_books    one per trip: destination number, department, responsible person, opening balances
--   cash_entries  vouchers: costs (negative), income (positive) and transfers between accounts
-- Accounts: bank, cash, mobile (MobilePay). A cost paid by the guide's bank card is account
-- 'bankcard', which counts towards the bank balance.

create table public.cash_books (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  dest_number text not null default '',
  department text not null default '',
  responsible text not null default '',
  currency text not null default 'EUR',
  opening_bank numeric(12,2) not null default 0,
  opening_cash numeric(12,2) not null default 0,
  opening_mobile numeric(12,2) not null default 0,
  next_voucher integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  voucher_no integer not null,
  kind text not null check (kind in ('cost_other', 'cost_arrangement', 'transfer', 'income_arrangement', 'income_other')),
  account text not null check (account in ('bankcard', 'bank', 'cash', 'mobile')),
  amount numeric(12,2) not null check (amount <> 0),
  entry_date date not null,
  comment text not null default '',
  -- The arrangement (programme item) a cost or income belongs to, e.g. "Fondue-ilta 15.2."
  programme_item_id uuid references public.programme_items(id) on delete set null,
  -- Both halves of a transfer share this id.
  transfer_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (trip_id, voucher_no),
  constraint cash_entries_sign check (
    (kind in ('cost_other', 'cost_arrangement') and amount < 0)
    or (kind in ('income_arrangement', 'income_other') and amount > 0)
    or (kind = 'transfer' and transfer_id is not null and account <> 'bankcard')
  ),
  constraint cash_entries_cost_account check (kind not like 'cost%' or account in ('bankcard', 'cash')),
  constraint cash_entries_arrangement check (kind <> 'income_arrangement' or programme_item_id is not null)
);
create index cash_entries_trip_idx on public.cash_entries (trip_id, entry_date, voucher_no);

alter table public.cash_books enable row level security;
alter table public.cash_entries enable row level security;

create policy "guides read cash book" on public.cash_books for select to authenticated
  using (public.is_trip_guide(trip_id));
create policy "guides create cash book" on public.cash_books for insert to authenticated
  with check (public.is_trip_guide(trip_id));
create policy "guides edit cash book" on public.cash_books for update to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));

create policy "guides read cash entries" on public.cash_entries for select to authenticated
  using (public.is_trip_guide(trip_id));
create policy "guides add cash entries" on public.cash_entries for insert to authenticated
  with check (public.is_trip_guide(trip_id));
create policy "guides edit cash entries" on public.cash_entries for update to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));
create policy "guides delete cash entries" on public.cash_entries for delete to authenticated
  using (public.is_trip_guide(trip_id));

-- Voucher numbers run 1, 2, 3... per trip and are never reused. Ownership cannot change.
create function public.cash_entries_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into cash_books (trip_id) values (new.trip_id) on conflict (trip_id) do nothing;
    update cash_books set next_voucher = next_voucher + 1
      where trip_id = new.trip_id
      returning next_voucher - 1 into new.voucher_no;
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.trip_id := old.trip_id;
    new.voucher_no := old.voucher_no;
    new.transfer_id := old.transfer_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if new.programme_item_id is not null
     and not exists (select 1 from programme_items p where p.id = new.programme_item_id and p.trip_id = new.trip_id) then
    raise exception 'programme item is not on this trip';
  end if;
  return new;
end $$;

create trigger cash_entries_before_write before insert or update on public.cash_entries
  for each row execute function public.cash_entries_before_write();

create function public.cash_books_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.trip_id := old.trip_id;
  -- Only the voucher trigger (security definer, so not running as the app's role) moves the counter.
  if current_user in ('authenticated', 'anon') then
    new.next_voucher := old.next_voucher;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger cash_books_before_update before update on public.cash_books
  for each row execute function public.cash_books_before_update();

alter publication supabase_realtime add table public.cash_books, public.cash_entries;
