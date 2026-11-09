import { router } from 'expo-router';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Timeline } from '@/components/timeline';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { localTransportFor } from '@/lib/local-transport';
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

      <LocalTransport destination={trip.destination} />
    </Screen>
  );
}

/** Recommends the destination's own public transport app (and the ski bus timetable) instead of timetables in this app. */
function LocalTransport({ destination }: { destination: string }) {
  const c = usePalette();
  const { t } = useI18n();
  const info = localTransportFor(destination);
  if (!info) return null;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const stores = info.app
    ? Platform.OS === 'ios'
      ? [['App Store', info.app.ios]]
      : Platform.OS === 'android'
        ? [['Google Play', info.app.android]]
        : [
            ['App Store', info.app.ios],
            ['Google Play', info.app.android],
          ]
    : [];
  return (
    <Card tone="cream" style={{ gap: space.s }}>
      <Text style={[styles.strong, { color: c.fg }]}>{t('transportTitle')}</Text>
      <Body>{info.app ? t('transportApp', { app: info.app.name }) : t('transportNoApp')}</Body>
      {info.skibusFree ? <Muted>{t('skibusFree')}</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {stores.map(([label, url]) => (
          <Button key={label} small label={`${label} ›`} onPress={() => open(url)} />
        ))}
        {info.skibusUrl ? <Button small variant="ghost" label={`${t('skibusLink')} ›`} onPress={() => open(info.skibusUrl!)} /> : null}
      </View>
    </Card>
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
