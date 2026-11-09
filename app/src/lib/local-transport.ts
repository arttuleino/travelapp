// Which local public transport app to recommend at each destination, instead of showing
// timetables in the app. Checked against the operators' and resorts' own pages in November 2026;
// review once a season (apps and ski bus rules change).
// Free of app imports so it can be unit tested with node.

export type TransportApp = {
  name: string;
  ios: string;
  android: string;
};

export type LocalTransport = {
  /** Region shown to the traveller, e.g. 'Salzburgin osavaltio' is not needed: the app name says it. */
  app: TransportApp | null;
  /** Ski bus or resort shuttle timetable page. */
  skibusUrl?: string;
  /** True when the resort says the ski bus is free with a ski pass (or free for everyone). */
  skibusFree?: boolean;
};

const playSearch = (q: string) => `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`;

const APPS = {
  salzburg: {
    name: 'Salzburg Verkehr',
    ios: 'https://apps.apple.com/app/id484532993',
    android: 'https://play.google.com/store/apps/details?id=de.hafas.android.svv',
  },
  tirol: {
    name: 'VVT SmartRide',
    ios: 'https://apps.apple.com/app/id459714443',
    android: 'https://play.google.com/store/apps/details?id=de.hafas.android.vvt',
  },
  vorarlberg: {
    name: 'cleVVVer mobil',
    ios: 'https://apps.apple.com/app/id533107345',
    android: 'https://play.google.com/store/apps/details?id=de.hafas.android.vvv',
  },
  steiermark: { name: 'BusBahnBim', ios: 'https://apps.apple.com/app/id489482120', android: playSearch('BusBahnBim') },
  aosta: {
    name: '#vdatransports',
    ios: 'https://apps.apple.com/app/id6451254773',
    android: 'https://play.google.com/store/apps/details?id=com.kentkart.aosta',
  },
  suedtirol: {
    name: 'südtirolmobil',
    ios: 'https://apps.apple.com/app/id883614138',
    android: 'https://play.google.com/store/apps/details?id=it.bz.provincia.altoadigetogo.android',
  },
  trentino: { name: 'Mio Trentino', ios: 'https://apps.apple.com/app/id1562347395', android: playSearch('Mio Trentino') },
  zenbus: { name: 'Zenbus', ios: 'https://apps.apple.com/app/id808231328', android: playSearch('Zenbus') },
} satisfies Record<string, TransportApp>;

/** STS Alppimatkat's destinations (alppimatkat.fi). The first matching name wins. */
const DESTINATIONS: { names: string[]; info: LocalTransport }[] = [
  { names: ['saalbach', 'hinterglemm'], info: { app: APPS.salzburg, skibusUrl: 'https://www.saalbach.com/en/service/info/skibus', skibusFree: true } },
  { names: ['zell am see', 'kaprun', 'gastein'], info: { app: APPS.salzburg } },
  { names: ['mayrhofen', 'zillertal', 'solden', 'obergurgl', 'otztal', 'st anton', 'ischgl'], info: { app: APPS.tirol } },
  { names: ['lech', 'zurs'], info: { app: APPS.vorarlberg, skibusFree: true } },
  { names: ['schladming'], info: { app: APPS.steiermark } },
  { names: ['cervinia', 'courmayeur', 'champoluc'], info: { app: APPS.aosta } },
  { names: ['val gardena', 'groden', 'selva', 'ortisei', 'santa cristina'], info: { app: APPS.suedtirol } },
  { names: ['canazei', 'val di fassa'], info: { app: APPS.trentino } },
  { names: ['val thorens', 'les menuires', 'belleville'], info: { app: APPS.zenbus, skibusUrl: 'https://www.valthorens.com/en/?p=714', skibusFree: true } },
  {
    names: ['sauze'],
    info: {
      app: null,
      skibusUrl:
        'https://www.comune.sauzedoulx.to.it/it-it/servizi/mobilita-e-trasporti/trasporto-urbano-extraurbano-308-24981-1-44f319bb4f8fbc83c17980cb0462b6f2',
    },
  },
];

/** Lowercase, accents removed, punctuation to spaces: 'Sölden' → 'solden', 'St. Anton' → 'st anton'. */
export const normalizePlace = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The local transport advice for a trip's destination, or null if we have none. */
export function localTransportFor(destination: string): LocalTransport | null {
  const place = ` ${normalizePlace(destination)} `;
  return DESTINATIONS.find((d) => d.names.some((n) => place.includes(` ${n} `) || place.includes(` ${n}`)))?.info ?? null;
}
