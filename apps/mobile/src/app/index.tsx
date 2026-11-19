import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useApiLiveness } from '@/api/health';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { useSessionStore } from '@/features/session/session-store';

export default function LandingScreen() {
  const theme = useTheme();
  const signOutReason = useSessionStore((s) => s.signOutReason);

  return (
    <Screen style={styles.screen}>
      <View style={styles.brand}>
        <View
          style={[styles.glow, { backgroundColor: theme.colors.accent }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text variant="display" align="center" accessibilityRole="header">
          VIBE
        </Text>
        <Text variant="headline" color="textMuted" align="center" style={styles.tagline}>
          More than a match.{'\n'}
          <Text variant="headline" color="accent">
            Real chemistry.
          </Text>
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        {signOutReason ? <Notice message={signOutReason} tone="info" /> : null}
        <Button label="Telefon numaranla devam et" onPress={() => router.push('/phone')} />
        <Text variant="caption" color="textMuted" align="center">
          VIBE yalnızca 18 yaş ve üzeri içindir.
        </Text>
        {__DEV__ ? <DevApiStatus /> : null}
      </View>
    </Screen>
  );
}

/** Yalnızca geliştirme derlemelerinde: API bağlantı ayarını hızlıca doğrulamak için. */
function DevApiStatus() {
  const liveness = useApiLiveness();
  const label = liveness.isPending
    ? 'API kontrol ediliyor…'
    : liveness.isSuccess
      ? 'API bağlı'
      : 'API’ye ulaşılamıyor (EXPO_PUBLIC_API_URL?)';
  return (
    <Text variant="caption" color={liveness.isError ? 'danger' : 'textMuted'} align="center">
      [geliştirme] {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingVertical: 48 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.12 },
  tagline: { marginTop: 16 },
});
