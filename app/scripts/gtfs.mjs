// Helpers for reading GTFS timetable data (https://gtfs.org/schedule/reference/).
// Kept free of I/O so they can be unit tested.

/** Splits one CSV line (GTFS uses commas and "" escapes; fields never span lines in practice). */
export function parseCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(field);
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  out.push(field);
  return out;
}

/** Turns a header line into a function that maps a data line to an object. */
export function rowReader(headerLine) {
  const header = parseCsvLine(headerLine.replace(/^﻿/, '')).map((h) => h.trim());
  return (line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    header.forEach((h, i) => (obj[h] = (cells[i] ?? '').trim()));
    return obj;
  };
}

/** Great-circle distance in metres. */
export function distanceM(lat1, lon1, lat2, lon2) {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

const ymd = (gtfsDate) => `${gtfsDate.slice(0, 4)}-${gtfsDate.slice(4, 6)}-${gtfsDate.slice(6, 8)}`;

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const WEEKDAY_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * The dates (within `dates`) on which each service runs, from calendar.txt rows and
 * calendar_dates.txt exceptions (1 = added, 2 = removed).
 * @returns Map<service_id, Set<'YYYY-MM-DD'>>
 */
export function serviceDates(calendar, calendarDates, dates) {
  const wanted = new Set(dates);
  const out = new Map();
  const add = (id, d) => {
    if (!out.has(id)) out.set(id, new Set());
    out.get(id).add(d);
  };
  for (const c of calendar) {
    const start = ymd(c.start_date);
    const end = ymd(c.end_date);
    for (const d of dates) if (d >= start && d <= end && c[WEEKDAY_COLUMNS[weekday(d)]] === '1') add(c.service_id, d);
  }
  for (const x of calendarDates) {
    const d = ymd(x.date);
    if (!wanted.has(d)) continue;
    if (x.exception_type === '1') add(x.service_id, d);
    else if (x.exception_type === '2') out.get(x.service_id)?.delete(d);
  }
  return out;
}

/** The first and last date any service runs (to know which trip days the feed covers). */
export function feedRange(calendar, calendarDates) {
  const all = [...calendar.flatMap((c) => [c.start_date, c.end_date]), ...calendarDates.filter((x) => x.exception_type === '1').map((x) => x.date)]
    .filter(Boolean)
    .sort();
  return all.length ? { start: ymd(all[0]), end: ymd(all[all.length - 1]) } : null;
}

/**
 * Trip days the feed does not cover are filled from the same weekday of the feed's last full week,
 * e.g. when next season's timetable has not been published yet.
 * @returns Map<tripDay, sourceDay>
 */
export function projectDates(tripDates, range) {
  const out = new Map();
  for (const d of tripDates) {
    if (!range || (d >= range.start && d <= range.end)) out.set(d, d);
    else if (range && d > range.end) {
      let src = range.end;
      while (weekday(src) !== weekday(d)) src = addDays(src, -1);
      out.set(d, src);
    } else {
      let src = range.start;
      while (weekday(src) !== weekday(d)) src = addDays(src, 1);
      out.set(d, src);
    }
  }
  return out;
}

/** GTFS times can pass midnight ('25:10:00' = 01:10 next day). Returns the real date and time. */
export function resolveTime(serviceDate, gtfsTime) {
  const [h, m, s] = gtfsTime.split(':').map(Number);
  const extraDays = Math.floor(h / 24);
  const hh = String(h % 24).padStart(2, '0');
  return { date: addDays(serviceDate, extraDays), time: `${hh}:${String(m).padStart(2, '0')}:${String(s ?? 0).padStart(2, '0')}` };
}
