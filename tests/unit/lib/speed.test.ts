import {
  DEFAULT_SPEED,
  SPEED_MAX,
  SPEED_MIN,
  parseSpeed,
  snapSpeed,
  speedAt,
  speedFraction,
  speedLabel,
} from '../../../src/lib/speed';

describe('playback speed', () => {
  test('defaults to the tune’s own tempo', () => {
    expect(DEFAULT_SPEED).toBe(1);
  });

  test('snaps to 5% steps inside 50–100%, with no float residue', () => {
    expect(snapSpeed(0.7)).toBe(0.7);
    expect(snapSpeed(0.72)).toBe(0.7);
    expect(snapSpeed(0.73)).toBe(0.75);
    expect(snapSpeed(0.2)).toBe(SPEED_MIN);
    expect(snapSpeed(3)).toBe(SPEED_MAX);
    expect(snapSpeed(NaN)).toBe(DEFAULT_SPEED);
  });

  test('maps a touch along the track to a speed, clamped at both ends', () => {
    expect(speedAt(0, 200)).toBe(0.5);
    expect(speedAt(100, 200)).toBe(0.75);
    expect(speedAt(200, 200)).toBe(1);
    expect(speedAt(-30, 200)).toBe(0.5);
    expect(speedAt(500, 200)).toBe(1);
    expect(speedAt(50, 0)).toBe(DEFAULT_SPEED);
  });

  test('places the thumb and labels the value', () => {
    expect(speedFraction(0.5)).toBe(0);
    expect(speedFraction(0.75)).toBeCloseTo(0.5);
    expect(speedFraction(1)).toBe(1);
    expect(speedLabel(0.75)).toBe('75%');
    expect(speedLabel(1)).toBe('100%');
  });

  test('reads a stored speed back, falling back to full tempo', () => {
    expect(parseSpeed('0.6')).toBe(0.6);
    expect(parseSpeed(null)).toBe(1);
    expect(parseSpeed('garbage')).toBe(1);
  });
});
