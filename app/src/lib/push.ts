import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Push notifications run only on a real phone. On the web and in simulators every function here is a no-op.
const supported = Platform.OS !== 'web' && Device.isDevice;

// Loaded lazily so the web bundle never touches the native module.
type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null = null;
async function notifications(): Promise<NotificationsModule | null> {
  if (!supported) return null;
  if (!mod) {
    mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }
  return mod;
}

let currentToken: string | null = null;

/**
 * Asks for permission (once) and stores this phone's Expo push token for the signed-in user.
 * Needs an EAS project id in app.json (extra.eas.projectId); see README.
 */
export async function registerForPush(): Promise<'registered' | 'denied' | 'unavailable'> {
  const N = await notifications();
  if (!N) return 'unavailable';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('Push-ilmoitukset pois käytöstä: app.json-tiedostosta puuttuu extra.eas.projectId.');
    return 'unavailable';
  }
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', { name: 'Matkan ilmoitukset', importance: N.AndroidImportance.HIGH });
  }
  let { granted } = await N.getPermissionsAsync();
  if (!granted) ({ granted } = await N.requestPermissionsAsync());
  if (!granted) return 'denied';

  const { data: token } = await N.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) throw error;
  currentToken = token;
  return 'registered';
}

/** Removes this phone's token before signing out, so the next person on the phone does not get our notifications. */
export async function unregisterPush() {
  if (!currentToken) return;
  await supabase.from('push_tokens').delete().eq('token', currentToken);
  currentToken = null;
}

/** Opens the screen a notification points to (data.url) when the person taps it, including on cold start. */
export async function listenForNotificationTaps(): Promise<() => void> {
  const N = await notifications();
  if (!N) return () => {};
  const open = (url: unknown) => {
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
  };
  const last = N.getLastNotificationResponse();
  if (last) {
    open(last.notification.request.content.data?.url);
    N.clearLastNotificationResponse();
  }
  const sub = N.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.url));
  return () => sub.remove();
}
