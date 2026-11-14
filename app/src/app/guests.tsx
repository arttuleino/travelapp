import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Button, Eyebrow, Field, H1, Muted, Screen } from '@/components/ui';
import { useMembers } from '@/lib/chat';
import { useI18n } from '@/lib/i18n';
import { Grid } from '@/lib/layout';
import { useMembership } from '@/lib/trip';
import type { Member } from '@/lib/types';
import { space, usePalette } from '@/theme';

/** Guide: everyone on this week's trip, with room, booking and contact details. */
export default function GuestsScreen() {
  const { t } = useI18n();
  const { role } = useMembership();
  if (role !== 'guide')
    return (
      <Screen>
        <Muted>{t('onlyGuideFinance')}</Muted>
      </Screen>
    );
  return (
    <Screen width="page">
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('groupEyebrow')}</Eyebrow>
        <H1>{t('guestsSeg')}</H1>
      </View>
      <Guests />
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const travellersOf = (members: Member[]) => members.filter((m) => m.role === 'traveller').sort((a, b) => a.display_name.localeCompare(b.display_name, 'fi'));

function Guests() {
  const c = usePalette();
  const { t } = useI18n();
  const { trip } = useMembership();
  const guests = travellersOf(useMembers(trip.id));
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? guests.filter((g) => [g.display_name, g.room, g.booking_ref, g.email].some((v) => v?.toLowerCase().includes(needle))) : guests;
  const people = guests.reduce((n, g) => n + g.party_size, 0);

  return (
    <View style={{ gap: space.s }}>
      <Muted>{t('guestsSummary', { people, bookings: guests.length })}</Muted>
      <View style={{ maxWidth: 520 }}>
        <Field label="" value={q} onChangeText={setQ} placeholder={t('searchGuests')} autoCorrect={false} />
      </View>
      {shown.length === 0 ? <Muted>{t('noGuestMatch')}</Muted> : null}
      <Grid cols={3}>
      {shown.map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/conversation/[id]',
              params: { id: g.id },
            })
          }
          style={({ pressed }) => ({
            padding: space.m,
            borderRadius: 14,
            backgroundColor: c.card,
            gap: 2,
            opacity: pressed ? 0.75 : 1,
          })}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: space.m,
            }}>
            <Body style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
              {g.display_name}
            </Body>
            <Muted>{t('persons', { n: g.party_size })}</Muted>
          </View>
          <Muted numberOfLines={1}>{[g.room && t('room', { room: g.room }), g.booking_ref && `#${g.booking_ref}`].filter(Boolean).join(' · ')}</Muted>
          <Muted numberOfLines={1}>{[g.phone, g.email].filter(Boolean).join(' · ')}</Muted>
        </Pressable>
      ))}
      </Grid>
    </View>
  );
}
