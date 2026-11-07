import { createMediaClock } from '../../../src/lib/mediaClock';

describe('media clock', () => {
  test('at a fixed rate, media advances rate × wall time', () => {
    const c = createMediaClock(0.5, 1000);
    expect(c.position(1000)).toBe(0);
    expect(c.position(3000)).toBe(1000);
    expect(c.remaining(2000, 1000)).toBe(4000);
  });

  test('a rate change keeps what has played and stretches only the rest', () => {
    const c = createMediaClock(1, 0);
    expect(c.position(500)).toBe(500);
    c.setRate(0.5, 500);
    expect(c.position(500)).toBe(500);
    expect(c.position(1500)).toBe(1000);
    // 1500 media ms in all: 500 played at 1×, the last 1000 at 0.5× take 2000 wall ms.
    expect(c.remaining(1500, 500)).toBe(2000);
    c.setRate(1, 1500);
    expect(c.remaining(1500, 1500)).toBe(500);
    expect(c.rate).toBe(1);
  });

  test('never reports negative time left', () => {
    const c = createMediaClock(1, 0);
    expect(c.remaining(100, 5000)).toBe(0);
  });
});
