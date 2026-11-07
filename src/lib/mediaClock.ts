// Where a recording is while its playback speed can change mid-play. "Media" time is time in the
// recording itself (the tune at its own tempo); wall time is time on the clock. At rate r one wall ms
// plays r media ms, so after a change the rest of the recording takes (remaining media) / r. Pure, so
// the playback layer's timeline is unit-testable.

export interface MediaClock {
  /** Media ms played by wall time `now`. */
  position(now: number): number;
  /** Change the rate from wall time `now` on; what has played so far stays played. */
  setRate(rate: number, now: number): void;
  /** Wall ms from `now` until the media reaches `endMs` at the current rate (0 once past it). */
  remaining(endMs: number, now: number): number;
  readonly rate: number;
}

export function createMediaClock(rate: number, now: number): MediaClock {
  let anchorWall = now;
  let anchorMedia = 0;
  let current = rate;
  const position = (t: number) => anchorMedia + Math.max(0, t - anchorWall) * current;
  return {
    position,
    setRate(next, t) {
      anchorMedia = position(t);
      anchorWall = t;
      current = next;
    },
    remaining(endMs, t) {
      return Math.max(0, (endMs - position(t)) / current);
    },
    get rate() {
      return current;
    },
  };
}
