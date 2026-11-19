import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '@/design/theme';
import { restoreSession } from '@/features/session/session';
import { useSessionStore } from '@/features/session/session-store';
import { LoadingView, UnreachableView } from '@/features/session/status-views';
import { meQueryKey, useMe } from '@/features/session/use-me';
import { createQueryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash zaten kapanmışsa (ör. hızlı yenileme) yapılacak bir şey yok.
});

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const theme = useTheme();
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...base,
          colors: {
            ...base.colors,
            primary: theme.colors.accent,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.text,
            border: theme.colors.border,
          },
        }}
      >
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Hangi ekranların erişilebilir olduğu oturum ve hesap durumuna göre belirlenir.
 * Koruma değişince Expo Router kullanıcıyı ilk erişilebilir ekrana yönlendirir
 * (ör. kod doğrulandı → doğum tarihi; rızalar verildi → ana ekran).
 * Bu yalnızca istemci tarafı yönlendirmedir; asıl yetki kontrolü API'dedir.
 */
function RootNavigator() {
  const status = useSessionStore((s) => s.status);
  const queryClient = useQueryClient();
  const me = useMe();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (status === 'signedOut') queryClient.removeQueries({ queryKey: meQueryKey });
  }, [status, queryClient]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') return null;

  if (status === 'unreachable' || (status === 'signedIn' && me.isError)) {
    return (
      <UnreachableView
        busy={retrying || me.isFetching}
        onRetry={async () => {
          setRetrying(true);
          if (status === 'unreachable') await restoreSession();
          else await me.refetch();
          setRetrying(false);
        }}
      />
    );
  }

  if (status === 'signedIn' && !me.data) return <LoadingView />;

  const account = status === 'signedIn' ? me.data : undefined;
  const pendingDeletion = account?.status === 'DELETION_PENDING';
  const step = pendingDeletion ? undefined : account?.onboardingStep;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!account}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/phone" />
        <Stack.Screen name="(auth)/code" />
      </Stack.Protected>

      <Stack.Protected guard={pendingDeletion}>
        <Stack.Screen name="deletion-pending" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'BIRTH_DATE'}>
        <Stack.Screen name="(onboarding)/birth-date" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'CONSENTS'}>
        <Stack.Screen name="(onboarding)/consents" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'PROFILE'}>
        <Stack.Screen name="(onboarding)/profile" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'PHOTOS'}>
        <Stack.Screen name="(onboarding)/photos" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'PREFERENCES'}>
        <Stack.Screen name="(onboarding)/preferences" />
      </Stack.Protected>

      <Stack.Protected guard={step === 'COMPLETE'}>
        <Stack.Screen name="(app)/home" />
        <Stack.Screen name="(app)/profile-edit" />
        <Stack.Screen name="(app)/photos" />
        <Stack.Screen name="(app)/preferences" />
      </Stack.Protected>

      <Stack.Screen name="legal/[type]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
