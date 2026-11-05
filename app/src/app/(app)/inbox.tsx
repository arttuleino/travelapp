import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useAnnouncements, useGuideUnread, useMembers } from '@/lib/chat';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
import { deviceTimeZone, deviceToday } from '@/lib/time';
import type { Announcement } from '@/lib/types';
import { clockTime, dayLabel } from '@/lib/unread';
import { radius, space, usePalette } from '@/theme';

/** Guide: one conversation per booking, unread ones first. */
export default function Inbox() {
  const c = usePalette();
  const { t, locale } = useI18n();
  const words = { today: t('today'), yesterday: t('yesterday'), tomorrow: t('tomorrow') };
  const { trip } = useMembership();
  const me = useAuth().session?.user.id ?? '';
  const travellers = useMembers(trip.id).filter((m) => m.role === 'traveller');
  const { byConversation, unread } = useGuideUnread(trip.id, me);

  const rows = travellers
    .map((tr) => ({ tr, last: byConversation.get(tr.id)?.at(-1) ?? null, unread: unread(tr.id) }))
    .sort((a, b) => b.unread - a.unread || (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') || a.tr.display_name.localeCompare(b.tr.display_name));
  const pax = travellers.reduce((s, tr) => s + tr.party_size, 0);

  // Scheduled ones (soonest first) and the three latest sent ones, timed by the real clock.
  const announcements = useAnnouncements(trip.id);
  const nowIso = new Date().toISOString();
  const tz = deviceTimeZone();
  const realToday = deviceToday();
  const scheduled = announcements.filter((a) => a.send_at > nowIso);
  const recent = announcements.filter((a) => a.send_at <= nowIso).slice(-3).reverse();
  const at = (a: Announcement) => `${dayLabel(a.send_at, realToday, tz, words, locale)} ${clockTime(a.send_at, tz)}`;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('tabMessages')}</Eyebrow>
        <H1>{t('travellers')}</H1>
        <Muted>{t('bookingsAndPax', { bookings: travellers.length, pax })}</Muted>
      </View>
      <Button label={t('sendAnnouncement')} onPress={() => router.push('/announce')} />
      {scheduled.length || recent.length ? (
        <View style={{ gap: space.s }}>
          <Eyebrow>{t('announcements')}</Eyebrow>
          {[...scheduled, ...recent].map((a) => {
            const isScheduled = a.send_at > nowIso;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={t(isScheduled ? 'scheduledA11y' : 'sentA11y', { title: a.title, at: at(a) })}
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
                    {isScheduled ? t('scheduled') : a.edited_at ? t('editedCap') : t('sent')}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{at(a)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Eyebrow>{t('conversations')}</Eyebrow>
      <View style={{ gap: space.s }}>
        {rows.map(({ tr, last, unread: n }) => {
          const lastDay = last ? dayLabel(last.created_at, realToday, tz, words, locale) : '';
          const when = last ? (lastDay === words.today ? clockTime(last.created_at, tz) : lastDay) : '';
          return (
            <Pressable
              key={tr.id}
              accessibilityRole="button"
              accessibilityLabel={`${tr.display_name}${n ? `, ${t('unread', { n })}` : ''}`}
              onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: tr.id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: c.card, opacity: pressed ? 0.8 : 1 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }}>
                  {tr.display_name}
                  {tr.room ? <Text style={{ color: c.muted, fontWeight: '500' }}>{`  ${t('roomShort', { room: tr.room })}`}</Text> : null}
                </Text>
                <Text numberOfLines={1} style={{ color: n ? c.fg : c.muted, fontSize: 13, fontWeight: n ? '600' : '400' }}>
                  {last ? `${last.sender_role === 'guide' ? t('youPrefix') : ''}${last.body}` : t('noMessages')}
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
