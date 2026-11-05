// Time helpers. Programme times are wall-clock times at the destination, so "now"
// is always computed in the trip's own time zone, never the phone's.

export type Clock = { date: string; time: string }; // 'YYYY-MM-DD', 'HH:MM'

const WEEKDAYS_FI = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

/** Current date and time in `timeZone`. `override` ('YYYY-MM-DDTHH:MM') pins the clock for demos and tests. */
export function tripClock(timeZone: string, now: Date = new Date(), override?: string): Clock {
  if (override) {
    const [date, time = '00:00'] = override.split('T');
    return { date, time: time.slice(0, 5) };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Postgres `time` comes back as 'HH:MM:SS'; the app shows 'HH:MM'. */
export const hhmm = (t: string) => t.slice(0, 5);

/** Index of the item in progress at `time` (the last one that has started), or -1 before the first. Items must be sorted. */
export function currentIndex(items: { starts_at: string }[], time: string): number {
  let idx = -1;
  items.forEach((it, i) => {
    if (hhmm(it.starts_at) <= time) idx = i;
  });
  return idx;
}

/** All dates of a trip, inclusive. */
export function tripDays(startsOn: string, endsOn: string): string[] {
  const out: string[] = [];
  const d = new Date(`${startsOn}T00:00:00Z`);
  const end = new Date(`${endsOn}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** 'ma 15.2.' */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS_FI[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** '13.–20.2.2027', '27.2.–6.3.2027' or '28.12.2026–4.1.2027' */
export function formatRange(startsOn: string, endsOn: string): string {
  const [y1, m1, d1] = startsOn.split('-').map(Number);
  const [y2, m2, d2] = endsOn.split('-').map(Number);
  if (y1 !== y2) return `${d1}.${m1}.${y1}–${d2}.${m2}.${y2}`;
  if (m1 !== m2) return `${d1}.${m1}.–${d2}.${m2}.${y2}`;
  return `${d1}.–${d2}.${m2}.${y2}`;
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Accepts '9:15', '0915', '9.15' and returns '09:15', or null. */
export function normalizeTime(input: string): string | null {
  const s = input.trim().replace('.', ':');
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s);
  if (!m) return null;
  const t = `${m[1].padStart(2, '0')}:${m[2]}`;
  return isValidTime(t) ? t : null;
}

/** Which trip to open when a person has several: the one in progress, else the next one, else the latest. */
export function pickActiveTrip<T extends { starts_on: string; ends_on: string }>(trips: T[], today: string): T | null {
  if (!trips.length) return null;
  const ongoing = trips.find((t) => t.starts_on <= today && today <= t.ends_on);
  if (ongoing) return ongoing;
  const upcoming = trips.filter((t) => t.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (upcoming.length) return upcoming[0];
  return [...trips].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
}

/** Adds whole days to a 'YYYY-MM-DD' date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The instant (ISO, UTC) when the wall clock in `timeZone` shows `date` `time` ('YYYY-MM-DD', 'HH:MM'). */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): string {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let guess = wanted;
  // Two rounds settle the offset, including on daylight saving days.
  for (let i = 0; i < 2; i++) {
    const shown = tripClock(timeZone, new Date(guess));
    guess += wanted - Date.parse(`${shown.date}T${shown.time}:00Z`);
  }
  return new Date(guess).toISOString();
}
