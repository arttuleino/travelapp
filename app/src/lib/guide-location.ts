// Guide live location: the row shape and the small rules around it (when to send a new
// position, how fresh a shown position is). Free of app imports so it can be unit tested with node.

export type GuideLocation = {
  member_id: string;
  trip_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  guide_name: string;
  updated_at: string;
};

export type LatLng = { lat: number; lng: number };

/** Distance in metres between two points (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** At most one update this often while moving. */
export const SEND_MIN_MS = 15_000;
/** Movement smaller than this is GPS noise, not worth an update. */
export const SEND_MIN_MOVE_M = 15;
/** Standing still, still send now and then so travellers see the position is live. */
export const SEND_HEARTBEAT_MS = 60_000;

/** Whether the guide's phone should send `next` now, given the last sent position and time. */
export function shouldSend(last: (LatLng & { at: number }) | null, next: LatLng, now: number): boolean {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed >= SEND_HEARTBEAT_MS) return true;
  return elapsed >= SEND_MIN_MS && distanceM(last, next) >= SEND_MIN_MOVE_M;
}

export type Freshness = 'live' | 'recent' | 'old';

/** Live: updated in the last 3 minutes. Recent: within 30 min. Old: within 12 h. Older: hidden (null). */
export function freshness(updatedAt: string, now: number): { state: Freshness; minutes: number } | null {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return null;
  const minutes = Math.max(0, Math.floor((now - t) / 60_000));
  if (minutes < 3) return { state: 'live', minutes };
  if (minutes < 30) return { state: 'recent', minutes };
  if (minutes < 12 * 60) return { state: 'old', minutes };
  return null;
}

/** Initials for the guide's map marker: "Sanna Virtanen" -> "SV". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
