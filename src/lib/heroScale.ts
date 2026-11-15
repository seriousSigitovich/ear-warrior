// How much the top text block on Home and onboarding grows with the screen. Pure — the screens pass
// the window height in.
//
// Both screens put a short text block at the top and the actions at the bottom. On a 640 dp phone
// that already fills the screen; on a tall one most of it was empty space between the two. So the
// type grows with the height: 1 at 640 dp, linearly up to HERO_SCALE_MAX at 880 dp and above.

export const HERO_SCALE_MAX = 1.4;
const SHORT = 640;
const TALL = 880;

export function heroScale(windowHeight: number): number {
  const t = (windowHeight - SHORT) / (TALL - SHORT);
  return 1 + Math.min(1, Math.max(0, t)) * (HERO_SCALE_MAX - 1);
}

/** A text size scaled and rounded to whole dp, so glyphs stay crisp. */
export function scaled(size: number, scale: number): number {
  return Math.round(size * scale);
}
