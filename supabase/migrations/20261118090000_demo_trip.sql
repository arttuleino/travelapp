-- Sales demo on the real database: one sample trip that anyone can open from the login page
-- ("Kokeile demoa": as a traveller or as the guide) through the demo-login edge function.
--
-- The demo accounts are ordinary trip members, so row level security keeps them inside the demo
-- trip: they never see a real customer's trip, and real customers never see the demo.
-- The trip's dates follow the calendar (today is always day 3 of 8), so no pinned app clock is
-- needed. The first demo sign-in of each day (Europe/Vienna) resets everything to the start state.
--
-- Demo sign-ins: demo.asiakas@groupglide.com (traveller), demo.opas@groupglide.com (guide).
-- Only the service role (the demo-login function) may call these functions.

create or replace function public.reset_demo_trip() returns void
language plpgsql security definer set search_path = public as $$
declare
  op constant uuid := 'd0000000-0000-4000-8000-000000000001';
  trip constant uuid := 'd0000000-0000-4000-8000-0000000000a1';
  tz constant text := 'Europe/Vienna';
  d0 date := (now() at time zone tz)::date - 2;
  old_claims text := current_setting('request.jwt.claims', true);
  guide uuid := 'd0000000-0000-4000-8000-0000000000c1';
  leino uuid := 'd0000000-0000-4000-8000-0000000000c2';
  salonen uuid := 'd0000000-0000-4000-8000-0000000000c3';
  lindholm uuid := 'd0000000-0000-4000-8000-0000000000c4';
  korhonen uuid := 'd0000000-0000-4000-8000-0000000000c5';
  haugen uuid := 'd0000000-0000-4000-8000-0000000000c6';
  welcome uuid := 'd0000000-0000-4000-8000-000000000103';
  fondue uuid := 'd0000000-0000-4000-8000-000000000109';
  fondue_extra uuid := 'd0000000-0000-4000-8000-0000000000e1';
  rodel_extra uuid := 'd0000000-0000-4000-8000-0000000000e2';
  transfer uuid := 'd0000000-0000-4000-8000-0000000000a9';
  paid_entry uuid;
