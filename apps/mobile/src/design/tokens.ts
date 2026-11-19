/**
 * VIBE tasarım token'ları. Bileşenler renk/ölçü değerlerini doğrudan yazmaz, buradan alır.
 * Yön: sıcak fildişi + derin mürdüm zemin, "ember" (köz) vurgu. Gece öncelikli, gündüz modu tam destekli.
 */

const palette = {
  ink900: '#16111C',
  ink800: '#1F1827',
  ink700: '#2A2133',
  ink500: '#5B5066',
  mist300: '#A79FB0',
  mist200: '#CFC8D6',
  ivory50: '#FBF7F2',
  ivory100: '#F3ECE3',
  white: '#FFFFFF',
  ember500: '#FF6B4A',
  ember600: '#E8553A',
  lilac400: '#B79CFF',
  lilac600: '#7C5CE0',
  success: '#3CCB8C',
  danger: '#FF5A6E',
} as const;

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentSecondary: string;
  success: string;
  danger: string;
};

export const colors: Record<'light' | 'dark', ColorTokens> = {
  dark: {
    background: palette.ink900,
    surface: palette.ink800,
    surfaceRaised: palette.ink700,
    border: palette.ink700,
    text: palette.ivory50,
    textMuted: palette.mist300,
    accent: palette.ember500,
    onAccent: palette.ink900,
    accentSecondary: palette.lilac400,
    success: palette.success,
    danger: palette.danger,
  },
  light: {
    background: palette.ivory50,
    surface: palette.white,
    surfaceRaised: palette.ivory100,
    border: palette.mist200,
    text: palette.ink900,
    textMuted: palette.ink500,
    accent: palette.ember600,
    onAccent: palette.white,
    accentSecondary: palette.lilac600,
    success: '#1F9E68',
    danger: '#D93A50',
  },
};

/** 4 pt tabanlı ölçek. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: 6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.2 },
  headline: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.3 },
} as const;

export type TypographyVariant = keyof typeof typography;
