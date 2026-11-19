import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.xl,
          backgroundColor: isPrimary ? theme.colors.accent : 'transparent',
          borderColor: isPrimary ? theme.colors.accent : theme.colors.border,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.colors.onAccent : theme.colors.text} />
      ) : (
        <Text variant="label" color={isPrimary ? 'onAccent' : 'text'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
