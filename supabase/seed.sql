-- Sample trip for local development (the Saalbach week from the prototype).
-- Sign in as guide@example.com (guide) or traveller@example.com (traveller);
-- the sign-in code arrives in the local mail inbox at http://127.0.0.1:54324.
insert into public.operators (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Demo-matkanjärjestäjä', 'demo');

insert into public.trips (id, operator_id, external_ref, name, destination, country, starts_on, ends_on, timezone, hotel_name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'SA-07-2027',
   'Hiihtomatka Saalbach-Hinterglemm', 'Saalbach-Hinterglemm', 'Itävalta', '2027-02-13', '2027-02-20', 'Europe/Vienna', 'Hotel Bergkristall');

insert into public.trip_members (trip_id, email, role, display_name, booking_ref, party_size, room, phone) values
  ('00000000-0000-0000-0000-0000000000a1', 'guide@example.com', 'guide', 'Sanna Virtanen', null, 1, null, '+43 664 123 4567'),
  ('00000000-0000-0000-0000-0000000000a1', 'traveller@example.com', 'traveller', 'Arttu ja Emma Leino', 'AM-274913', 2, '312', '+358 40 123 4567'),
  ('00000000-0000-0000-0000-0000000000a1', 'mikko@example.com', 'traveller', 'Mikko Salonen', 'AM-274920', 1, '214', '+358 50 234 5678');

insert into public.programme_items (trip_id, day, starts_at, title, details) values
  ('00000000-0000-0000-0000-0000000000a1','2027-02-13','06:45','Lento Helsinki → Salzburg','AY1661, terminaali 2'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-13','09:15','Bussikuljetus hotelliin','Noin 1 h 30 min. Opas mukana bussissa.'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-13','18:00','Tervetulotilaisuus','Hotellin aula. Hissikortit ja suksivuokran sovitus.'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-14','08:30','Suksivuokraamon nouto','Intersport Bründl, 2 min hotellilta'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-14','09:30','Tutustumislasku oppaan kanssa','Kokoontuminen Schattberg X-pressin ala-asemalla'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-15','08:45','Aamun lumikatsaus chatissa','Opas lähettää päivän rinneolosuhteet'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-15','09:15','Opastettu lasku: Zwölferkogel','Kokoontuminen Zwölferkogelbahnin ala-asemalla'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-15','12:30','Lounas Rosswaldhütte','Pöytä varattu ryhmälle'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-15','20:30','Fondue-ilta','Lisäpalvelu, nouto hotellilta 20:15'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-17','08:30','Bussi Zell am Seehen','Lähtö hotellin edestä'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-19','16:30','Suksien palautus','Intersport Bründl'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-20','06:15','Bussi lentokentälle','Lähtö hotellin edestä'),
  ('00000000-0000-0000-0000-0000000000a1','2027-02-20','09:25','Lento Salzburg → Helsinki','AY1662');
