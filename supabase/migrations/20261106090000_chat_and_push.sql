-- Phase 2: one private conversation per booking (traveller party <-> the trip's guides),
-- read markers for unread badges, and push tokens for notifications.

create function public.current_member_id(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from trip_members m where m.trip_id = t and m.email = public.current_email()
$$;

-- A conversation is identified by the traveller's membership row (their booking).
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  conversation_id uuid not null references public.trip_members(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role public.trip_role not null,
  sender_name text not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_trip_idx on public.messages (trip_id, created_at desc);

-- Who may read or write a conversation: the traveller whose booking it is, and the trip's guides.
create function public.can_access_conversation(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members c
    where c.id = conv and c.role = 'traveller'
      and (c.email = public.current_email() or public.is_trip_guide(c.trip_id))
  )
$$;

-- Fill sender fields from the sender's own membership so nobody can post as someone else.
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv trip_members;
  me trip_members;
begin
  select * into conv from trip_members where id = new.conversation_id;
  select * into me from trip_members where trip_id = conv.trip_id and email = public.current_email();
  if conv.id is null or me.id is null then
    raise exception 'not a member of this trip';
  end if;
  new.trip_id := conv.trip_id;
  new.sender_id := auth.uid();
  new.sender_role := me.role;
  new.sender_name := me.display_name;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

alter table public.messages enable row level security;
create policy "participants read messages" on public.messages for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy "participants send messages" on public.messages for insert to authenticated
  with check (public.can_access_conversation(conversation_id));
-- No update or delete policies: messages are a record of what was said.

-- Read markers: one row per person per conversation.
create table public.conversation_reads (
  conversation_id uuid not null references public.trip_members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
create policy "own read markers" on public.conversation_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_conversation(conversation_id));

-- Group announcements are read from the same chat view; track when the traveller last saw them.
create table public.announcement_reads (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.announcement_reads enable row level security;
create policy "own announcement markers" on public.announcement_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- Expo push tokens. A token belongs to the device's current user only.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_email_idx on public.push_tokens (email);
alter table public.push_tokens enable row level security;
-- Upserts go through register_push_token(); a phone that changes hands moves its token to the new user.
create policy "own tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "remove own tokens" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into push_tokens (token, user_id, email, platform, updated_at)
  values (p_token, auth.uid(), public.current_email(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, email = excluded.email,
    platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Who should get a push for a new message or announcement (used by the push edge function
-- with the service role). Never notifies the sender.
create function public.push_recipients(p_kind text, p_id uuid)
returns table (token text, title text, body text, url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind = 'message' then
    return query
      select t.token,
             case when msg.sender_role = 'guide' then 'Opas ' || msg.sender_name else msg.sender_name end,
             left(msg.body, 180),
             case when msg.sender_role = 'guide' then '/chat' else '/conversation/' || msg.conversation_id end
      from messages msg
      join trip_members m on m.trip_id = msg.trip_id
        and ((msg.sender_role = 'guide' and m.id = msg.conversation_id)       -- guide wrote: the booking's traveller
          or (msg.sender_role = 'traveller' and m.role = 'guide'))           -- traveller wrote: the guides
      join push_tokens t on t.email = m.email
      where msg.id = p_id and t.user_id is distinct from msg.sender_id;
  elsif p_kind = 'announcement' then
    return query
      select t.token, a.title, left(a.body, 180), '/chat'
      from announcements a
      join trip_members m on m.trip_id = a.trip_id and m.role = 'traveller'
      join push_tokens t on t.email = m.email
      where a.id = p_id and t.user_id is distinct from a.created_by;
  end if;
end $$;
revoke all on function public.push_recipients(text, uuid) from public, anon, authenticated;

-- Mark as read using the server clock (phone clocks drift).
create function public.mark_conversation_read(conv uuid) returns void
language sql security invoker set search_path = public as $$
  insert into conversation_reads (conversation_id, user_id, last_read_at) values (conv, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now()
$$;
create function public.mark_announcements_read(t uuid) returns void
language sql security invoker set search_path = public as $$
  insert into announcement_reads (trip_id, user_id, last_read_at) values (t, auth.uid(), now())
  on conflict (trip_id, user_id) do update set last_read_at = now()
$$;

-- Travellers need their guide's name and phone number for the chat header.
create policy "members read their guides" on public.trip_members for select to authenticated
  using (role = 'guide' and public.is_trip_member(trip_id));

alter publication supabase_realtime add table public.messages, public.conversation_reads, public.announcement_reads;
