import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './text';

/** Form üstü uyarı/hata kutusu. Ekran okuyucular değişikliği duyurur. */
export function Notice({
  message,
  tone = 'danger',
}: {
  message: string;
  tone?: 'danger' | 'info';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.accentSecondary;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.box,
        { borderColor: color, borderRadius: theme.radii.md, padding: theme.spacing.md },
      ]}
    >
      <Text variant="label" style={{ color }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1 },
});