begin
  -- Everything hangs off the trip, so this removes programme, chat, extras and the cash book too.
  delete from trips where id = trip;
  insert into operators (id, name, slug) values (op, 'GroupGlide demo', 'groupglide-demo')
    on conflict (id) do nothing;

  insert into trips (id, operator_id, external_ref, name, destination, country, starts_on, ends_on, timezone,
                     hotel_name, hotel_stars, hotel_address, hotel_phone, hotel_lift_distance, check_in_time, check_out_time)
  values (trip, op, 'DEMO', 'Hiihtomatka Saalbach-Hinterglemm', 'Saalbach-Hinterglemm', 'Itävalta', d0, d0 + 7, tz,
          'Hotel Bergkristall', 4, 'Glemmtaler Landesstraße 512, 5753 Saalbach', '+43 6541 6232',
          '300 m Schattberg X-press -hissille', '15:00', '10:00');

  insert into trip_members (id, trip_id, email, role, display_name, booking_ref, party_size, room, phone, market, room_type) values
    (guide,    trip, 'demo.opas@groupglide.com',    'guide',     'Sanna Virtanen',          null,        1, null,  '+43 664 123 4567', null, null),
    (leino,    trip, 'demo.asiakas@groupglide.com', 'traveller', 'Arttu ja Emma Leino',     'AM-274913', 2, '312', '+358 40 123 4567', 'FI', 'Kahden hengen huone, parveke, puolihoito'),
    (salonen,  trip, 'mikko.demo@example.com',      'traveller', 'Mikko Salonen',           'AM-274920', 1, '214', '+358 50 234 5678', 'FI', 'Yhden hengen huone, puolihoito'),
    (lindholm, trip, 'lindholm.demo@example.com',   'traveller', 'Erik och Anna Lindholm',  'AM-274935', 2, '318', '+46 70 123 45 67', 'SE', 'Dubbelrum, puolihoito'),
    (korhonen, trip, 'korhonen.demo@example.com',   'traveller', 'Korhosen perhe',          'AM-274941', 3, '405', '+358 44 345 6789', 'FI', 'Perhehuone, puolihoito'),
    (haugen,   trip, 'haugen.demo@example.com',     'traveller', 'Ingrid Haugen',           'AM-274952', 1, '220', '+47 912 34 567',   'NO', 'Enkeltrom, puolihoito');

  insert into trip_flights (trip_id, direction, flight_date, flight_no, airline, dep_code, dep_city, dep_time,
                            arr_code, arr_city, arr_time, terminal, baggage, transfer) values
    (trip, 'out',    d0,     'AY1661', 'Finnair', 'HEL', 'Helsinki', '06:45', 'SZG', 'Salzburg', '08:35', 'T2',
     '1 × 23 kg + suksipussi', 'Bussi Salzburgista hotelliin, sisältyy'),
    (trip, 'return', d0 + 7, 'AY1662', 'Finnair', 'SZG', 'Salzburg', '09:25', 'HEL', 'Helsinki', '13:15', null,
     '1 × 23 kg + suksipussi', 'Bussi hotellilta klo 06:15, sisältyy');

  insert into programme_items (id, trip_id, day, starts_at, title, details) values
    ('d0000000-0000-4000-8000-000000000101', trip, d0,     '06:45', 'Lento Helsinki → Salzburg', 'AY1661, terminaali 2'),
    ('d0000000-0000-4000-8000-000000000102', trip, d0,     '09:15', 'Bussikuljetus hotelliin', 'Noin 1 h 30 min. Opas mukana bussissa.'),
    (welcome,                                trip, d0,     '18:00', 'Tervetulotilaisuus', 'Hotellin aula. Hissikortit ja suksivuokran sovitus.'),
    ('d0000000-0000-4000-8000-000000000104', trip, d0 + 1, '08:30', 'Suksivuokraamon nouto', 'Intersport Bründl, 2 min hotellilta'),
    ('d0000000-0000-4000-8000-000000000105', trip, d0 + 1, '09:30', 'Tutustumislasku oppaan kanssa', 'Kokoontuminen Schattberg X-pressin ala-asemalla'),
    ('d0000000-0000-4000-8000-000000000106', trip, d0 + 2, '08:45', 'Aamun lumikatsaus chatissa', 'Opas lähettää päivän rinneolosuhteet'),
    ('d0000000-0000-4000-8000-000000000107', trip, d0 + 2, '09:15', 'Opastettu lasku: Zwölferkogel', 'Kokoontuminen Zwölferkogelbahnin ala-asemalla'),
    ('d0000000-0000-4000-8000-000000000108', trip, d0 + 2, '12:30', 'Lounas Rosswaldhütte', 'Pöytä varattu ryhmälle'),
    (fondue,                                 trip, d0 + 2, '20:30', 'Fondue-ilta', 'Lisäpalvelu, nouto hotellilta 20:15'),
    ('d0000000-0000-4000-8000-000000000110', trip, d0 + 4, '08:30', 'Bussi Zell am Seehen', 'Lähtö hotellin edestä'),
    ('d0000000-0000-4000-8000-000000000111', trip, d0 + 6, '16:30', 'Suksien palautus', 'Intersport Bründl'),
    ('d0000000-0000-4000-8000-000000000112', trip, d0 + 7, '06:15', 'Bussi lentokentälle', 'Lähtö hotellin edestä'),
    ('d0000000-0000-4000-8000-000000000113', trip, d0 + 7, '09:25', 'Lento Salzburg → Helsinki', 'AY1662');

  -- Paid extras: the fondue evening (already on the programme) and a sledging evening, which
  -- creates its own programme item through the extras trigger.
  insert into extras (id, trip_id, title, day, starts_at, price, programme_item_id, notes) values
    (fondue_extra, trip, 'Fondue-ilta', d0 + 2, '20:30', 39, fondue, 'Nouto hotellilta 20:15'),
    (rodel_extra,  trip, 'Ribs & Rodel -kelkkailu', d0 + 3, '19:00', 45, null, 'Kokoontuminen hotellin aulassa 18:45');

  -- The cash book's sample week, then one fondue booking paid in cash on the spot.
  insert into cash_books (trip_id, dest_number, department, responsible, opening_bank, opening_cash, opening_mobile)
  values (trip, '274', 'Talvi, Charter', 'Sanna Virtanen', 1200, 300, 0);
  insert into cash_entries (trip_id, kind, account, amount, entry_date, comment, programme_item_id, transfer_id, receipt) values
    (trip, 'cost_other',       'bankcard',  -86.40, d0,     'Tervetulotilaisuuden tarjoilut', welcome, null, true),
    (trip, 'cost_other',       'bankcard',  -23.90, d0,     'Puhelinliittymä, data', null, null, true),
    (trip, 'transfer',         'bank',     -500.00, d0 + 1, 'Käteisnosto', null, transfer, false),
    (trip, 'transfer',         'cash',      500.00, d0 + 1, 'Käteisnosto', null, transfer, false),
    (trip, 'cost_arrangement', 'cash',     -420.00, d0 + 1, 'Ennakkomaksu Hochalm', fondue, null, true),
    (trip, 'income_other',     'mobile',    480.00, d0 + 2, 'Tiroli-ilta, liput', null, null, false),
    (trip, 'income_other',     'cash',       64.00, d0 + 2, 'Tiroli-ilta, liput', null, null, false),
    (trip, 'cost_arrangement', 'bankcard', -312.50, d0 + 2, 'Bussikuljetus, Taxi Hinterglemm', fondue, null, false);
  insert into cash_entries (trip_id, kind, account, amount, entry_date, comment, programme_item_id)
  values (trip, 'income_arrangement', 'cash', 78, d0 + 2, 'Fondue-ilta: Erik och Anna Lindholm, 2 hlö', fondue)
  returning id into paid_entry;

  insert into extra_signups (extra_id, trip_id, member_id, persons, status, method, amount_paid, paid_at, cash_entry_id) values
    (fondue_extra, trip, leino,    2, 'unpaid',  null,   null, null,  null),
    (fondue_extra, trip, salonen,  1, 'prepaid', null,   null, null,  null),
    (fondue_extra, trip, lindholm, 2, 'paid',    'cash', 78,   now(), paid_entry),
    (rodel_extra,  trip, leino,    2, 'unpaid',  null,   null, null,  null),
    (rodel_extra,  trip, korhonen, 3, 'unpaid',  null,   null, null,  null);

  insert into answer_bank (trip_id, question, answer) values
    (trip, 'Milloin sauna on auki?', 'Hotellin saunaosasto on auki joka päivä klo 15–19. Pyyhkeet saat vastaanotosta.'),
    (trip, 'Mihin sukset jätetään yöksi?', 'Hotellin suksikellariin (pohjakerros, sisäänkäynti takaovelta). Huoneen avainkortti avaa oven, ja monolämmittimet ovat oikealla seinällä.'),
    (trip, 'Mikä on hotellin wifi-salasana?', 'Verkko on Bergkristall-Guest ja salasana on huoneen numero + sukunimi pienillä kirjaimilla, esim. 312leino.'),
    (trip, 'Mitä teen, jos hissikortti katoaa?', 'Ilmoita minulle chatissa heti. Sulkemme kortin ja saat uuden kassalta kuittia ja passia vastaan, 5 € panttimaksu.'),
    (trip, 'Missä on lähin apteekki?', 'Apotheke Saalbach, Dorfstraße 30, noin 5 min kävely. Auki ma–la 8–18.');

  insert into announcements (trip_id, title, body, author_name) values
    (trip, 'Huomisen ohjelma', 'Hyvää iltaa! Huomenna kokoonnutaan Zwölferkogelbahnin ala-asemalle klo 9.15. Lounaspöytä on varattu Rosswaldhüttestä klo 12.30. Muistakaa aurinkorasva, ylhäällä paistaa! – Sanna', 'Sanna Virtanen');

  -- Chat messages are written as their senders, because the message trigger takes the sender
  -- from the signed-in user. The claims are restored afterwards.
  perform set_config('request.jwt.claims', json_build_object('email', 'demo.asiakas@groupglide.com')::text, true);
  insert into messages (conversation_id, sender_role, sender_name, body) values
    (leino, 'traveller', '', 'Hei Sanna! Saako fondue-illan maksaa paikan päällä MobilePaylla?');
  perform set_config('request.jwt.claims', json_build_object('email', 'demo.opas@groupglide.com')::text, true);
  insert into messages (conversation_id, sender_role, sender_name, body) values
    (leino, 'guide', '', 'Hei! Onnistuu, maksun voi hoitaa illalla noutopaikalla MobilePaylla tai käteisellä. Nähdään klo 20.15 aulassa!');
  perform set_config('request.jwt.claims', json_build_object('email', 'lindholm.demo@example.com')::text, true);
  insert into messages (conversation_id, sender_role, sender_name, body) values
    (lindholm, 'traveller', '', 'Hej! Finns det möjlighet att hyra hjälm till barnen i skiduthyrningen?');
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);

  -- Spread the chat over the last day so it reads like a real conversation.
  update messages set created_at = now() - interval '20 hours' where conversation_id = leino and sender_role = 'traveller';
  update messages set created_at = now() - interval '19 hours' where conversation_id = leino and sender_role = 'guide';
  update messages set created_at = now() - interval '35 minutes' where conversation_id = lindholm;
  update announcements set created_at = now() - interval '15 hours' where trip_id = trip;
end $$;

-- Resets the demo trip when it is missing or was last reset before today (Europe/Vienna).
create or replace function public.ensure_demo_trip() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from trips
    where id = 'd0000000-0000-4000-8000-0000000000a1'
      and (created_at at time zone timezone)::date = (now() at time zone timezone)::date
  ) then
    perform reset_demo_trip();
  end if;
end $$;

revoke all on function public.reset_demo_trip() from public, anon, authenticated;
revoke all on function public.ensure_demo_trip() from public, anon, authenticated;
grant execute on function public.reset_demo_trip(), public.ensure_demo_trip() to service_role;
