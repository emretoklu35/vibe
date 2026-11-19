import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDevice } from '@/api/chat';

export type PushRegistration = 'registered' | 'denied' | 'unsupported' | 'failed';

/**
 * Push izni ve cihaz kaydı. Uygulama içi olaylar socket ile geldiği için ön plandayken bildirim
 * afişi gösterilmez; yalnızca arka planda/kapalıyken sistem bildirimi görünür.
 * Not: getDevicePushTokenAsync geliştirme derlemesi (development build) ve Firebase/APNs yapılandırması
 * ister; Expo Go'da ve web'de çalışmaz (açık karar #11).
 */
export function configureNotificationHandling(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
}

export async function pushPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const status = await Notifications.getPermissionsAsync();
  return status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

export async function registerForPush(options: { ask: boolean }): Promise<PushRegistration> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    // Android: kanal, token alınmadan ve izin istenmeden önce oluşturulmalı.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Eşleşmeler ve mesajlar',
        importance: AndroidImportance.HIGH,
      });
    }
    let granted = await pushPermissionGranted();
    if (!granted && options.ask) {
      const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      granted = result.granted;
    }
    if (!granted) return 'denied';

    const token = await Notifications.getDevicePushTokenAsync();
    await registerDevice({
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      pushToken: String(token.data),
    });
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** Bildirime dokunulunca açılacak sohbet (veri yükündeki conversationId). */
export function conversationIdFrom(
  response: Notifications.NotificationResponse | null | undefined,
) {
  const data = response?.notification.request.content.data as
    { conversationId?: unknown } | undefined;
  return typeof data?.conversationId === 'string' ? data.conversationId : undefined;
}
