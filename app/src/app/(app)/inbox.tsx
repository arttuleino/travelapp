import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useGuideUnread, useMembers } from '@/lib/chat';
import { useMembership, useTripClock } from '@/lib/trip';
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
