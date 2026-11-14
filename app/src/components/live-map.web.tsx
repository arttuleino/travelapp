// @ts-expect-error CSS import, bundled by Metro on web
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { iconSvg } from '@/components/icon';
import type { LiveMapProps } from '@/components/live-map-types';
import { KIND_STYLE } from '@/components/ski-map';
import type { Place } from '@/lib/resort-map';

/**
 * Browser: a real map (OpenStreetMap data) with the OpenSnowMap piste and lift layer on top,
 * pins for the trip's places, the guide's live position and, if asked, the viewer's own.
 *
 * Tile servers can be swapped with EXPO_PUBLIC_MAP_TILES / EXPO_PUBLIC_MAP_TILES_ATTRIBUTION
 * (e.g. a paid MapTiler or Stadia key once traffic grows; the free servers ask for light use).
 */
const BASES = {
  map: {
    url: process.env.EXPO_PUBLIC_MAP_TILES || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      process.env.EXPO_PUBLIC_MAP_TILES_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
  const box = useRef<HTMLElement | null>(null);
  const lmap = useRef<L.Map | null>(null);
  const baseLayer = useRef<L.TileLayer | null>(null);
  const pisteLayer = useRef<L.TileLayer | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    addCss();
    const el = box.current;
    if (!el) return;
    const m = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true } as L.MapOptions);
    m.attributionControl.setPrefix(false);
    m.fitBounds(bounds(map.places), { padding: [36, 36], maxZoom: 15 });
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
