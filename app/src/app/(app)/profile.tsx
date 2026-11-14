import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';

import { CustomerService } from '@/components/customer-service';
import { LanguageList } from '@/components/language-picker';
import { Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { useMembers } from '@/lib/chat';
import { summarize } from '@/lib/extras-calc';
import { useAnswers } from '@/lib/answers';
import { useExtras, useSignups } from '@/lib/extras';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
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

      {role === 'guide' ? <GuideLinks /> : null}
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
  const answers = useAnswers(trip.id).rows;
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
      <LinkRow
        title={t('answerBank')}
        detail={answers.length ? t('answerBankSummary', { n: answers.length }) : t('answerNew')}
        onPress={() => router.push('/answers')}
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
