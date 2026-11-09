// Minimal RFC 4180 CSV parser (quoted fields, "" escapes, commas/newlines inside quotes).
// Also accepts semicolons, which Finnish Excel uses by default.

export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r, i) => {
    const obj = { _line: i + 2 };
    header.forEach((h, j) => { obj[h] = (r[j] ?? '').trim(); });
    return obj;
  });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts 2027-02-15 or Finnish 15.2.2027. */
export function toIsoDate(s) {
  if (DATE.test(s)) return s;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Accepts 09:15, 9:15 or 9.15. */
export function toTime(s) {
  const t = s.replace('.', ':').replace(/^(\d):/, '0$1:');
  return TIME.test(t) ? t.slice(0, 5) : null;
}

/** Validates and normalises the files. flights.csv is optional. Returns { trip, members, programme, flights, errors }. */
export function validateTrip(tripRows, memberRows, programmeRows, flightRows = []) {
  const errors = [];
  const err = (file, line, msg) => errors.push(`${file} rivi ${line}: ${msg}`);

  if (tripRows.length !== 1) errors.push(`trip.csv: pitää olla täsmälleen yksi matkarivi (nyt ${tripRows.length})`);
  const t = tripRows[0] ?? { _line: 2 };
  const trip = {
    external_ref: t.external_ref,
    name: t.name,
    destination: t.destination,
    country: t.country || null,
    starts_on: toIsoDate(t.starts_on ?? ''),
    ends_on: toIsoDate(t.ends_on ?? ''),
    timezone: t.timezone || 'Europe/Vienna',
    hotel_name: t.hotel_name || null,
    hotel_stars: t.hotel_stars ? Number(t.hotel_stars) : null,
    hotel_address: t.hotel_address || null,
    hotel_phone: t.hotel_phone || null,
    hotel_lift_distance: t.hotel_lift_distance || null,
    check_in_time: t.check_in_time ? toTime(t.check_in_time) : null,
    check_out_time: t.check_out_time ? toTime(t.check_out_time) : null,
  };
  if (trip.hotel_stars !== null && !(Number.isInteger(trip.hotel_stars) && trip.hotel_stars >= 1 && trip.hotel_stars <= 5))
    err('trip.csv', t._line, `hotel_stars pitää olla 1–5, ei "${t.hotel_stars}"`);
  for (const k of ['check_in_time', 'check_out_time']) if (t[k] && !trip[k]) err('trip.csv', t._line, `${k} ei ole kellonaika: "${t[k]}"`);
  for (const k of ['external_ref', 'name', 'destination']) if (!trip[k]) err('trip.csv', t._line, `${k} puuttuu`);
  if (!trip.starts_on) err('trip.csv', t._line, `starts_on ei ole päivämäärä: "${t.starts_on ?? ''}"`);
  if (!trip.ends_on) err('trip.csv', t._line, `ends_on ei ole päivämäärä: "${t.ends_on ?? ''}"`);
  if (trip.starts_on && trip.ends_on && trip.ends_on < trip.starts_on) err('trip.csv', t._line, 'ends_on on ennen starts_on-päivää');

  const seen = new Set();
  const members = memberRows.map((r) => {
    const email = (r.email ?? '').toLowerCase();
    const role = (r.role || 'traveller').toLowerCase();
    const party = r.party_size ? Number(r.party_size) : 1;
    if (!EMAIL.test(email)) err('members.csv', r._line, `virheellinen sähköposti "${r.email ?? ''}"`);
    if (seen.has(email)) err('members.csv', r._line, `sähköposti ${email} on jo listalla`);
    seen.add(email);
    if (!['traveller', 'guide'].includes(role)) err('members.csv', r._line, `role pitää olla traveller tai guide, ei "${r.role}"`);
    if (!r.display_name) err('members.csv', r._line, 'display_name puuttuu');
    if (!Number.isInteger(party) || party < 1) err('members.csv', r._line, `party_size ei ole positiivinen kokonaisluku: "${r.party_size}"`);
    // Booking market (FI, SE or NO): decides which customer service the traveller sees.
    const market = (r.market ?? '').trim().toUpperCase() || null;
    if (market && !['FI', 'SE', 'NO'].includes(market)) err('members.csv', r._line, `market pitää olla FI, SE tai NO, ei "${r.market}"`);
    return {
      email, role, display_name: r.display_name, booking_ref: r.booking_ref || null,
      party_size: party, room: r.room || null, phone: r.phone || null, market, room_type: r.room_type || null,
    };
  });
  if (!members.some((m) => m.role === 'guide')) errors.push('members.csv: matkalla ei ole yhtään opasta (role = guide)');

  const programme = programmeRows.map((r) => {
    const day = toIsoDate(r.day ?? '');
    const starts_at = toTime(r.starts_at ?? '');
    if (!day) err('programme.csv', r._line, `day ei ole päivämäärä: "${r.day ?? ''}"`);
    else if (trip.starts_on && trip.ends_on && (day < trip.starts_on || day > trip.ends_on)) err('programme.csv', r._line, `${day} ei ole matkan aikana`);
    if (!starts_at) err('programme.csv', r._line, `starts_at ei ole kellonaika: "${r.starts_at ?? ''}"`);
    if (!r.title) err('programme.csv', r._line, 'title puuttuu');
    return { day, starts_at, title: r.title, details: r.details ?? '' };
  });

  const flights = flightRows.map((r) => {
    const direction = (r.direction ?? '').trim().toLowerCase();
    const flight_date = toIsoDate(r.flight_date ?? '');
    const dep_time = toTime(r.dep_time ?? '');
    const arr_time = toTime(r.arr_time ?? '');
    if (!['out', 'return'].includes(direction)) err('flights.csv', r._line, `direction pitää olla out tai return, ei "${r.direction ?? ''}"`);
    if (!flight_date) err('flights.csv', r._line, `flight_date ei ole päivämäärä: "${r.flight_date ?? ''}"`);
    if (!dep_time) err('flights.csv', r._line, `dep_time ei ole kellonaika: "${r.dep_time ?? ''}"`);
    if (!arr_time) err('flights.csv', r._line, `arr_time ei ole kellonaika: "${r.arr_time ?? ''}"`);
    for (const k of ['flight_no', 'dep_code', 'arr_code']) if (!r[k]) err('flights.csv', r._line, `${k} puuttuu`);
    return {
      direction, flight_date, flight_no: r.flight_no, airline: r.airline || null,
      dep_code: (r.dep_code ?? '').toUpperCase(), dep_city: r.dep_city || null, dep_time,
      arr_code: (r.arr_code ?? '').toUpperCase(), arr_city: r.arr_city || null, arr_time,
      terminal: r.terminal || null, baggage: r.baggage || null, transfer: r.transfer || null,
    };
  });

  return { trip, members, programme, flights, errors };
}
