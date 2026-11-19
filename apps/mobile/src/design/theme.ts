import { useColorScheme } from 'react-native';

import { colors, radii, spacing, typography } from './tokens';

export function useTheme() {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { scheme, colors: colors[scheme], spacing, radii, typography } as const;
}

export type Theme = ReturnType<typeof useTheme>;
