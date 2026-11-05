import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Centered } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { TripProvider } from '@/lib/trip';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TripProvider>
          <StatusBar style="auto" />
          <RootStack />
        </TripProvider>
      </AuthProvider>
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
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
