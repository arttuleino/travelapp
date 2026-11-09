import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Timeline } from '@/components/timeline';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useStops } from '@/lib/transit';
import { useLatestAnnouncement, useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { deviceTimeZone, formatDay, formatRange, tripDays } from '@/lib/time';
import { clockTime } from '@/lib/unread';
import { space, usePalette } from '@/theme';

export default function Now() {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip, role, booking_ref, display_name } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const notice = useLatestAnnouncement(trip.id);
  const { stops } = useStops(trip.id);

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
          <Eyebrow style={{ color: c.brandInk }}>{role === 'guide' ? t('guide') : booking_ref ? t('booking', { ref: booking_ref }) : display_name}</Eyebrow>
          {phase === 'during' ? <Text style={[styles.strong, { color: c.brandInk }]}>{t('dayOf', { n: dayIdx + 1, total: days.length })}</Text> : null}
        </View>
        <H1 style={{ color: c.brandInk }}>{trip.name}</H1>
        <Text style={[styles.meta, { color: c.brandInk }]}>
          {formatRange(trip.starts_on, trip.ends_on, locale)}
          {trip.hotel_name ? `  ·  ${trip.hotel_name}` : ''}
        </Text>
        <View style={styles.daybar} accessibilityLabel={phase === 'during' ? t('tripDayA11y', { n: dayIdx + 1, total: days.length }) : undefined}>
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
            {clockTime(notice.send_at, deviceTimeZone())}
            {notice.edited_at ? ` · ${t('edited')}` : ''}
          </Muted>
        </View>
      ) : null}

      {phase === 'during' ? (
        <View style={{ gap: space.m }}>
          <View style={styles.row}>
            <Text style={[styles.live, { color: c.live }]}>● {t('nowAt', { day: formatDay(clock.date, locale).toUpperCase(), time: clock.time })}</Text>
            <Button label={t('wholeWeek')} variant="ghost" small onPress={() => router.navigate('/programme')} />
          </View>
          <Timeline items={shownItems} nowTime={clock.time} />
        </View>
      ) : phase === 'before' ? (
        <View style={{ gap: space.m }}>
          <H2>{daysToGo === 1 ? t('startsTomorrow') : t('daysToGo', { n: daysToGo })}</H2>
          <Eyebrow>{t('firstDay', { day: formatDay(trip.starts_on, locale) })}</Eyebrow>
          <Timeline items={shownItems} />
        </View>
      ) : (
        <Card tone="cream">
          <H2>{t('thanks')}</H2>
          <Body>{t('tripOver')}</Body>
        </Card>
      )}

      {stops.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/buses')}>
          <Card tone="cream" style={{ gap: 4 }}>
            <Text style={[styles.strong, { color: c.fg }]}>{t('busesCard')} ›</Text>
            <Muted>{t('busesCardHint')}</Muted>
          </Card>
        </Pressable>
      ) : null}
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
