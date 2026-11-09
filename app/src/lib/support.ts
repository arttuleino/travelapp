// The operator's customer service per booking market. STS Alppimatkat (FI), STS Alpresor (SE) and
// STS Alpereiser (NO) share one office in Gothenburg but publish their own phone numbers and hours.
// Checked on alppimatkat.fi, alpresor.se and alpereiser.no in November 2026.
// Free of app imports so it can be unit tested with node.

export type Market = 'FI' | 'SE' | 'NO';

export type CustomerService = {
  brand: string;
  phone: string; // as dialled from abroad
  phoneLocal: string; // as printed on the website
  email: string;
  contactUrl: string;
  timeZone: string;
  /** Phone hours on weekdays (Mon–Fri), office local time, e.g. [['10:00', '13:00'], ['15:00', '17:00']]. */
  weekdayHours: [string, string][];
};

export const CUSTOMER_SERVICE: Record<Market, CustomerService> = {
  FI: {
    brand: 'STS Alppimatkat',
    phone: '+3589671314',
    phoneLocal: '09 67 13 14',
    email: 'info@alppimatkat.fi',
    contactUrl: 'https://www.alppimatkat.fi/lisaa-meista/ota-yhteytta/',
    timeZone: 'Europe/Helsinki',
    weekdayHours: [
      ['10:00', '13:00'],
      ['15:00', '17:00'],
    ],
  },
  SE: {
    brand: 'STS Alpresor',
    phone: '+46771202020',
    phoneLocal: '0771-20 20 20',
    email: 'info@alpresor.se',
    contactUrl: 'https://www.alpresor.se/om-oss/kontakta-oss/',
    timeZone: 'Europe/Stockholm',
    weekdayHours: [
      ['09:00', '12:00'],
      ['14:00', '16:00'],
    ],
  },
  NO: {
    brand: 'STS Alpereiser',
    phone: '+4721314900',
    phoneLocal: '21 31 49 00',
    email: 'info@alpereiser.no',
    contactUrl: 'https://www.alpereiser.no/om-oss/kontakt-oss/',
    timeZone: 'Europe/Oslo',
    weekdayHours: [
      ['09:00', '12:00'],
      ['14:00', '16:00'],
    ],
  },
};

/** The booking's market, or a guess from the app language when the booking data has none. */
export function marketFor(market: string | null | undefined, lang: string): Market {
  if (market === 'FI' || market === 'SE' || market === 'NO') return market;
  return lang === 'sv' ? 'SE' : lang === 'no' ? 'NO' : 'FI';
}

/** '10–13 & 15–17' */
const short = (hm: string) => hm.replace(/^0/, '').replace(/:00$/, '');
export const hoursText = (s: CustomerService) => s.weekdayHours.map(([a, b]) => `${short(a)}–${short(b)}`).join(' & ');

/** Whether the phone line is open at `now`, in the office's own time zone. */
export function isOpen(s: CustomerService, now: Date): boolean {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: s.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false;
  const hm = `${parts.hour}:${parts.minute}`;
  return s.weekdayHours.some(([a, b]) => hm >= a && hm < b);
}
