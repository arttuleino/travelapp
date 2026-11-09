import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TransitMap } from '@/components/transit-map';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { hhmm } from '@/lib/time';
import { useNextDepartures, useStops, useTransitImport } from '@/lib/transit';
import { useMembership, useTripClock } from '@/lib/trip';
import { space, usePalette } from '@/theme';

/** Bus stops near the destination on a map, and the next timetabled departures from the chosen stop. */
export default function Buses() {
  const c = usePalette();
  const { t } = useI18n();
  const { trip } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { stops } = useStops(trip.id);
  const meta = useTransitImport(trip.id);
  const [selected, setSelected] = useState<string | null>(null);
  const stop = stops.find((s) => s.id === selected) ?? null;
  const { departures, loading } = useNextDepartures(stop?.id ?? null, clock.date, `${clock.time}:00`);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('busesEyebrow')}</Eyebrow>
        <H1>{t('busesTitle')}</H1>
      </View>

      <TransitMap stops={stops} selected={selected} onSelect={setSelected} />

      {stop ? (
        <Card style={{ gap: space.s }}>
          <H2>{stop.name}</H2>
          <Text style={{ color: c.warn, fontSize: 12, fontWeight: '700' }}>{t('scheduledOnly')}</Text>
          {departures.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', gap: space.m, alignItems: 'baseline' }}>
              <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 52 }}>{hhmm(d.departs_at)}</Text>
              {d.route ? (
                <View style={{ backgroundColor: c.brand, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ color: c.brandInk, fontWeight: '800', fontSize: 13 }}>{d.route}</Text>
                </View>
              ) : null}
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {d.headsign}
              </Body>
              {d.service_date !== clock.date ? <Muted>{t('tomorrowShort')}</Muted> : null}
            </View>
          ))}
          {!loading && departures.length === 0 ? <Muted>{t('noDepartures')}</Muted> : null}
        </Card>
      ) : (
        <Muted>{t('pickStop')}</Muted>
      )}

      <View style={{ gap: space.s }}>
        <Body style={{ fontWeight: '700' }}>{t('stopsList')}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {stops.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: s.id === selected }}
              onPress={() => setSelected(s.id)}
              style={{ borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: s.id === selected ? c.brand : c.card }}>
              <Text style={{ color: s.id === selected ? c.brandInk : c.fg, fontSize: 14, fontWeight: '600' }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {meta ? (
        <Muted>
          {t('busSource', { source: meta.source })}
          {meta.projected ? `\n${t('busProjected')}` : ''}
        </Muted>
      ) : null}
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
