-- Bus stops and timetables are no longer shown in the app: each destination recommends its own
-- public transport app instead (app/src/lib/local-transport.ts). Removes the imported timetable data.
drop table if exists public.transit_departures;
drop table if exists public.transit_stops;
drop table if exists public.transit_imports;
