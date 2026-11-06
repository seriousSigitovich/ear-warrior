// Playback speed (the slider on the practice screen): a factor on each tune's own tempo. Slowing a
// melody down is how a learner catches fast notes by ear; the clip keeps its pitch (the player
// time-stretches it), so the notes to find stay the same. Pure so the snapping and the slider math
// are unit-testable.

/** Slowest speed offered. Below half speed a time-stretched plucked string smears audibly. */
export const SPEED_MIN = 0.5;
/** The tune's own tempo. */
export const SPEED_MAX = 1;
/** Slider step. */
export const SPEED_STEP = 0.05;
export const DEFAULT_SPEED = SPEED_MAX;

/** Key the chosen speed is remembered under between visits. */
export const SPEED_KEY = 'ew.playbackSpeed';

/** Clamp to the range and snap to the step (no float residue: 0.7 stays 0.7). */
export function snapSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_SPEED;
  const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
  const steps = Math.round((clamped - SPEED_MIN) / SPEED_STEP);
  return Number((SPEED_MIN + steps * SPEED_STEP).toFixed(2));
}

/** The speed under a touch `x` px from the start of a track `width` px wide. */
export function speedAt(x: number, width: number): number {
  if (width <= 0) return DEFAULT_SPEED;
  const t = Math.min(1, Math.max(0, x / width));
  return snapSpeed(SPEED_MIN + t * (SPEED_MAX - SPEED_MIN));
}

/** Where `speed` sits along the track, 0 (slowest) to 1 (full tempo). */
export function speedFraction(speed: number): number {
  return (snapSpeed(speed) - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
}

/** "75%". */
export function speedLabel(speed: number): string {
  return `${Math.round(snapSpeed(speed) * 100)}%`;
}

/** Read a stored speed; anything missing or malformed is full tempo. */
export function parseSpeed(stored: string | null): number {
  return stored === null ? DEFAULT_SPEED : snapSpeed(Number(stored));
}
