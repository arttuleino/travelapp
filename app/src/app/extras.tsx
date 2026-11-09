import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Card, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { money } from '@/lib/cashbook';
import { summarize } from '@/lib/extras-calc';
import { useExtras, useSignups } from '@/lib/extras';
import { useI18n } from '@/lib/i18n';
import { formatDay } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import { space, usePalette } from '@/theme';

/** Guide: the trip's paid extras (bar crawl, Ribs & Rodel...) and who still owes for them. */
export default function ExtrasScreen() {
  const { t } = useI18n();
  const { role } = useMembership();
  if (role !== 'guide')
    return (
      <Screen>
        <Muted>{t('onlyGuideFinance')}</Muted>
      </Screen>
    );
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('groupEyebrow')}</Eyebrow>
        <H1>{t('extrasSeg')}</H1>
      </View>
      <Extras />
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function Extras() {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip } = useMembership();
  const { extras, loading } = useExtras(trip.id);
  const signups = useSignups(trip.id);

  return (
    <View style={{ gap: space.s }}>
      <Button small label={`+ ${t('newExtra')}`} onPress={() => router.push('/extra-edit')} style={{ alignSelf: 'flex-start' }} />
      {!loading && extras.length === 0 ? <Muted>{t('noExtras')}</Muted> : null}
      {extras.map((x) => {
        const s = summarize(
          x,
          signups.filter((v) => v.extra_id === x.id),
        );
        const when = [formatDay(x.day, locale), x.starts_at?.slice(0, 5)].filter(Boolean).join(' ');
        return (
          <Pressable key={x.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/extra/[id]', params: { id: x.id } })}>
            {({ pressed }) => (
              <Card style={{ gap: 4, opacity: pressed ? 0.75 : 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: space.m,
                  }}>
                  <Body style={{ fontWeight: '700', flexShrink: 1 }}>{x.title}</Body>
                  <Muted>{t('perPerson', { price: money(Number(x.price), locale) })}</Muted>
                </View>
                <Muted>{`${when} · ${t('extraParticipants', { n: s.bookings, persons: s.persons })}`}</Muted>
                {s.bookings ? (
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 13,
                      color: s.unpaid ? c.live : c.ok,
                    }}>
                    {s.unpaid ? `${t('extraUnpaid', { n: s.unpaid })} · ${money(s.outstanding, locale)} €` : `✓ ${t('allPaid')}`}
                  </Text>
                ) : null}
              </Card>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
