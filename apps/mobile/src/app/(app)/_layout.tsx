import { Stack } from 'expo-router';

import { useTheme } from '@/design/theme';

/** Onboarding sonrası: sekmeler + sekmelerin üstünde açılan ayrıntı/düzenleme ekranları. */
export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="blocked" />
    </Stack>
  );
}
