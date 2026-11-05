import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { TabBar } from '@/components/tab-bar';
import { Body, Button, Centered, H2, Muted } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { useGuideUnread, useTravellerUnread } from '@/lib/chat';
import { listenForNotificationTaps, registerForPush } from '@/lib/push';
import { useMembership, useTrip } from '@/lib/trip';

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

  return <TripTabs />;
}

function TripTabs() {
  const { trip, role, id: conversationId } = useMembership();
  const me = useAuth().session?.user.id ?? '';
  const guide = role === 'guide';
  const travellerUnread = useTravellerUnread(trip.id, conversationId, me);
  const guideUnread = useGuideUnread(trip.id, me).total;

  // Ask for notification permission once the trip is open, and follow taps on notifications.
  useEffect(() => {
    registerForPush().catch((e) => console.warn('Push-rekisteröinti epäonnistui', e));
    let stop = () => {};
    listenForNotificationTaps().then((s) => (stop = s));
    return () => stop();
  }, []);

  const badge = (n: number) => (n > 0 ? n : undefined);
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Nyt' }} />
      <Tabs.Screen name="programme" options={{ title: 'Ohjelma' }} />
      <Tabs.Screen name="chat" options={{ title: 'Opas', href: guide ? null : undefined, tabBarBadge: badge(travellerUnread) }} />
      <Tabs.Screen name="inbox" options={{ title: 'Viestit', href: guide ? undefined : null, tabBarBadge: badge(guideUnread) }} />
    </Tabs>
  );
}
