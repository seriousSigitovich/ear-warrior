// A film whose timeline comes from a recorded take (the author's GarageBand export) instead of the synthesized riff in story.mjs.
// analyze-take.mjs finds the onsets in the audio; storyFromTake() turns them into the same `Story` shape the scene already animates:
//   every onset before the last big hit = a chug (the loud ones are "big": head-bang + sound ring), the last big hit = the chord (wind-up before it, jump on it).

/** Build the Story from a take. `chord` (seconds) overrides the auto-detected last big hit; `bpm` (+ `t0`, default = first onset) puts the chugs on the
 *  eighth-note grid of a click-driven recording instead of on detected onsets (guitar chugs are too soft to detect reliably under the drums). */
export function storyFromTake({ duration, onsets, chord, bpm, t0 }) {
  const strong = onsets.filter((o) => o.s >= 0.7);
  const chordT = chord ?? (strong.length ? strong[strong.length - 1].t : onsets[onsets.length - 1].t);
  const fillAt = chordT - 0.5;
  const start = t0 ?? onsets[0].t;
  const body = onsets.filter((o) => o.t < chordT - 0.04);
  let CHUGS = body.map((o) => ({ t: o.t, midi: 40, big: o.s >= 0.6 }));
  let BEAT = 0.5, BEATS = CHUGS.filter((c) => c.big).map((c) => c.t);
  if (bpm) {
    BEAT = 60 / bpm;
    CHUGS = []; BEATS = [];
    for (let k = 0; start + (k * BEAT) / 2 < fillAt - 1e-6; k++) {
      const t = start + (k * BEAT) / 2;
      CHUGS.push({ t, midi: 40, big: k % 4 === 0 });
      if (k % 2 === 0) BEATS.push(t);
    }
  }
  const bigs = CHUGS.filter((c) => c.big).map((c) => c.t);
  return {
    DURATION: Math.min(duration, chordT + 1.5),
    T: { bar2: start + 4 * BEAT, fillAt, chord: chordT, hold: chordT + 0.55 },
    CHUGS,
    LEAD: CHUGS.filter((c, i) => i % 3 === 0).map((c) => ({ t: c.t, midi: 76, dur: 0.2 })),   // only the flying notes use these
    KICKS: bpm ? body.filter((o) => o.s >= 0.35).map((o) => o.t).filter((t) => t < fillAt) : bigs.filter((t) => t < fillAt),
    SNARES: [], FILL: [], HATS: [],
    BEAT, T0: start, BEATS,
  };
}
