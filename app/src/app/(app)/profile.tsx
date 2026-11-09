import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { LanguageList } from '@/components/language-picker';
import { Body, Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useMembers } from '@/lib/chat';
import { summarize } from '@/lib/extras-calc';
import { useExtras, useSignups } from '@/lib/extras';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
import { DEMO_MODE } from '@/lib/supabase';
import { CUSTOMER_SERVICE, hoursText, isOpen, marketFor } from '@/lib/support';
import { space, usePalette } from '@/theme';

/** Profile: who is signed in, the app language and signing out. */
export default function Profile() {
  const { t } = useI18n();
  const { role, display_name, booking_ref, room, trip, market } = useMembership();
  const email = useAuth().session?.user.email ?? '';

  const details = [
    role === 'guide' ? t('guide') : t('traveller'),
    booking_ref ? t('booking', { ref: booking_ref }) : null,
    room ? t('room', { room }) : null,
  ].filter(Boolean);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('profile')}</Eyebrow>
        <H1>{display_name}</H1>
        <Muted>{details.join(' · ')}</Muted>
        <Muted>{trip.name}</Muted>
      </View>

      {role === 'guide' && !DEMO_MODE ? <GuideLinks /> : null}
      {role === 'traveller' ? <CustomerService market={market} /> : null}

      <View style={{ gap: space.s }}>
        <H2>{t('language')}</H2>
        <Muted>{t('languageHint')}</Muted>
        <LanguageList />
      </View>

      <Card tone="cream" style={{ gap: space.s }}>
        <Muted>{t('signedInAs', { email })}</Muted>
        <Button label={t('signOut')} variant="danger" onPress={signOut} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </Screen>
  );
}

/** Guide: this week's guests and the paid extras, one tap away. */
function GuideLinks() {
  const { t } = useI18n();
  const { trip } = useMembership();
  const guests = useMembers(trip.id).filter((m) => m.role === 'traveller');
  const { extras } = useExtras(trip.id);
  const signups = useSignups(trip.id);
  const people = guests.reduce((n, g) => n + g.party_size, 0);
  const unpaid = extras.reduce(
    (n, x) =>
      n +
      summarize(
        x,
        signups.filter((s) => s.extra_id === x.id),
      ).unpaid,
    0,
  );
  return (
    <View style={{ gap: space.s }}>
      <LinkRow title={t('guestsSeg')} detail={t('guestsSummary', { people, bookings: guests.length })} onPress={() => router.push('/guests')} />
      <LinkRow
        title={t('extrasSeg')}
        detail={unpaid ? t('extraUnpaid', { n: unpaid }) : extras.length ? t('allPaid') : t('newExtra')}
        alert={unpaid > 0}
        onPress={() => router.push('/extras')}
      />
    </View>
  );
}

function LinkRow({ title, detail, alert, onPress }: { title: string; detail: string; alert?: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.m,
            opacity: pressed ? 0.75 : 1,
          }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.fg, fontSize: 16, fontWeight: '800' }}>{title}</Text>
            <Text
              style={{
                color: alert ? c.live : c.muted,
                fontSize: 13,
                fontWeight: alert ? '700' : '400',
              }}>
              {detail}
            </Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 22 }}>›</Text>
        </Card>
      )}
    </Pressable>
  );
}

/** The operator's customer service for the traveller's booking market (Finland, Sweden or Norway). */
function CustomerService({ market }: { market: string | null }) {
  const c = usePalette();
  const { t, lang } = useI18n();
  const m = marketFor(market, lang);
  const s = CUSTOMER_SERVICE[m];
  const open = isOpen(s, new Date());
  const go = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <Card style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.m }}>
        <H2>{t('supportTitle')}</H2>
        <Text style={{ color: open ? c.ok : c.muted, fontSize: 13, fontWeight: '700' }}>{open ? `● ${t('openNow')}` : t('closedNow')}</Text>
      </View>
      <Muted>{s.brand}</Muted>
      <Body>{t('supportHours', { hours: hoursText(s), tz: t(m === 'FI' ? 'tzFI' : m === 'SE' ? 'tzSE' : 'tzNO') })}</Body>
      <Button label={t('callPhone', { phone: s.phoneLocal })} onPress={() => go(`tel:${s.phone}`)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Button small variant="ghost" label={t('sendEmail')} onPress={() => go(`mailto:${s.email}`)} />
        <Button small variant="ghost" label={`${t('contactPage')} ›`} onPress={() => go(s.contactUrl)} />
      </View>
      <Muted>{s.email}</Muted>
      <Muted>{t('supportHint')}</Muted>
    </Card>
  );
}
