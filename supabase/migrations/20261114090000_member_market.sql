-- Which STS market a booking was made in (Finland, Sweden or Norway). The app shows that market's
-- customer service (phone, email, opening hours). Comes from the operator's booking data.
alter table public.trip_members add column market text check (market in ('FI', 'SE', 'NO'));
