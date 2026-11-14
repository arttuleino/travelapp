import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Centered } from '@/components/ui';
import { useAppFonts } from '@/fonts';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { TripProvider } from '@/lib/trip';

export default function RootLayout() {
  // Wait for the app typefaces so text does not jump from the system font on start.
  if (!useAppFonts()) return null;
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
        <Stack.Screen name="guests" />
        <Stack.Screen name="extras" />
        <Stack.Screen name="extra-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="extra/[id]" />
        <Stack.Screen name="answers" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
