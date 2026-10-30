// Palette + type for the 10-second challenge. Deliberately NOT the app's Nocturne purple: this one is graphite and electric lime.
export const K = {
  bg: '#130A22',
  lime: '#C6FF4D',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.58)',
  faint: 'rgba(255,255,255,0.14)',
  wood: '#190F2D',
  woodHi: '#251941',
  fret: '#C9D0DC',
  nut: '#E8ECF3',
};
export const FONT = '"Inter", "Geist", -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
export const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
};
