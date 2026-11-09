import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { Icon } from '@/components/icon';
import { KIND_STYLE, SkiMap } from '@/components/ski-map';
import { Text } from '@/components/text';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { mapFor, noteIn, placeFor, type Place, type PlaceKind } from '@/lib/resort-map';
import { formatDay, hhmm } from '@/lib/time';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import type { ProgrammeItem } from '@/lib/types';
import { radius, space, usePalette } from '@/theme';

/** Height of the map window on screen; the drawing is scaled to it and scrolls sideways. */
const MAP_HEIGHT = 380;

const KIND_LABEL: Record<PlaceKind, MessageKey> = {
  hotel: 'mapKindHotel',
  lift: 'mapKindLift',
  rental: 'mapKindRental',
  food: 'mapKindFood',
  bus: 'mapKindBus',
};

const googleMaps = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Map tab: a drawn resort map with the hotel, lifts, rental, lunch spot and ski bus, linked to the programme. */
export default function MapScreen() {
  const c = usePalette();
  const { t, lang, locale } = useI18n();
  const { trip } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const map = mapFor(trip.destination);

  const nameOf = (p: Place) => (p.kind === 'hotel' ? trip.hotel_name || t('mapKindHotel') : p.name);
  const noteOf = (p: Place) => (p.kind === 'hotel' ? (trip.hotel_address ?? '') : noteIn(p, lang));
  const queryOf = (p: Place) => (p.kind === 'hotel' ? [trip.hotel_name, trip.hotel_address ?? trip.destination].filter(Boolean).join(', ') : p.query);
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = map?.places.find((p) => p.id === (selectedId ?? next?.place.id ?? 'hotel')) ?? null;

  const scroller = useRef<ScrollViewInstance>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const scale = map ? MAP_HEIGHT / map.height : 1;
  const centreOn = (p: Place, animated = true) => {
    if (!map || !viewWidth) return;
    const max = map.width * scale - viewWidth;
    scroller.current?.scrollTo({ x: Math.max(0, Math.min(max, p.x * scale - viewWidth / 2)), animated });
  };
  const select = (p: Place, centre = false) => {
    setSelectedId(p.id);
    if (centre) centreOn(p);
  };
  const onLayout = (e: LayoutChangeEvent) => setViewWidth(e.nativeEvent.layout.width);

  // Until the traveller picks a place, keep the default one (the next programme stop) in view.
  const defaultX = selectedId ? null : (selected?.x ?? null);
  useEffect(() => {
    if (defaultX == null || !viewWidth || !map) return;
    const max = map.width * scale - viewWidth;
    const id = setTimeout(() => scroller.current?.scrollTo({ x: Math.max(0, Math.min(max, defaultX * scale - viewWidth / 2)), animated: false }), 60);
    return () => clearTimeout(id);
  }, [defaultX, viewWidth, map, scale]);

  if (!map) {
    return (
      <Screen>
        <View style={{ gap: 4 }}>
          <Eyebrow>{t('tabMap')}</Eyebrow>
          <H1>{trip.destination}</H1>
        </View>
        <Card style={{ gap: space.m }}>
          <Muted>{t('mapNoMap')}</Muted>
          <Button
            small
            variant="ghost"
            label={t('mapOpenMaps')}
            onPress={() => Linking.openURL(googleMaps(trip.destination)).catch(() => {})}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>
      </Screen>
    );
  }

  const selectedItems = selected ? upcoming.filter((x) => x.place.id === selected.id).slice(0, 3) : [];

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('tabMap')}</Eyebrow>
        <H1>{trip.destination}</H1>
      </View>

      {next ? (
        <Pressable accessibilityRole="button" onPress={() => select(next.place, true)}>
          <Card tone="brand" style={styles.nextCard}>
            <Icon name="pin" size={24} color={c.brandInk} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.nextEyebrow, { color: c.brandInk }]}>
                {t('next')} · {whenOf(next.it)}
              </Text>
              <Text style={[styles.strong, { color: c.brandInk }]}>{next.it.title}</Text>
              <Text style={{ color: c.brandInk, fontSize: 14 }}>{nameOf(next.place)}</Text>
            </View>
            <Icon name="arrow" size={20} color={c.brandInk} />
          </Card>
        </Pressable>
      ) : null}

      <View style={[styles.mapBox, { borderColor: c.line }]} onLayout={onLayout}>
        <ScrollView ref={scroller} horizontal bounces={false} contentContainerStyle={{ height: MAP_HEIGHT }}>
          <SkiMap
            map={map}
            scale={scale}
            selectedId={selected?.id ?? null}
            next={next ? { placeId: next.place.id, label: hhmm(next.it.starts_at) } : null}
            nameOf={nameOf}
            labelOf={(p) => `${nameOf(p)}, ${t(KIND_LABEL[p.kind])}`}
            onSelect={(p) => select(p)}
          />
        </ScrollView>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: -6 }} contentContainerStyle={{ gap: space.s }}>
        {map.places.map((p) => {
          const on = p.id === selected?.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${nameOf(p)}, ${t(KIND_LABEL[p.kind])}`}
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
      <Muted style={{ marginTop: -8 }}>{`${t('mapDrag')} ${t('mapApprox')}`}</Muted>

      {selected ? (
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
          <Button
            small
            variant="ghost"
            label={t('mapOpenMaps')}
            onPress={() => Linking.openURL(googleMaps(queryOf(selected))).catch(() => {})}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>
      ) : null}

    </Screen>
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

const styles = StyleSheet.create({
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  nextEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  strong: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13 },
  time: { fontSize: 14, fontWeight: '700', minWidth: 92 },
  mapBox: { height: MAP_HEIGHT, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', backgroundColor: '#EEF6FD' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 99, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '700', maxWidth: 180 },
  badge: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
