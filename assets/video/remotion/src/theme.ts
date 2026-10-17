// Nocturne tokens (src/theme/nocturne.ts in the app), repeated here so this package stays standalone.
export const C = {
  bg: '#161826',
  surface: '#232532',
  text: '#e9e9ed',
  accent: '#9184d9',
  accent2: '#a7a1db',
  accent3: '#b5abfc',
  accent4: '#d2cefd',
  deep: '#5d5294',
  warm: '#c2a190',
  n300: '#cfd3e5',
  n400: '#b2b6ca',
  n500: '#9397ab',
};

export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

export const FONT = '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';
