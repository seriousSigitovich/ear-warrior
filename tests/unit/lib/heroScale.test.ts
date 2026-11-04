import { HERO_SCALE_MAX, heroScale, scaled } from '../../../src/lib/heroScale';

describe('heroScale', () => {
  it('keeps the base size on a short phone', () => {
    expect(heroScale(640)).toBe(1);
    expect(heroScale(560)).toBe(1);
  });

  it('grows with the height in between', () => {
    expect(heroScale(760)).toBeCloseTo(1 + (HERO_SCALE_MAX - 1) / 2);
  });

  it('stops growing on a tall phone', () => {
    expect(heroScale(880)).toBe(HERO_SCALE_MAX);
    expect(heroScale(1200)).toBe(HERO_SCALE_MAX);
  });
});

describe('scaled', () => {
  it('rounds to whole dp', () => {
    expect(scaled(30, 1.27)).toBe(38);
    expect(scaled(14, 1)).toBe(14);
  });
});
