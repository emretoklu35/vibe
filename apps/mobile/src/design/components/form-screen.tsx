import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { Screen } from './screen';
import { Text } from './text';

type FormScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Altta sabit kalan alan (birincil düğme). */
  footer?: ReactNode;
  /** Üstte küçük adım etiketi, ör. "1 / 2". */
  step?: string;
}>;

/** Başlık + kaydırılabilir içerik + klavyeyle yukarı kayan alt düğme alanı. */
export function FormScreen({ title, subtitle, footer, step, children }: FormScreenProps) {
  const theme = useTheme();
  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        // Expo uygulamaları Android'de kenardan kenara çizilir; iki platformda da behavior gerekir (Expo klavye rehberi).
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingTop: theme.spacing.xxl, gap: theme.spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: theme.spacing.sm }}>
            {step ? (
              <Text variant="caption" color="accent">
                {step}
              </Text>
            ) : null}
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </ScrollView>
        {footer ? (
          <View style={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.md }}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
