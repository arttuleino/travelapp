import { View } from 'react-native';

import { LanguageList } from '@/components/language-picker';
import { Button, Card, Eyebrow, H1, H2, Muted, Screen } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
import { space } from '@/theme';

/** Profile: who is signed in, the app language and signing out. */
export default function Profile() {
  const { t } = useI18n();
  const { role, display_name, booking_ref, room, trip } = useMembership();
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
