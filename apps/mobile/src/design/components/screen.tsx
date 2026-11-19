import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

type ScreenProps = PropsWithChildren<{ style?: ViewStyle }>;

/** Güvenli alan + tema arka planı + yatay kenar boşluğu. Tüm ekranların kökü. */
export function Screen({ children, style }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { paddingHorizontal: theme.spacing.xl }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
