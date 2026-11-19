import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './text';

type CheckboxRowProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Satırın altında gösterilecek ek içerik (ör. "Metni oku" bağlantısı). */
  children?: ReactNode;
  required?: boolean;
};

export function CheckboxRow({ checked, onChange, label, children, required }: CheckboxRowProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={required ? `${label} (zorunlu)` : label}
        onPress={() => onChange(!checked)}
        hitSlop={8}
        style={styles.pressable}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: checked ? theme.colors.accent : theme.colors.border,
              backgroundColor: checked ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          {checked ? (
            <Text variant="label" color="onAccent" style={styles.tick}>
              ✓
            </Text>
          ) : null}
        </View>
        <View style={styles.labelColumn}>
          <Text variant="body">
            {label}
            {required ? (
              <Text variant="body" color="accent">
                {' '}
                *
              </Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  pressable: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tick: { lineHeight: 18 },
  labelColumn: { flex: 1 },
  children: { paddingLeft: 40 },
});
