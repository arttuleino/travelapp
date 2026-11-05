import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useAnnouncements, useGuideUnread, useMembers } from '@/lib/chat';
import { useMembership, useTripClock } from '@/lib/trip';
import { tripClock } from '@/lib/time';
import type { Announcement } from '@/lib/types';
import { clockTime, dayLabel } from '@/lib/unread';
import { radius, space, usePalette } from '@/theme';

/** Guide: one conversation per booking, unread ones first. */
export default function Inbox() {
  const c = usePalette();
  const { trip } = useMembership();
  const me = useAuth().session?.user.id ?? '';
  const clock = useTripClock(trip.timezone);
  const travellers = useMembers(trip.id).filter((m) => m.role === 'traveller');
  const { byConversation, unread } = useGuideUnread(trip.id, me);

  const rows = travellers
    .map((t) => ({ t, last: byConversation.get(t.id)?.at(-1) ?? null, unread: unread(t.id) }))
    .sort((a, b) => b.unread - a.unread || (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') || a.t.display_name.localeCompare(b.t.display_name));
  const pax = travellers.reduce((s, t) => s + t.party_size, 0);

  // Scheduled ones (soonest first) and the three latest sent ones, timed by the real clock.
  const announcements = useAnnouncements(trip.id);
  const nowIso = new Date().toISOString();
  const realToday = tripClock(trip.timezone, new Date()).date;
  const scheduled = announcements.filter((a) => a.send_at > nowIso);
  const recent = announcements.filter((a) => a.send_at <= nowIso).slice(-3).reverse();
  const at = (a: Announcement) => `${dayLabel(a.send_at, realToday, trip.timezone)} ${clockTime(a.send_at, trip.timezone)}`;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>Viestit</Eyebrow>
        <H1>Matkustajat</H1>
        <Muted>
          {travellers.length} varausta · {pax} matkustajaa
        </Muted>
      </View>
      <Button label="Lähetä tiedote koko ryhmälle" onPress={() => router.push('/announce')} />
      {scheduled.length || recent.length ? (
        <View style={{ gap: space.s }}>
          <Eyebrow>Tiedotteet</Eyebrow>
          {[...scheduled, ...recent].map((a) => {
            const isScheduled = a.send_at > nowIso;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.title}, ${isScheduled ? 'ajastettu' : 'lähetetty'} ${at(a)}. Muokkaa`}
                onPress={() => router.push({ pathname: '/announce', params: { id: a.id } })}
                style={({ pressed }) => [styles.row, { backgroundColor: isScheduled ? c.cream : c.card, opacity: pressed ? 0.8 : 1 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }}>{a.title}</Text>
                  <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
                    {a.body}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: isScheduled ? c.fg : c.muted, fontSize: 12, fontWeight: isScheduled ? '700' : '400' }}>
                    {isScheduled ? 'Ajastettu' : a.edited_at ? 'Muokattu' : 'Lähetetty'}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{at(a)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Eyebrow>Keskustelut</Eyebrow>
      <View style={{ gap: space.s }}>
        {rows.map(({ t, last, unread: n }) => {
          const when = last ? (dayLabel(last.created_at, clock.date, trip.timezone) === 'Tänään' ? clockTime(last.created_at, trip.timezone) : dayLabel(last.created_at, clock.date, trip.timezone)) : '';
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.display_name}${n ? `, ${n} lukematonta` : ''}`}
              onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: t.id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: c.card, opacity: pressed ? 0.8 : 1 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }}>
                  {t.display_name}
                  {t.room ? <Text style={{ color: c.muted, fontWeight: '500' }}>{`  h. ${t.room}`}</Text> : null}
                </Text>
                <Text numberOfLines={1} style={{ color: n ? c.fg : c.muted, fontSize: 13, fontWeight: n ? '600' : '400' }}>
                  {last ? `${last.sender_role === 'guide' ? 'Sinä: ' : ''}${last.body}` : 'Ei viestejä'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 12 }}>{when}</Text>
                {n ? (
                  <View style={[styles.badge, { backgroundColor: c.live }]}>
                    <Text style={styles.badgeText}>{n}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m, padding: 14, borderRadius: radius.card, alignItems: 'center' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
});
