// Nocturne — design-system tokens ported from the claude.ai/design "Nocturne" project
// (Ear Warrior Redesign.dc.html) into a React Native theme. The web source of truth is
// _ds/nocturne/styles.css; this file mirrors its tokens so screens can read one palette.
//
// RN has no CSS variables or color-mix(), so tonal values are precomputed as hex and
// translucent overlays are produced with the withAlpha() helper below.

/** Blend a hex color with a fractional alpha (0–1) into an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const colors = {
  bg: '#161826',
  surface: '#232532',
  text: '#e9e9ed',
  accent: '#9184d9',
  accent2: '#a7a1db',
  divider: withAlpha('#e9e9ed', 0.16),

  neutral: {
    100: '#f3f5fe',
    200: '#e4e7f5',
    300: '#cfd3e5',
    400: '#b2b6ca',
    500: '#9397ab',
    600: '#75798c',
    700: '#595d6c',
    800: '#3f424d',
    900: '#292b31',
  },
  accentRamp: {
    100: '#f5f4ff',
    200: '#e7e5fe',
    300: '#d2cefd',
    400: '#b5abfc',
    500: '#968ae0',
    600: '#796cbf',
    700: '#5d5294',
    800: '#423a6a',
    900: '#2b2741',
  },
  accent2Ramp: {
    100: '#f5f4ff',
    200: '#e7e5fe',
    300: '#d2cefd',
    400: '#b5afe8',
    500: '#9690c9',
    600: '#7972a9',
    700: '#5c5783',
    800: '#423e5d',
    900: '#2b293a',
  },

  // Note-status hues (design notes): matched/extra ride the accent + accent-2, while
  // "wrong" takes a warm derived hue and "missed" a quiet neutral — four legible roles.
  warm: '#c2a190',
  warmBorder: '#6e5a4d',
} as const;

/** Translucent text tints used throughout (color-mix text N% over transparent). */
export const textAlpha = {
  70: withAlpha(colors.text, 0.7),
  65: withAlpha(colors.text, 0.65),
  60: withAlpha(colors.text, 0.6),
  55: withAlpha(colors.text, 0.55),
  50: withAlpha(colors.text, 0.5),
  45: withAlpha(colors.text, 0.45),
} as const;

export const radius = { sm: 4, md: 8, lg: 14, pill: 999 } as const;

export const space = {
  1: 3,
  2: 6,
  3: 8,
  4: 11,
  6: 17,
  8: 22,
} as const;

// Type scale — the web uses Inter; RN falls back to the platform system font at the
// same weights. Headings lean medium (500), body regular (400).
export const font = {
  heading: undefined as string | undefined, // system heading font
  body: undefined as string | undefined,
  weightHeading: '500' as const,
  weightSemibold: '600' as const,
};
