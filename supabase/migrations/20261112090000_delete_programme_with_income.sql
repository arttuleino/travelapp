-- A programme item with arrangement income in the cash book (e.g. payments for the fondue evening)
-- could not be deleted: the income must name its arrangement, so clearing the link failed.
-- Now the income is kept and becomes "other income", with the item's name and date in its comment.
create function public.programme_items_before_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  update cash_entries
     set kind = 'income_other',
         comment = concat_ws(', ', format('%s %s', old.title, to_char(old.day, 'FMDD.FMMM.')), nullif(comment, ''))
   where programme_item_id = old.id and kind = 'income_arrangement';
  return old;
end $$;

create trigger programme_items_before_delete before delete on public.programme_items
  for each row execute function public.programme_items_before_delete();
