import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { LIVE_MAP_REAL, LiveMap } from '@/components/live-map';
import type { MapBase, MapGuide } from '@/components/live-map-types';
import { KIND_STYLE } from '@/components/ski-map';
import { Text } from '@/components/text';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { freshness, initials } from '@/lib/guide-location';
import { useGuideLocations, useGuideSharing } from '@/lib/guide-sharing';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { Columns, useWide } from '@/lib/layout';
import { localTransportFor } from '@/lib/local-transport';
import type { ServiceKind } from '@/lib/osm-services';
import { mapFor, noteIn, placeFor, type Place, type PlaceKind } from '@/lib/resort-map';
import { formatDay, hhmm } from '@/lib/time';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import type { ProgrammeItem } from '@/lib/types';
import { radius, space, usePalette } from '@/theme';

const SERVICE_LABEL: Record<ServiceKind, MessageKey> = {
  hut: 'mapSvcHut',
  food: 'mapSvcFood',
  rental: 'mapSvcRental',
  school: 'mapSvcSchool',
  health: 'mapSvcHealth',
  atm: 'mapSvcAtm',
  bus: 'mapSvcBus',
};

const KIND_LABEL: Record<PlaceKind, MessageKey> = {
  hotel: 'mapKindHotel',
  lift: 'mapKindLift',
  rental: 'mapKindRental',
  food: 'mapKindFood',
  bus: 'mapKindBus',
};

const googleMaps = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const open = (url: string) => Linking.openURL(url).catch(() => {});

/**
 * Map tab: a real map of the resort with the piste and lift layer (browser), pins for the hotel,
 * lifts, rental, lunch spot and ski bus linked to the programme, and the guide's live location.
 * Guides switch their location sharing on here.
 */
