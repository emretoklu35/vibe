import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/design/theme';
import {
  configureNotificationHandling,
  conversationIdFrom,
  registerForPush,
} from '@/features/notifications/push';
import { connectRealtime } from '@/features/realtime/realtime';

configureNotificationHandling();

/** Onboarding sonrası: sekmeler + üstte açılan ekranlar. Canlı bağlantı ve bildirim yönlendirmesi burada. */
export default function AppLayout() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => connectRealtime(queryClient), [queryClient]);

  useEffect(() => {
    // İzin daha önce verildiyse cihaz kaydı sessizce yenilenir (izin istenmez).
    void registerForPush({ ask: false });
    if (Platform.OS === 'web') return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const id = conversationIdFrom(response);
      if (id) router.push({ pathname: '/chat/[id]', params: { id } });
    };
    // Uygulama bir bildirime dokunularak açıldıysa
    open(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="blocked" />
    </Stack>
  );
}
