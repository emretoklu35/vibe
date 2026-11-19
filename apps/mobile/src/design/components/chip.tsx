import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './text';

type ChipProps = { label: string; selected: boolean; onPress: () => void; disabled?: boolean };

export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radii.pill,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

type Option<T extends string | number> = { value: T; label: string };

type ChipGroupProps<T extends string | number> = {
  label?: string;
  options: readonly Option<T>[];
  disabled?: boolean;
} & (
  | { multiple: true; value: T[]; onChange: (value: T[]) => void; max?: number }
  | { multiple?: false; value: T | null; onChange: (value: T | null) => void; allowClear?: boolean }
);

/** Tekli veya çoklu seçim. Tekli seçimde allowClear ile seçili olana tekrar basmak seçimi kaldırır. */
export function ChipGroup<T extends string | number>(props: ChipGroupProps<T>) {
  const theme = useTheme();
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: T) => {
    if (props.multiple) {
      if (props.value.includes(v)) props.onChange(props.value.filter((x) => x !== v));
      else if (!props.max || props.value.length < props.max) props.onChange([...props.value, v]);
    } else {
      props.onChange(props.value === v && props.allowClear ? null : v);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {props.label ? (
        <Text variant="label" color="textMuted">
          {props.label}
        </Text>
      ) : null}
      <View style={styles.wrap}>
        {props.options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={isSelected(option.value)}
            disabled={props.disabled}
            onPress={() => toggle(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
