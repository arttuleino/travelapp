-- Every paid extra also appears in the trip programme, so travellers see it with its time and price.
-- Adding an extra (with a time) creates its programme item; changing the extra's name, day, time,
-- price or notes updates that item; deleting the extra removes it again. An extra can instead be
-- linked to an existing programme item (e.g. the fondue evening), which is then left as it is.

alter table public.extras add column owns_programme_item boolean not null default false;

create function public.extra_programme_details(x public.extras) returns text
language sql immutable as $$
  select concat_ws(E'\n',
    'Lisämaksullinen: ' || replace(to_char(x.price, 'FM999990.00'), '.', ',') || ' € / hlö',
    nullif(trim(x.notes), ''))
$$;

create function public.extras_before_write() returns trigger
language plpgsql set search_path = public as $$
declare
  item uuid;
begin
  if tg_op = 'UPDATE' then
    -- The linked programme item was deleted (on delete set null): keep the extra off the programme.
    if pg_trigger_depth() > 1 then
      new.owns_programme_item := false;
      return new;
    end if;
    -- Linked elsewhere or unlinked: the old own item is removed in the after trigger.
    if new.programme_item_id is distinct from old.programme_item_id and old.owns_programme_item then
      new.owns_programme_item := false;
    end if;
  else
    new.owns_programme_item := false;
  end if;

  if new.programme_item_id is null and new.starts_at is not null then
    insert into programme_items (trip_id, day, starts_at, title, details)
    values (new.trip_id, new.day, new.starts_at, new.title, extra_programme_details(new))
    returning id into item;
    new.programme_item_id := item;
    new.owns_programme_item := true;
  elsif tg_op = 'UPDATE' and new.owns_programme_item and new.programme_item_id is not null then
    update programme_items
       set title = new.title, day = new.day, starts_at = coalesce(new.starts_at, starts_at), details = extra_programme_details(new)
     where id = new.programme_item_id
       and (title, day, starts_at, details) is distinct from (new.title, new.day, coalesce(new.starts_at, starts_at), extra_programme_details(new));
  end if;
  return new;
end $$;

create trigger extras_before_write before insert or update on public.extras
  for each row execute function public.extras_before_write();

create function public.extras_after_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.owns_programme_item and old.programme_item_id is not null
     and (tg_op = 'DELETE' or new.programme_item_id is distinct from old.programme_item_id) then
    delete from programme_items where id = old.programme_item_id;
  end if;
  return null;
end $$;

create trigger extras_after_write after update or delete on public.extras
  for each row execute function public.extras_after_write();

-- Extras added before this change get their programme item now.
update public.extras set notes = notes where programme_item_id is null and starts_at is not null;
