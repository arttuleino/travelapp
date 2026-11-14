// Other services on the Map tab (restaurants, huts, rental, ski schools, pharmacies, ATMs, bus stops), fetched
// from OpenStreetMap through the Overpass API around the resort, so every destination gets them
// without manual work. Free of app imports so it can be unit tested with node.

type LatLng = { lat: number; lng: number };

/** Short distances in metres (flat-earth approximation, fine below a few km). */
const nearM = (a: LatLng, b: LatLng) => {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, b.lat - a.lat) * 111_320;
};

export type ServiceKind = 'hut' | 'food' | 'rental' | 'school' | 'health' | 'atm' | 'bus';

export type Service = { id: string; kind: ServiceKind; name: string; lat: number; lng: number };

export type Bbox = { south: number; west: number; north: number; east: number };

/** The places' bounding box widened by `padM` metres on every side. */
export function bboxAround(points: LatLng[], padM = 1500): Bbox {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const dLat = padM / 111_320;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLng = padM / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return { south: Math.min(...lats) - dLat, west: Math.min(...lngs) - dLng, north: Math.max(...lats) + dLat, east: Math.max(...lngs) + dLng };
}

export function overpassQuery(b: Bbox): string {
  const box = [b.south, b.west, b.north, b.east].map((n) => n.toFixed(4)).join(',');
  return `[out:json][timeout:25];
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|biergarten|fast_food|pharmacy|doctors|clinic|atm|ski_rental|ski_school)$"]["name"](${box});
  nwr["tourism"="alpine_hut"]["name"](${box});
  nwr["shop"~"^(ski|sports)$"]["name"](${box});
  node["highway"="bus_stop"]["name"](${box});
);
out center tags;`;
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const HUT_WORDS = /(h(ü|u)tte|alm|alpe|hut)\b/i;

/** Which kind of service an OpenStreetMap object is, or null for anything else. */
export function kindOf(tags: Record<string, string>): ServiceKind | null {
  const a = tags.amenity;
  if (tags.tourism === 'alpine_hut') return 'hut';
  if (a && /^(restaurant|cafe|bar|pub|biergarten|fast_food)$/.test(a)) return HUT_WORDS.test(tags.name ?? '') ? 'hut' : 'food';
  if (a === 'ski_rental' || tags.shop === 'ski' || tags.shop === 'sports') return 'rental';
  if (a === 'ski_school') return 'school';
  if (a === 'pharmacy' || a === 'doctors' || a === 'clinic') return 'health';
  if (a === 'atm') return 'atm';
  if (tags.highway === 'bus_stop') return 'bus';
  return null;
}

/**
 * Overpass answer -> services, leaving out anything within `skipM` of a place that is already
 * pinned on the map (the programme's own hotel, lifts, restaurants...).
 */
export function parseServices(json: { elements?: OsmElement[] }, pinned: LatLng[] = [], skipM = 40): Service[] {
  const out: Service[] = [];
  for (const e of json.elements ?? []) {
    const tags = e.tags ?? {};
    const name = tags.name?.trim();
    const kind = kindOf(tags);
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!name || !kind || lat == null || lng == null) continue;
    const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    if (pinned.some((q) => nearM(p, q) < skipM)) continue;
    // A bus stop usually has one pole per direction with the same name: keep one.
    if (kind === 'bus' && out.some((o) => o.kind === 'bus' && o.name === name && nearM(o, p) < 100)) continue;
    out.push({ id: `${e.type[0]}${e.id}`, kind, name, ...p });
  }
  return out;
}
