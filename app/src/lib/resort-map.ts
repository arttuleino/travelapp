// Drawn resort maps for the Map tab: where the hotel, lifts, rental shop, lunch spot and ski bus
// stops are, and which programme items happen at each place. A demo for now: one resort,
// hand-placed on a panorama (not to scale). Later the operator would enter places per destination.
// Free of app imports so it can be unit tested with node.

export type PlaceKind = 'hotel' | 'lift' | 'rental' | 'food' | 'bus';

export type Place = {
  id: string;
  kind: PlaceKind;
  /** Shown name. The hotel's comes from the trip (trips.hotel_name) instead. */
  name: string;
  /** Pin position on the map drawing, in the map's own units (see ResortMap.width/height). */
  x: number;
  y: number;
  /** Lowercase, accent-free words that link programme items to this place (e.g. "zwolferkogel"). */
  keywords: string[];
  /** Short note per app language; Finnish is the fallback. */
  note: { fi: string } & Partial<Record<string, string>>;
  /** Google Maps search text. */
  query: string;
};

export type ResortMap = {
  id: string;
  /** Destination names this map is for (normalized, see normalizePlace). */
  names: string[];
  width: number;
  height: number;
  /** Order matters: the first place whose keyword appears in a programme item wins, so the hotel is last. */
  places: Place[];
};

const SKIBUS_NOTE = {
  fi: 'Skibussi kulkee kylien välillä. Ilmainen hissikortilla.',
  en: 'The ski bus runs between the villages. Free with a ski pass.',
  sv: 'Skidbussen går mellan byarna. Gratis med liftkort.',
  no: 'Skibussen går mellom landsbyene. Gratis med heiskort.',
};

const SAALBACH: ResortMap = {
  id: 'saalbach-hinterglemm',
  names: ['saalbach', 'hinterglemm'],
  width: 1000,
  height: 640,
  places: [
    {
      id: 'zwolferkogelbahn',
      kind: 'lift',
      name: 'Zwölferkogelbahn',
      x: 745,
      y: 528,
      keywords: ['zwolferkogel'],
      note: {
        fi: 'Hissi Hinterglemmistä Zwölferkogelille.',
        en: 'Lift from Hinterglemm up to Zwölferkogel.',
        sv: 'Lift från Hinterglemm upp till Zwölferkogel.',
        no: 'Heis fra Hinterglemm opp til Zwölferkogel.',
      },
      query: 'Zwölferkogelbahn Hinterglemm',
    },
    {
      id: 'schattberg',
      kind: 'lift',
      name: 'Schattberg X-press',
      x: 290,
      y: 528,
      keywords: ['schattberg'],
      note: {
        fi: 'Hissi Saalbachin keskustasta Schattbergille.',
        en: 'Lift from the centre of Saalbach up to Schattberg.',
        sv: 'Lift från Saalbachs centrum upp till Schattberg.',
        no: 'Heis fra sentrum av Saalbach opp til Schattberg.',
      },
      query: 'Schattberg X-press Saalbach',
    },
    {
      id: 'kohlmaisbahn',
      kind: 'lift',
      name: 'Kohlmaisbahn',
      x: 135,
      y: 522,
      keywords: ['kohlmais'],
      note: {
        fi: 'Hissi Saalbachista Kohlmaisille.',
        en: 'Lift from Saalbach up to Kohlmais.',
        sv: 'Lift från Saalbach upp till Kohlmais.',
        no: 'Heis fra Saalbach opp til Kohlmais.',
      },
      query: 'Kohlmaisbahn Saalbach',
    },
    {
      id: 'rosswald',
      kind: 'food',
      name: 'Rosswaldhütte',
      x: 660,
      y: 330,
      keywords: ['rosswald'],
      note: { fi: 'Rinneravintola.', en: 'Mountain restaurant.', sv: 'Bergrestaurang.', no: 'Fjellrestaurant.' },
      query: 'Rosswaldhütte Saalbach-Hinterglemm',
    },
    {
      id: 'brundl',
      kind: 'rental',
      name: 'Intersport Bründl',
      x: 246,
      y: 600,
      keywords: ['brundl', 'intersport'],
      note: {
        fi: 'Suksien ja monojen vuokraus.',
        en: 'Ski and boot rental.',
        sv: 'Uthyrning av skidor och pjäxor.',
        no: 'Utleie av ski og skistøvler.',
      },
      query: 'Intersport Bründl Saalbach',
    },
    {
      id: 'skibus-hinterglemm',
      kind: 'bus',
      name: 'Skibus Hinterglemm',
      x: 820,
      y: 580,
      keywords: ['skibus hinterglemm', 'skibussi hinterglemm'],
      note: SKIBUS_NOTE,
      query: 'Skibus Hinterglemm',
    },
    {
      id: 'skibus-saalbach',
      kind: 'bus',
      name: 'Skibus Saalbach',
      x: 370,
      y: 584,
      keywords: ['skibus', 'ski bus'],
      note: SKIBUS_NOTE,
      query: 'Skibus Saalbach Zentrum',
    },
    {
      id: 'hotel',
      kind: 'hotel',
      name: '',
      x: 190,
      y: 566,
      keywords: ['hotel', 'aula', 'lobby'],
      note: { fi: '' },
      query: '',
    },
  ],
};

const MAPS: ResortMap[] = [SAALBACH];

/** Lowercase, accents removed, punctuation to spaces: 'Zwölferkogelbahnin' → 'zwolferkogelbahnin'. */
export const normalizePlace = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The drawn map for a destination, or null when there is none yet. */
export function mapFor(destination: string | null | undefined): ResortMap | null {
  const d = normalizePlace(destination ?? '');
  if (!d) return null;
  return MAPS.find((m) => m.names.some((n) => d.includes(n))) ?? null;
}

/** The place a programme item happens at, judged from its title and details; `hotelName` adds the hotel's own name. */
export function placeFor(map: ResortMap, text: string, hotelName?: string | null): Place | null {
  const t = normalizePlace(text);
  if (!t) return null;
  const hotelWords = hotelName ? [normalizePlace(hotelName).replace(/^hotel\s+/, '')].filter(Boolean) : [];
  return (
    map.places.find((p) => p.keywords.some((k) => t.includes(k)) || (p.kind === 'hotel' && hotelWords.some((w) => t.includes(w)))) ??
    null
  );
}

/** The place's note in `lang`, else Finnish. */
export const noteIn = (place: Place, lang: string) => place.note[lang] ?? place.note.fi;
