import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useTheme } from '@/design/theme';
import { createQueryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash zaten kapanmışsa (ör. hızlı yenileme) yapılacak bir şey yok.
});

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const theme = useTheme();
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
