-- A programme item (or paid extra) with cash book entries cannot be deleted: the guide sees why
-- instead of a generic error. Deleting the whole trip still removes everything.
create function public.programme_items_before_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from cash_entries where programme_item_id = old.id)
     and exists (select 1 from trips where id = old.trip_id) then
    raise exception 'programme item has cash entries' using errcode = 'P0001', hint = 'has_cash_entries';
  end if;
  return old;
end $$;

create trigger programme_items_before_delete before delete on public.programme_items
  for each row execute function public.programme_items_before_delete();