export default function MapScreen() {
  const c = usePalette();
  const wide = useWide();
  const { t, lang, locale } = useI18n();
  const { trip, role, id: memberId } = useMembership();
  const isGuide = role === 'guide';
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const map = mapFor(trip.destination);
  const { locations, now } = useGuideLocations(trip.id);

  const nameOf = (p: Place) => (p.kind === 'hotel' ? trip.hotel_name || t('mapKindHotel') : p.name);
  const noteOf = (p: Place) => (p.kind === 'hotel' ? (trip.hotel_address ?? '') : noteIn(p, lang));
  const queryOf = (p: Place) => (p.kind === 'hotel' ? [trip.hotel_name, trip.hotel_address ?? trip.destination].filter(Boolean).join(', ') : p.query);
  const labelOf = (p: Place) => `${nameOf(p)}, ${t(KIND_LABEL[p.kind])}`;
  const whenOf = (it: ProgrammeItem) => `${it.day === clock.date ? t('today') : formatDay(it.day, locale)} ${hhmm(it.starts_at)}`;

  // Upcoming programme items that happen at a place on the map, soonest first.
  const upcoming = useMemo(() => {
    if (!map) return [];
    return items
      .filter((it) => it.day > clock.date || (it.day === clock.date && hhmm(it.starts_at) >= clock.time))
      .map((it) => ({ it, place: placeFor(map, `${it.title} ${it.details}`, trip.hotel_name) }))
      .filter((x): x is { it: ProgrammeItem; place: Place } => x.place != null)
      .sort((a, b) => (a.it.day + a.it.starts_at).localeCompare(b.it.day + b.it.starts_at));
  }, [map, items, clock.date, clock.time, trip.hotel_name]);
  const next = upcoming[0] ?? null;

  // Guides with a position that is not too old, freshest first.
  const guides = useMemo(
    () =>
      locations
        .map((l) => ({ l, f: freshness(l.updated_at, now) }))
        .filter((x): x is { l: (typeof locations)[number]; f: NonNullable<ReturnType<typeof freshness>> } => x.f != null)
        .sort((a, b) => a.f.minutes - b.f.minutes),
    [locations, now],
  );
  const ageOf = (f: { state: string; minutes: number }, updatedAt: string) =>
    f.minutes < 1
      ? t('mapGuideUpdatedNow')
      : f.state === 'old'
        ? t('mapGuideUpdatedAt', { time: new Date(updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: trip.timezone }) })
        : t('mapGuideUpdatedMin', { n: String(f.minutes) });
  const guideName = (name: string) => name.split(/\s+/)[0] || t('tabGuide');
  const mapGuides: MapGuide[] = useMemo(
    () =>
      guides.map(({ l, f }) => ({
        id: l.member_id,
        lat: l.lat,
        lng: l.lng,
        accuracy: l.accuracy,
        initials: initials(l.guide_name),
        state: f.state,
        label: t('mapGuideA11y', { name: guideName(l.guide_name), age: ageOf(f, l.updated_at) }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guides, memberId, lang],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = map?.places.find((p) => p.id === (selectedId ?? next?.place.id ?? 'hotel')) ?? null;
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [base, setBase] = useState<MapBase>('map');
  const [pistes, setPistes] = useState(true);
  const [services, setServices] = useState(true);
  const [servicesFailed, setServicesFailed] = useState(false);
  const flyTo = (lat: number, lng: number, zoom?: number) => setFocus({ lat, lng, zoom, key: Date.now() });
  const select = (p: Place, centre = false) => {
    setSelectedId(p.id);
    if (centre) flyTo(p.lat, p.lng, 15);
  };

  const me = useMyPosition();
  const skibusUrl = localTransportFor(trip.destination)?.skibusUrl;

  if (!map) {
    return (
      <Screen>
        <View style={{ gap: 4 }}>
          <Eyebrow>{t('tabMap')}</Eyebrow>
          <H1>{trip.destination}</H1>
        </View>
        <Card style={{ gap: space.m }}>
          <Muted>{t('mapNoMap')}</Muted>
          <Button small variant="ghost" label={t('mapOpenMaps')} onPress={() => open(googleMaps(trip.destination))} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Screen>
    );
  }

  const selectedItems = selected ? upcoming.filter((x) => x.place.id === selected.id).slice(0, 3) : [];
  const topGuide = guides[0] ?? null;

  const guideCard = isGuide ? (
    <ShareCard />
  ) : LIVE_MAP_REAL ? (
    <Card tone={topGuide?.f.state === 'live' ? 'brand' : 'card'} style={styles.guideCard}>
      <View style={[styles.guideDot, { backgroundColor: topGuide ? (topGuide.f.state === 'old' ? '#E4E1D6' : c.brand) : c.pillOff, borderColor: topGuide ? '#16160F' : c.line }]}>
        <Text style={styles.guideInitials}>{topGuide ? initials(topGuide.l.guide_name) : '–'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {topGuide ? (
          <>
            <Text style={[styles.strong, { color: topGuide.f.state === 'live' ? c.brandInk : c.fg }]}>
              {t('mapGuideLive', { name: guideName(topGuide.l.guide_name) })}
            </Text>
            <Text style={{ color: topGuide.f.state === 'live' ? c.brandInk : c.muted, fontSize: 14 }}>
              {topGuide.f.state === 'live' ? '● ' : ''}
              {ageOf(topGuide.f, topGuide.l.updated_at)}
            </Text>
          </>
        ) : (
          <Muted>{t('mapGuideOff')}</Muted>
        )}
      </View>
      {topGuide ? <Tool icon="pin" label={t('mapShowGuide')} onPress={() => flyTo(topGuide.l.lat, topGuide.l.lng, 16)} /> : null}
    </Card>
  ) : null;

  const nextCard = next ? (
    <Pressable accessibilityRole="button" onPress={() => select(next.place, true)}>
      <Card tone="cream" style={styles.nextCard}>
        <Icon name="pin" size={24} color={c.fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.nextEyebrow, { color: c.muted }]}>
            {t('next')} · {whenOf(next.it)}
          </Text>
          <Text style={[styles.strong, { color: c.fg }]}>{next.it.title}</Text>
          <Text style={{ color: c.fg, fontSize: 14 }}>{nameOf(next.place)}</Text>
        </View>
        <Icon name="arrow" size={20} color={c.fg} />
      </Card>
    </Pressable>
  ) : null;

  const mapHeight = wide ? 620 : 440;
  const mapBlock = (
    <View style={{ gap: space.s }}>
      <View style={[styles.mapBox, { borderColor: c.line, height: mapHeight }]}>
        <LiveMap
          map={map}
          height={mapHeight}
          selectedId={selected?.id ?? null}
          next={next ? { placeId: next.place.id, label: hhmm(next.it.starts_at) } : null}
          nameOf={nameOf}
          labelOf={labelOf}
          onSelect={(p) => select(p)}
          guides={mapGuides}
          me={me.pos}
          focus={focus}
          fitKey={fitKey}
          base={base}
          pistes={pistes}
          wheelZoom={wide}
          services={services}
          serviceLabel={(k) => t(SERVICE_LABEL[k])}
          openMapsLabel={t('mapOpenMaps')}
          busTimetable={skibusUrl ? { label: t('mapSkibusTimetable'), url: skibusUrl } : null}
          onServicesFailed={setServicesFailed}
        />
      </View>
      {LIVE_MAP_REAL ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
          <Tool icon="locate" label={t('mapShowMe')} on={me.pos != null} onPress={() => me.locate((p) => flyTo(p.lat, p.lng, 16))} />
          <Tool icon="expand" label={t('mapShowAll')} onPress={() => setFitKey((k) => k + 1)} />
          <Tool icon="food" label={t('mapServices')} on={services} onPress={() => setServices((v) => !v)} />
          <Tool icon="lift" label={t('mapPistes')} on={pistes} onPress={() => setPistes((v) => !v)} />
          <Tool icon="info" label={t('mapTerrain')} on={base === 'terrain'} onPress={() => setBase((b) => (b === 'terrain' ? 'map' : 'terrain'))} />
          {map.pisteMapUrl ? <Tool icon="external" label={t('mapPisteMap')} onPress={() => open(map.pisteMapUrl!)} /> : null}
        </ScrollView>
      ) : null}
      {LIVE_MAP_REAL && services ? <Muted>{servicesFailed ? t('mapServicesFailed') : t('mapServicesHint')}</Muted> : null}
      {me.error ? <Muted>{t('mapMeDenied')}</Muted> : me.pos ? <Muted>{t('mapMePrivate')}</Muted> : null}
      {!LIVE_MAP_REAL ? <Muted>{`${t('mapDrag')} ${t('mapApprox')}`}</Muted> : null}
    </View>
  );

  const placeList = (
    <ScrollView
      horizontal={!wide}
      scrollEnabled={!wide}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={wide ? styles.placeWrap : { gap: space.s }}>
      {map.places.map((p) => {
        const on = p.id === selected?.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={labelOf(p)}
            accessibilityState={{ selected: on }}
            onPress={() => select(p, true)}
            style={[styles.chip, { backgroundColor: on ? c.brand : c.card, borderColor: on ? c.brand : c.line }]}>
            <KindBadge kind={p.kind} small />
            <Text numberOfLines={1} style={[styles.chipText, { color: on ? c.brandInk : c.fg }]}>
              {nameOf(p)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const selectedCard = selected ? (
    <Card style={{ gap: space.m }}>
      <View style={styles.row}>
        <KindBadge kind={selected.kind} />
        <Eyebrow>{t(KIND_LABEL[selected.kind])}</Eyebrow>
      </View>
      <H2>{nameOf(selected)}</H2>
      {noteOf(selected) ? <Body>{noteOf(selected)}</Body> : null}
      {selectedItems.length ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.small, { color: c.muted }]}>{t('mapInProgramme')}</Text>
          {selectedItems.map(({ it }) => (
            <View key={it.id} style={styles.row}>
              <Text style={[styles.time, { color: c.fg }]}>{whenOf(it)}</Text>
              <Text style={{ color: c.fg, fontSize: 15, flex: 1 }}>{it.title}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button small variant="ghost" label={t('mapOpenMaps')} onPress={() => open(googleMaps(queryOf(selected)))} />
        {selected.kind === 'bus' && skibusUrl ? <Button small variant="ghost" label={t('mapSkibusTimetable')} onPress={() => open(skibusUrl)} /> : null}
      </View>
    </Card>
  ) : null;

  return (
    <Screen width={wide ? 'full' : undefined}>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('tabMap')}</Eyebrow>
        <H1>{trip.destination}</H1>
      </View>
      {wide ? (
        <Columns weights={[3, 2]}>
          {mapBlock}
          <>
            {guideCard}
            {nextCard}
            {placeList}
            {selectedCard}
          </>
        </Columns>
      ) : (
        <>
          {guideCard}
          {nextCard}
          {mapBlock}
          {placeList}
          {selectedCard}
        </>
      )}
    </Screen>
  );
}

/** The guide's own switch: share my location with the trip. */
function ShareCard() {
  const c = usePalette();
  const { t } = useI18n();
  const s = useGuideSharing();
  const status = !s.supported
    ? t('shareUnsupported')
    : s.error === 'denied'
      ? t('shareDenied')
      : s.error === 'save'
        ? t('shareSaveFailed')
        : s.error === 'unavailable'
          ? t('shareUnavailable')
          : s.starting
            ? t('shareStarting')
            : s.sharing
              ? t('shareKeepOpen')
              : t('shareBody');
  return (
    <Card tone={s.sharing && !s.error ? 'brand' : 'card'} style={{ gap: space.s }}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.strong, { color: s.sharing ? c.brandInk : c.fg }]}>{s.sharing ? `● ${t('shareOn')}` : t('shareTitle')}</Text>
        </View>
        <Switch
          value={s.sharing}
          disabled={!s.supported}
          onValueChange={(on) => (on ? s.start() : s.stop())}
          trackColor={{ true: c.ok, false: c.pillOff }}
          accessibilityLabel={t('shareTitle')}
        />
      </View>
      <Text style={{ color: s.sharing ? c.brandInk : c.muted, fontSize: 14, lineHeight: 20 }}>{status}</Text>
    </Card>
  );
}

function Tool({ icon, label, on, onPress }: { icon: IconName; label: string; on?: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={on != null ? { selected: on } : undefined}
      onPress={onPress}
      style={[styles.tool, { backgroundColor: on ? c.fg : c.card, borderColor: on ? c.fg : c.line }]}>
      <Icon name={icon} size={16} color={on ? c.bg : c.fg} />
      <Text style={[styles.toolText, { color: on ? c.bg : c.fg }]}>{label}</Text>
    </Pressable>
  );
}

function KindBadge({ kind, small }: { kind: PlaceKind; small?: boolean }) {
  const s = KIND_STYLE[kind];
  const size = small ? 22 : 28;
  return (
    <View style={[styles.badge, { backgroundColor: s.color, width: size, height: size }]}>
      <Icon name={s.icon} size={small ? 13 : 15} color={s.ink} strokeWidth={2.2} />
    </View>
  );
}

/** The viewer's own position, only on this device: asked for when they tap "Oma sijainti". */
function useMyPosition() {
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [error, setError] = useState(false);
  const watch = useRef<number | null>(null);
  const onFirst = useRef<((p: { lat: number; lng: number }) => void) | null>(null);
  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation?.clearWatch(watch.current);
    },
    [],
  );
  const locate = (then: (p: { lat: number; lng: number }) => void) => {
    const g = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!g) return setError(true);
    if (pos) return then(pos);
    onFirst.current = then;
    if (watch.current != null) return;
    watch.current = g.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
        setError(false);
        setPos(next);
        onFirst.current?.(next);
        onFirst.current = null;
      },
      () => {
        setError(true);
        if (watch.current != null) g.clearWatch(watch.current);
        watch.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
  };
  return { pos, error, locate };
}

const styles = StyleSheet.create({
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  guideDot: { width: 40, height: 40, borderRadius: 99, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  guideInitials: { fontSize: 14, fontWeight: '800', color: '#16160F' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  nextEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  strong: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13 },
  time: { fontSize: 14, fontWeight: '700', minWidth: 92 },
  mapBox: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', backgroundColor: '#EEF1EC' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  placeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 99, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '700', maxWidth: 180 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1.5 },
  toolText: { fontSize: 14, fontWeight: '700' },
  badge: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
