import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator } from 'react-native';

import { TabBar } from '@/components/tab-bar';
import { Body, Button, Centered, H2, Muted } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { useTrip } from '@/lib/trip';

export default function AppLayout() {
  const { loading, error, membership, reload } = useTrip();
  const { session } = useAuth();

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <H2>Matkan tietoja ei saatu ladattua</H2>
        <Muted style={{ textAlign: 'center' }}>Tarkista verkkoyhteys ja yritä uudelleen.</Muted>
        <Button label="Yritä uudelleen" onPress={reload} />
      </Centered>
    );
  }
  if (!membership) {
    return (
      <Centered>
        <H2>Varausta ei löytynyt</H2>
        <Body style={{ textAlign: 'center' }}>
          Osoitteella {session?.user.email} ei löytynyt matkaa. Kirjaudu samalla sähköpostiosoitteella, jonka annoit varausta tehdessäsi.
        </Body>
        <Button label="Kirjaudu toisella osoitteella" variant="ghost" onPress={signOut} />
      </Centered>
    );
  }

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Nyt' }} />
      <Tabs.Screen name="programme" options={{ title: 'Ohjelma' }} />
    </Tabs>
  );
}
