-- Answer bank: the guide's own answers to questions travellers ask often.
-- Travellers read them, and the AI guide (supabase/functions/ai-guide) answers from them
-- together with the trip's programme, hotel, flights and announcements.
-- Only the trip's guides add, change or remove answers.

create table if not exists public.answer_bank (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  question text not null check (length(trim(question)) between 1 and 300),
  answer text not null check (length(trim(answer)) between 1 and 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists answer_bank_trip_idx on public.answer_bank (trip_id, updated_at desc);

create or replace function public.answer_bank_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists answer_bank_before_write on public.answer_bank;
create trigger answer_bank_before_write before insert or update on public.answer_bank
  for each row execute function public.answer_bank_before_write();

alter table public.answer_bank enable row level security;

drop policy if exists "members read answers" on public.answer_bank;
create policy "members read answers" on public.answer_bank for select to authenticated
  using (public.is_trip_member(trip_id));
drop policy if exists "guides manage answers" on public.answer_bank;
create policy "guides manage answers" on public.answer_bank for all to authenticated
  using (public.is_trip_guide(trip_id)) with check (public.is_trip_guide(trip_id));

do $$ begin
  alter publication supabase_realtime add table public.answer_bank;
exception when duplicate_object then null;
end $$;
