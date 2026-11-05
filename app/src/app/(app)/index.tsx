import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Timeline } from '@/components/timeline';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { useLatestAnnouncement, useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { formatDay, formatRange, tripDays } from '@/lib/time';
import { space, usePalette } from '@/theme';

export default function Now() {
  const c = usePalette();
  const { trip, role, booking_ref, display_name } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const notice = useLatestAnnouncement(trip.id);

  const days = tripDays(trip.starts_on, trip.ends_on);
  const dayIdx = days.indexOf(clock.date);
  const phase = clock.date < trip.starts_on ? 'before' : clock.date > trip.ends_on ? 'after' : 'during';
  const shownDay = phase === 'during' ? clock.date : phase === 'before' ? trip.starts_on : null;
  const shownItems = shownDay ? items.filter((i) => i.day === shownDay) : [];
  const daysToGo = Math.round((Date.parse(trip.starts_on) - Date.parse(clock.date)) / 86_400_000);

  return (
    <Screen>
      <Card tone="brand" style={{ gap: space.m }}>
        <View style={styles.row}>
          <Eyebrow style={{ color: c.brandInk }}>{role === 'guide' ? 'Opas' : booking_ref ? `Varaus ${booking_ref}` : display_name}</Eyebrow>
          {phase === 'during' ? <Text style={[styles.strong, { color: c.brandInk }]}>Päivä {dayIdx + 1}/{days.length}</Text> : null}
        </View>
        <H1 style={{ color: c.brandInk }}>{trip.name}</H1>
        <Text style={[styles.meta, { color: c.brandInk }]}>
          {formatRange(trip.starts_on, trip.ends_on)}
          {trip.hotel_name ? `  ·  ${trip.hotel_name}` : ''}
        </Text>
        <View style={styles.daybar} accessibilityLabel={phase === 'during' ? `Matkan päivä ${dayIdx + 1}/${days.length}` : undefined}>
          {days.map((d, i) => (
            <View
              key={d}
              style={[styles.dayseg, { backgroundColor: c.brandInk, opacity: phase === 'after' || i < dayIdx ? 1 : i === dayIdx ? 0.55 : 0.18 }]}
            />
          ))}
        </View>
      </Card>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: c.warnBg, borderColor: c.warn }]} accessibilityRole="alert">
          <Text style={[styles.strong, { color: c.fg }]}>{notice.title}</Text>
          <Body>{notice.body}</Body>
          <Muted>
            {notice.author_name ? `${notice.author_name}, ` : ''}
            {new Date(notice.created_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: trip.timezone })}
          </Muted>
        </View>
      ) : null}

      {phase === 'during' ? (
        <View style={{ gap: space.m }}>
          <View style={styles.row}>
            <Text style={[styles.live, { color: c.live }]}>● NYT · {formatDay(clock.date).toUpperCase()} KLO {clock.time}</Text>
            <Button label="Koko viikko" variant="ghost" small onPress={() => router.navigate('/programme')} />
          </View>
          <Timeline items={shownItems} nowTime={clock.time} />
        </View>
      ) : phase === 'before' ? (
        <View style={{ gap: space.m }}>
          <H2>{daysToGo === 1 ? 'Matka alkaa huomenna' : `Matkaan on ${daysToGo} päivää`}</H2>
          <Eyebrow>Ensimmäinen päivä · {formatDay(trip.starts_on)}</Eyebrow>
          <Timeline items={shownItems} />
        </View>
      ) : (
        <Card tone="cream">
          <H2>Kiitos matkasta!</H2>
          <Body>Matka on päättynyt. Ohjelma on yhä nähtävissä Ohjelma-välilehdellä.</Body>
        </Card>
      )}

      <Button label="Kirjaudu ulos" variant="ghost" small onPress={signOut} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s },
  strong: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 13, fontWeight: '600' },
  daybar: { flexDirection: 'row', gap: 4 },
  dayseg: { flex: 1, height: 6, borderRadius: 9 },
  notice: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 4 },
  live: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
});
