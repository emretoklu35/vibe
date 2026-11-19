import { StyleSheet, View } from 'react-native';

import { useApiLiveness } from '@/api/health';
import { ApiError } from '@/api/client';
import { Button } from '@/design/components/button';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';

/**
 * Faz 1 giriş ekranı: marka + API bağlantı durumu.
 * Kayıt/giriş akışı Faz 2'de bu ekranın yerini alır.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const liveness = useApiLiveness();

  const status = liveness.isPending
    ? { label: 'Sunucu kontrol ediliyor…', color: theme.colors.textMuted }
    : liveness.isSuccess
      ? { label: 'Sunucuya bağlı', color: theme.colors.success }
      : {
          label:
            liveness.error instanceof ApiError
              ? `${liveness.error.message} (${liveness.error.code})`
              : 'Sunucuya ulaşılamadı',
          color: theme.colors.danger,
        };

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

      <View
        style={[
          styles.statusCard,
          { backgroundColor: theme.colors.surface, gap: theme.spacing.md },
        ]}
      >
        <Text variant="caption" color="textMuted">
          GELİŞTİRME ORTAMI
        </Text>
        <View style={styles.statusRow} accessible accessibilityLabel={status.label}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <Text variant="label" style={styles.statusText}>
            {status.label}
          </Text>
        </View>
        {liveness.isError ? (
          <Button
            label="Tekrar dene"
            variant="secondary"
            loading={liveness.isFetching}
            onPress={() => void liveness.refetch()}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingVertical: 48 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.12,
  },
  tagline: { marginTop: 16 },
  statusCard: { borderRadius: 22, padding: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flexShrink: 1 },
});
