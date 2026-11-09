import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { TransitMap } from '@/components/transit-map';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { hhmm } from '@/lib/time';
import { useNextDepartures, useStops, useTransitImport, type TransitStop } from '@/lib/transit';
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
      <StopPicker stops={stops} selected={selected} onSelect={setSelected} />

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

/** A collapsed "Choose a stop" button that opens a searchable list, so dozens of stops don't fill the screen. */
function StopPicker({ stops, selected, onSelect }: { stops: TransitStop[]; selected: string | null; onSelect: (id: string) => void }) {
  const c = usePalette();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = stops.find((s) => s.id === selected);
  const q = query.trim().toLowerCase();
  const shown = q ? stops.filter((s) => s.name.toLowerCase().includes(q)) : stops;

  function pick(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ gap: space.s }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.m,
          borderWidth: 1.5,
          borderColor: c.line,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}>
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
          {current?.name ?? t('chooseStop', { n: stops.length })}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={{ borderWidth: 1.5, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchStop')}
            placeholderTextColor={c.muted}
            autoCorrect={false}
            style={{ color: c.fg, fontSize: 16, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}
          />
          {shown.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: s.id === selected }}
              onPress={() => pick(s.id)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 11,
                backgroundColor: s.id === selected ? c.brand : pressed ? c.card : 'transparent',
              })}>
              <Text style={{ color: s.id === selected ? c.brandInk : c.fg, fontSize: 15 }}>{s.name}</Text>
            </Pressable>
          ))}
          {shown.length === 0 ? <Muted style={{ padding: 14 }}>{t('noStopMatch')}</Muted> : null}
        </View>
      ) : null}
    </View>
  );
}
