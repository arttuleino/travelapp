// @ts-expect-error CSS import, bundled by Metro on web
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { iconSvg, type IconName } from '@/components/icon';
import type { LiveMapProps } from '@/components/live-map-types';
import { KIND_STYLE } from '@/components/ski-map';
import { bboxAround, overpassQuery, parseServices, type Service, type ServiceKind } from '@/lib/osm-services';
import type { Place, ResortMap } from '@/lib/resort-map';

/**
 * Browser: a real map (OpenStreetMap data) with the OpenSnowMap piste and lift layer on top,
 * pins for the trip's places, the guide's live position and, if asked, the viewer's own.
 *
 * Tile servers can be swapped with EXPO_PUBLIC_MAP_TILES / EXPO_PUBLIC_MAP_TILES_ATTRIBUTION
 * (e.g. a paid MapTiler or Stadia key once traffic grows). The default OpenStreetMap tiles need no key
 * but are meant for light use, with attribution (operations.osmfoundation.org/policies/tiles).
 */
const BASES = {
  map: {
    url: process.env.EXPO_PUBLIC_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      process.env.EXPO_PUBLIC_MAP_TILES_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxNativeZoom: 17,
  },
} as const;
const PISTES = {
  url: 'https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png',
  attribution: 'Rinteet &copy; <a href="https://www.opensnowmap.org">OpenSnowMap</a> (CC-BY-SA)',
};

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const SERVICES_TTL_MS = 7 * 24 * 3600_000;
/** Mountain huts show when the whole resort is in view; village services (dozens) from this zoom up. */
const SERVICES_MIN_ZOOM = 14;
const SERVICE_STYLE: Record<ServiceKind, { color: string; icon: IconName }> = {
  hut: { color: '#D9661A', icon: 'food' },
  food: { color: '#8A6A3B', icon: 'food' },
  rental: { color: '#7B4FD0', icon: 'ski' },
  school: { color: '#2F6FDE', icon: 'users' },
  health: { color: '#C62828', icon: 'plus' },
  atm: { color: '#1F7A3E', icon: 'euro' },
  bus: { color: '#1F8A7A', icon: 'bus' },
};

/** Services around the resort, from this browser's cache (a week) or from OpenStreetMap. */
async function loadServices(map: ResortMap): Promise<Service[]> {
  const key = `groupglide.services.v2.${map.id}`;
  try {
    const cached = JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null') as { at: number; items: Service[] } | null;
    if (cached?.items?.length && Date.now() - cached.at < SERVICES_TTL_MS) return cached.items;
  } catch {
    // No storage: fetch every time.
  }
  const query = overpassQuery(bboxAround(map.places));
  for (const url of OVERPASS) {
    // A busy server can hold the request for a long time: give up on it after 20 s.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20_000);
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: abort.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: unknown[]; remark?: string };
      // Overpass reports timeouts and overload as a 200 answer with a remark and no elements.
      if (!json.elements?.length) throw new Error(json.remark || 'no elements');
      const items = parseServices(json as Parameters<typeof parseServices>[0], map.places);
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify({ at: Date.now(), items }));
      } catch {
        // Storage full or blocked: fine, just not cached.
      }
      return items;
    } catch (e) {
      console.warn(`Palvelut: ${url} epäonnistui`, e);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('services unavailable');
}

const CSS = `
.gg-pin{display:flex;align-items:center;justify-content:center;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);box-sizing:border-box;cursor:pointer;transition:transform .15s}
.gg-pin.sel{border-width:3px;transform:scale(1.18)}
.gg-pin.next{border-color:#FFE76A;border-width:3px}
.gg-tag{background:#16160F;color:#fff;font:700 12px Figtree,system-ui,sans-serif;padding:3px 8px;border-radius:999px;border:0;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap}
.gg-tag:before{display:none}
.gg-tag.next{background:#FFE76A;color:#16160F}
.gg-guide{position:relative;width:44px;height:44px}
.gg-guide .dot{position:absolute;inset:4px;border-radius:999px;background:#FFE76A;border:3px solid #16160F;display:flex;align-items:center;justify-content:center;font:800 13px Archivo,system-ui,sans-serif;color:#16160F;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.gg-guide.old .dot{background:#E4E1D6;border-color:#8A877C;color:#5C5A52}
.gg-guide.live:before{content:"";position:absolute;inset:-6px;border-radius:999px;background:rgba(255,214,0,.45);animation:gg-pulse 2s ease-out infinite}
@keyframes gg-pulse{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.4);opacity:0}}
.gg-svc{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#fff;border:2px solid;box-shadow:0 1px 3px rgba(0,0,0,.3);box-sizing:border-box;cursor:pointer}
.gg-pop{font:14px Figtree,system-ui,sans-serif;line-height:1.4}
.gg-pop b{font-size:15px}
.gg-pop a{font-weight:700;color:#16160F}
.gg-me{width:18px;height:18px;border-radius:999px;background:#2F6FDE;border:3px solid #fff;box-shadow:0 0 0 2px rgba(47,111,222,.35),0 1px 4px rgba(0,0,0,.4);box-sizing:border-box}
.leaflet-container{font-family:Figtree,system-ui,sans-serif;background:#EEF1EC}
.leaflet-control-attribution{font-size:10px}
`;
let cssAdded = false;
function addCss() {
  if (cssAdded || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
  cssAdded = true;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const bounds = (places: Place[]) => L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]));

