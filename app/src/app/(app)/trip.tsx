import { Linking, StyleSheet, View } from 'react-native';

import { CustomerService } from '@/components/customer-service';
import { Icon } from '@/components/icon';
import { LanguageList } from '@/components/language-picker';
import { Text } from '@/components/text';
import { Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Columns } from '@/lib/layout';
import { formatDay } from '@/lib/time';
import { useFlights, useMembership } from '@/lib/trip';
import type { Flight } from '@/lib/types';
import { space, usePalette } from '@/theme';

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

/** Traveller's Matka tab: flights, hotel and booking from the operator, then customer service and settings. */
export default function TripInfo() {
  const c = usePalette();
  const { t } = useI18n();
  const { trip, display_name, booking_ref, party_size, market } = useMembership();
  const { flights, loading } = useFlights(trip.id);
  const email = useAuth().session?.user.email ?? '';

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('tripInfo')}</Eyebrow>
        <H1>{t('tripInfoTitle')}</H1>
      </View>

      {/* On a computer: flights, hotel and booking on the left, contacts and settings on the right. */}
      <Columns>
        <>
          {flights.map((f) => (
            <FlightCard key={f.id} f={f} />
          ))}
          {!loading && !flights.length ? (
            <Card style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
              <Icon name="plane" size={22} color={c.muted} />
              <Muted style={{ flex: 1 }}>{t('noFlights')}</Muted>
            </Card>
          ) : null}

          {trip.hotel_name ? <HotelCard /> : null}

          <Card style={{ gap: space.s }}>
            <Eyebrow>{t('yourBooking')}</Eyebrow>
            <View style={styles.row}>
              <Text style={styles.strong}>{display_name}</Text>
              <Muted>{t('persons', { n: party_size })}</Muted>
            </View>
            {booking_ref ? <Muted>{t('booking', { ref: booking_ref })}</Muted> : null}
          </Card>
        </>
        <>
          <CustomerService market={market} />

          <View style={{ gap: space.s }}>
            <H2>{t('language')}</H2>
            <Muted>{t('languageHint')}</Muted>
            <LanguageList />
          </View>

          <Card tone="cream" style={{ gap: space.s }}>
            <Muted>{t('signedInAs', { email })}</Muted>
            <Button label={t('signOut')} variant="danger" onPress={signOut} style={{ alignSelf: 'flex-start' }} />
          </Card>
        </>
      </Columns>
    </Screen>
  );
}

function FlightCard({ f }: { f: Flight }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const rows: [string, string | null][] = [
    [t('flightLabel'), [f.flight_no, f.airline].filter(Boolean).join(' · ')],
    [t('baggage'), f.baggage],
    [t('terminal'), f.terminal],
    [t('transfer'), f.transfer],
  ];
  return (
    <Card style={{ gap: space.m }}>
      <Eyebrow>
        {f.direction === 'out' ? t('flightOut') : t('flightReturn')} · {formatDay(f.flight_date, locale)}
      </Eyebrow>
      <View
        style={styles.flight}
        accessible
        accessibilityLabel={`${f.dep_city ?? f.dep_code} ${hhmm(f.dep_time)} → ${f.arr_city ?? f.arr_code} ${hhmm(f.arr_time)}`}>
        <Airport code={f.dep_code} city={f.dep_city} time={f.dep_time} />
        <View style={styles.line}>
          <View style={[styles.dash, { borderColor: c.line }]} />
          <Icon name="plane" size={18} color={c.muted} />
          <View style={[styles.dash, { borderColor: c.line }]} />
        </View>
        <Airport code={f.arr_code} city={f.arr_city} time={f.arr_time} />
      </View>
      <KeyValues rows={rows} />
    </Card>
  );
}

function Airport({ code, city, time }: { code: string; city: string | null; time: string }) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text face="display" style={[styles.code, { color: c.fg }]}>
        {code}
      </Text>
      {city ? <Muted>{city}</Muted> : null}
      <Text style={[styles.strong, { color: c.fg }]}>{hhmm(time)}</Text>
    </View>
  );
}

function HotelCard() {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip, room, room_type } = useMembership();
  const stars = trip.hotel_stars ?? 0;
  const at = (day: string, time: string | null | undefined) => (time ? `${formatDay(day, locale)} ${hhmm(time)}` : null);
  const rows: [string, string | null][] = [
    [t('address'), trip.hotel_address ?? null],
    [t('roomType'), [room_type, room].filter(Boolean).join(' · ') || null],
    [t('checkIn'), at(trip.starts_on, trip.check_in_time)],
    [t('checkOut'), at(trip.ends_on, trip.check_out_time)],
    [t('toLifts'), trip.hotel_lift_distance ?? null],
    [t('phoneLabel'), trip.hotel_phone ?? null],
  ];
  return (
    <Card style={{ gap: space.m }}>
      <View style={styles.row}>
        <Eyebrow>{t('stay')}</Eyebrow>
        {stars ? (
          <Text style={{ color: c.fg, fontSize: 13 }} accessibilityLabel={t('starsA11y', { n: stars })}>
            {'★'.repeat(stars)}
          </Text>
        ) : null}
      </View>
      <H2>{trip.hotel_name}</H2>
      <KeyValues rows={rows} />
      {trip.hotel_phone ? (
        <Button
          small
          variant="ghost"
          label={t('callPhone', { phone: trip.hotel_phone })}
          onPress={() => Linking.openURL(`tel:${trip.hotel_phone!.replace(/[^\d+]/g, '')}`).catch(() => {})}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
    </Card>
  );
}

/** Label / value list (the design's <dl class="kv">); empty values are left out. */
function KeyValues({ rows }: { rows: [string, string | null][] }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <View key={k} style={styles.kv}>
            <Text style={[styles.kvKey, { color: c.muted }]}>{k}</Text>
            <Text style={[styles.kvVal, { color: c.fg }]}>{v}</Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.m },
  strong: { fontSize: 15, fontWeight: '700' },
  flight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dash: { width: 30, borderTopWidth: 2, borderStyle: 'dashed' },
  code: { fontSize: 28, fontWeight: '800' },
  kv: { flexDirection: 'row', gap: 14 },
  kvKey: { width: 112, fontSize: 14 },
  kvVal: { flex: 1, fontSize: 14, fontWeight: '600' },
});
