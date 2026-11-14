-- Guide finance, part 2: receipts and sending the weekly report to the office.
--   cash_entries.receipt         the guide has the receipt for this cost (paper receipts go to the office)
--   cash_books.report_sent_at    when the guide last sent the weekly report
-- Both are plain columns under the existing guide-only row-level security.

alter table public.cash_entries add column if not exists receipt boolean not null default false;
alter table public.cash_books add column if not exists report_sent_at timestamptz;
