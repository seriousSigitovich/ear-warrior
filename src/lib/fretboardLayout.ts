// Sizing for the answer view on small phones. Pure and deterministic — the components measure the
// space they get, this decides how big things are in it.
//
// The answer screen must not scroll vertically on a 360×640 dp phone, so nothing above the board may
// grow with the melody: the note slots stay on one row (shrinking, then scrolling sideways) and the
// fret markers shrink with the rows when the board is squeezed.

/** Note slot diameter: full size when the row has room, never below the minimum. */
export const SLOT_MAX = 40;
export const SLOT_MIN = 32;
export const SLOT_GAP = 8;

export interface SlotLayout {
  /** Diameter of every slot. */
  size: number;
  /** The slots overflow the row even at SLOT_MIN, so the row scrolls sideways. */
  scrolls: boolean;
  /** Whole slots in view at once (all of them when the row does not scroll). */
  visible: number;
}

/**
 * One row of `count` slots across `width`: as large as fits, up to SLOT_MAX. When even SLOT_MIN
 * overflows, the row shows as many whole slots as fit at that size, stretched to fill the width
 * exactly, so — scrolled by whole slots — it never cuts a slot at its edge.
 */
export function slotLayout(count: number, width: number): SlotLayout {
  if (count <= 0 || width <= 0) return { size: SLOT_MAX, scrolls: false, visible: count };
  const fit = (width - (count - 1) * SLOT_GAP) / count;
  if (fit >= SLOT_MIN) {
    return { size: Math.floor(Math.min(fit, SLOT_MAX)), scrolls: false, visible: count };
  }
  const visible = Math.max(1, Math.floor((width + SLOT_GAP) / (SLOT_MIN + SLOT_GAP)));
  return { size: (width - (visible - 1) * SLOT_GAP) / visible, scrolls: true, visible };
}

/**
 * Horizontal offset that keeps slot `index` in view: a whole number of slots in, with `index` in the
 * middle where the row allows and the row pinned to either end otherwise. Zero when it does not scroll.
 */
export function slotScrollX(index: number, count: number, width: number): number {
  const { size, scrolls, visible } = slotLayout(count, width);
  if (!scrolls) return 0;
  const first = clamp(index - Math.floor(visible / 2), 0, count - visible);
  return first * (size + SLOT_GAP);
}

/** Fret marker diameter: full size on roomy rows, shrinking with short ones but staying legible. */
export const MARKER_MAX = 26;
export const MARKER_MIN = 18;

/** Marker diameter for a fret row `rowHeight` tall, leaving a hair of space to the fret wires. */
export function markerSize(rowHeight: number): number {
  return Math.floor(clamp(rowHeight - 2, MARKER_MIN, MARKER_MAX));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