export function LiveMap(props: LiveMapProps) {
  const { map, height, selectedId, next, nameOf, labelOf, onSelect, guides, me, focus, fitKey, base, pistes, wheelZoom } = props;
  const { services, serviceLabel, openMapsLabel, onServicesFailed, busTimetable } = props;
  const box = useRef<HTMLElement | null>(null);
  const lmap = useRef<L.Map | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const pisteLayer = useRef<L.TileLayer | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const svcLayer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const svcText = useRef({ serviceLabel, openMapsLabel, onServicesFailed, busTimetable });
  useEffect(() => {
    onSelectRef.current = onSelect;
    svcText.current = { serviceLabel, openMapsLabel, onServicesFailed, busTimetable };
  }, [onSelect, serviceLabel, openMapsLabel, onServicesFailed, busTimetable]);

  // Create the map once.
  useEffect(() => {
    addCss();
    const el = box.current;
    if (!el) return;
    const m = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true } as L.MapOptions);
    m.attributionControl.setPrefix(false);
    m.fitBounds(bounds(map.places), { padding: [36, 36], maxZoom: 15 });
    svcLayer.current = L.layerGroup();
    markers.current = L.layerGroup().addTo(m);
    lmap.current = m;
    // The box can change size (window resize, columns); keep the tiles filling it.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      m.remove();
      lmap.current = null;
      baseLayer.current = null;
      pisteLayer.current = null;
    };
  }, [map]);

  useEffect(() => {
    const m = lmap.current;
    if (!m) return;
    if (wheelZoom) m.scrollWheelZoom.enable();
    else m.scrollWheelZoom.disable();
  }, [wheelZoom]);

  // Base map and piste layer.
  useEffect(() => {
    const m = lmap.current;
    if (!m) return;
    baseLayer.current?.remove();
    const b = BASES[base];
    baseLayer.current = L.tileLayer(b.url, {
      attribution: b.attribution,
      maxNativeZoom: b.maxNativeZoom,
      maxZoom: 19,
      subdomains: 'abc',
      detectRetina: false,
    }).addTo(m);
    baseLayer.current.bringToBack();
  }, [base, map]);

  useEffect(() => {
    const m = lmap.current;
    if (!m) return;
    pisteLayer.current?.remove();
    pisteLayer.current = null;
    if (pistes) {
      pisteLayer.current = L.tileLayer(PISTES.url, { attribution: PISTES.attribution, maxNativeZoom: 18, maxZoom: 19, opacity: 0.95 }).addTo(m);
    }
  }, [pistes, map]);

  // Other services: fetched once per resort, shown when switched on and zoomed in far enough.
  useEffect(() => {
    const m = lmap.current;
    const layer = svcLayer.current;
    if (!m || !layer) return;
    if (!services) {
      layer.remove();
      return;
    }
    let cancelled = false;
    const huts = L.layerGroup().addTo(m);
    const sync = () => {
      if (m.getZoom() >= SERVICES_MIN_ZOOM) layer.addTo(m);
      else layer.remove();
    };
    loadServices(map)
      .then((items) => {
        if (cancelled) return;
        const { serviceLabel, openMapsLabel, onServicesFailed, busTimetable } = svcText.current;
        onServicesFailed?.(false);
        layer.clearLayers();
        for (const sv of items) {
          const st = SERVICE_STYLE[sv.kind];
          const icon = L.divIcon({
            className: '',
            html: `<div class="gg-svc" style="border-color:${st.color}">${iconSvg(st.icon, 12, st.color, 2.4)}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          // Google Maps finds the place by name in the resort; for a bus stop it shows the departures.
          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sv.name}, ${map.names[0]}`)}`;
          const link = (href: string, text: string) => `<br><a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
          const mk = L.marker([sv.lat, sv.lng], { icon, title: `${sv.name}, ${serviceLabel(sv.kind)}`, keyboard: true });
          mk.bindTooltip(esc(sv.name), { direction: 'top', offset: [0, -10], className: 'gg-tag' });
          mk.bindPopup(
            `<div class="gg-pop"><b>${esc(sv.name)}</b><br>${esc(serviceLabel(sv.kind))}${link(url, openMapsLabel)}${
              sv.kind === 'bus' && busTimetable ? link(busTimetable.url, busTimetable.label) : ''
            }</div>`,
          );
          (sv.kind === 'hut' ? huts : layer).addLayer(mk);
        }
        sync();
      })
      .catch(() => {
        if (!cancelled) svcText.current.onServicesFailed?.(true);
      });
    m.on('zoomend', sync);
    return () => {
      cancelled = true;
      m.off('zoomend', sync);
      huts.remove();
    };
  }, [services, map]);

  // Pins, guide and "me". Few markers, so they are simply redrawn when anything changes.
  useEffect(() => {
    const group = markers.current;
    if (!group) return;
    group.clearLayers();

    for (const p of map.places) {
      const s = KIND_STYLE[p.kind];
      const sel = p.id === selectedId;
      const isNext = next?.placeId === p.id;
      const size = 30;
      const icon = L.divIcon({
        className: '',
        html: `<div class="gg-pin${sel ? ' sel' : ''}${isNext ? ' next' : ''}" role="button" aria-label="${esc(labelOf(p))}" style="width:${size}px;height:${size}px;background:${s.color}">${iconSvg(s.icon, 16, s.ink, 2.2)}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const mk = L.marker([p.lat, p.lng], { icon, title: labelOf(p), keyboard: true, zIndexOffset: sel ? 600 : isNext ? 400 : 0, riseOnHover: true });
      mk.on('click', () => onSelectRef.current(p));
      if (isNext) {
        mk.bindTooltip(esc(`${next!.label} · ${nameOf(p)}`), { permanent: true, direction: 'top', offset: [0, -16], className: 'gg-tag next' });
      } else if (sel) {
        mk.bindTooltip(esc(nameOf(p)), { permanent: true, direction: 'top', offset: [0, -16], className: 'gg-tag' });
      }
      group.addLayer(mk);
    }

    for (const g of guides) {
      if (g.accuracy && g.accuracy > 25 && g.state !== 'old') {
        group.addLayer(
          L.circle([g.lat, g.lng], { radius: Math.min(g.accuracy, 500), color: '#C9A800', weight: 1, fillColor: '#FFE76A', fillOpacity: 0.18, interactive: false }),
        );
      }
      const icon = L.divIcon({
        className: '',
        html: `<div class="gg-guide ${g.state}" aria-label="${esc(g.label)}"><div class="dot">${esc(g.initials || '★')}</div></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const mk = L.marker([g.lat, g.lng], { icon, title: g.label, zIndexOffset: 1000 });
      mk.bindTooltip(esc(g.label), { direction: 'top', offset: [0, -22], className: 'gg-tag' });
      group.addLayer(mk);
    }

    if (me) {
      if (me.accuracy && me.accuracy > 20) {
        group.addLayer(L.circle([me.lat, me.lng], { radius: Math.min(me.accuracy, 500), color: '#2F6FDE', weight: 1, fillOpacity: 0.12, interactive: false }));
      }
      group.addLayer(L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="gg-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 900, interactive: false }));
    }
  }, [map, selectedId, next, nameOf, labelOf, guides, me]);

  // Fly to a place, the guide or me.
  useEffect(() => {
    const m = lmap.current;
    if (!m || !focus) return;
    m.flyTo([focus.lat, focus.lng], Math.max(m.getZoom(), focus.zoom ?? 15), { duration: 0.6 });
  }, [focus]);

  useEffect(() => {
    const m = lmap.current;
    if (!m || !fitKey) return;
    m.flyToBounds(bounds(map.places), { padding: [36, 36], maxZoom: 15, duration: 0.6 });
  }, [fitKey, map]);

  return <View ref={box as never} style={{ height, width: '100%' }} />;
}

export const LIVE_MAP_REAL = true;
