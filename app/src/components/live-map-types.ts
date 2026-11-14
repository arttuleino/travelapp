import type { Freshness } from '@/lib/guide-location';
import type { ServiceKind } from '@/lib/osm-services';
import type { Place, ResortMap } from '@/lib/resort-map';

export type MapGuide = {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  initials: string;
  state: Freshness;
  /** Tooltip / screen reader text, e.g. "Opas Sanna, 2 min sitten". */
  label: string;
};

export type MapBase = 'map' | 'terrain';

export type LiveMapProps = {
  map: ResortMap;
  height: number;
  selectedId: string | null;
  /** The place of the next programme item: gets a yellow ring and a time label. */
  next: { placeId: string; label: string } | null;
  nameOf: (p: Place) => string;
  labelOf: (p: Place) => string;
  onSelect: (p: Place) => void;
  guides: MapGuide[];
  /** The viewer's own position (never sent anywhere). */
  me: { lat: number; lng: number; accuracy: number | null } | null;
  /** Move the map here; a new `key` moves it again to the same spot. */
  focus: { lat: number; lng: number; zoom?: number; key: number } | null;
  /** Show every place again; a new value re-fits. */
  fitKey: number;
  base: MapBase;
  pistes: boolean;
  /** Mouse wheel zoom (desktop); on phones the page scrolls instead. */
  wheelZoom: boolean;
  /** Other services around the resort from OpenStreetMap (browser only). */
  services: boolean;
  serviceLabel: (kind: ServiceKind) => string;
  openMapsLabel: string;
  /** Extra link on bus stops, e.g. the resort's ski bus timetable. */
  busTimetable?: { label: string; url: string } | null;
  /** Called when the services could not be loaded (true) or loaded again (false). */
  onServicesFailed?: (failed: boolean) => void;
};
