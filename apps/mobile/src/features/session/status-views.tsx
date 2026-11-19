import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/design/components/button';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';

export function LoadingView() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Yükleniyor" />
    </View>
  );
}

export function UnreachableView({ onRetry, busy }: { onRetry: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <Screen style={styles.center}>
      <View style={{ gap: theme.spacing.lg, alignItems: 'center' }}>
        <Text variant="headline" align="center">
          Sunucuya ulaşılamıyor
        </Text>
        <Text variant="body" color="textMuted" align="center">
          İnternet bağlantını kontrol edip tekrar dene. Oturumun açık kalır.
        </Text>
        <Button label="Tekrar dene" onPress={onRetry} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
