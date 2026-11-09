import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Centered } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { TripProvider } from '@/lib/trip';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
      <AuthProvider>
        <TripProvider>
          <StatusBar style="auto" />
          <RootStack />
        </TripProvider>
      </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { session, ready } = useAuth();
  if (!ready) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="edit-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="announce" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="finance-settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="buses" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
