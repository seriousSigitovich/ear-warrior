import {
  MARKER_MAX,
  MARKER_MIN,
  SLOT_GAP,
  SLOT_MAX,
  SLOT_MIN,
  markerSize,
  slotLayout,
  slotScrollX,
} from '../../../src/lib/fretboardLayout';

// 360 dp phone minus the screen's 24 dp side padding.
const NARROW = 312;
// A width that whole minimum-size slots do not divide evenly.
const ODD = 330;

describe('slotLayout', () => {
  it('keeps full-size slots when they fit', () => {
    expect(slotLayout(4, NARROW)).toEqual({ size: SLOT_MAX, scrolls: false, visible: 4 });
  });

  it('shrinks slots to fit one row before scrolling', () => {
    const { size, scrolls } = slotLayout(12, NARROW);
    expect(scrolls).toBe(false);
    expect(size).toBeLessThan(SLOT_MAX);
    expect(size).toBeGreaterThanOrEqual(SLOT_MIN);
    expect(12 * size + 11 * SLOT_GAP).toBeLessThanOrEqual(NARROW);
  });

  it('scrolls when even the minimum size overflows', () => {
    const { size, scrolls, visible } = slotLayout(20, NARROW);
    expect(scrolls).toBe(true);
    expect(size).toBeGreaterThanOrEqual(SLOT_MIN);
    expect(visible).toBe(Math.floor((NARROW + SLOT_GAP) / (SLOT_MIN + SLOT_GAP)));
  });

  it('keeps the circles small: half what they were', () => {
    expect(SLOT_MAX).toBe(20);
    expect(SLOT_MIN).toBe(16);
  });

  it('fills the row with whole slots exactly when it scrolls, so none is cut at the edge', () => {
    const { size, scrolls, visible } = slotLayout(16, ODD);
    expect(scrolls).toBe(true);
    expect(size).toBeGreaterThanOrEqual(SLOT_MIN);
    expect(visible * size + (visible - 1) * SLOT_GAP).toBeCloseTo(ODD);
  });

  it('falls back to full size before the row is measured', () => {
    expect(slotLayout(16, 0)).toEqual({ size: SLOT_MAX, scrolls: false, visible: 16 });
  });
});

describe('slotScrollX', () => {
  it('does not scroll a row that fits', () => {
    expect(slotScrollX(3, 4, NARROW)).toBe(0);
  });

  it('stays at the start for the first slots', () => {
    expect(slotScrollX(0, 16, NARROW)).toBe(0);
  });

  it('pins to the end for the last slot', () => {
    const { size } = slotLayout(16, ODD);
    const content = 16 * size + 15 * SLOT_GAP;
    expect(slotScrollX(15, 16, ODD)).toBeCloseTo(content - ODD);
  });

  it('keeps a middle slot in the middle of the row', () => {
    const { size, visible } = slotLayout(16, ODD);
    const step = size + SLOT_GAP;
    expect(slotScrollX(8, 16, ODD)).toBeCloseTo((8 - visible / 2) * step);
  });

  it('always scrolls by whole slots', () => {
    const step = slotLayout(16, ODD).size + SLOT_GAP;
    for (let i = 0; i < 16; i++) {
      const slots = slotScrollX(i, 16, ODD) / step;
      expect(slots).toBeCloseTo(Math.round(slots));
    }
  });
});

describe('markerSize', () => {
  it('is full size on roomy rows', () => {
    expect(markerSize(44)).toBe(MARKER_MAX);
  });

  it('shrinks with short rows', () => {
    expect(markerSize(22)).toBe(20);
  });

  it('never drops below the legible minimum', () => {
    expect(markerSize(10)).toBe(MARKER_MIN);
  });
});
