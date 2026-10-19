// The short cut of the pain sketch: the SAME story, compressed. The 60 s timeline (story.mjs) is played through a few segments, each sped up
// (or, at the very end, slowed) so every beat survives: hook → "legend" → the ask → no tab → failed attempts → the excuse → the quiet guy → CTA.
// Pure data + two lookups, shared by the picture (src/Root.tsx / PainCut), the soundtrack (audio.mjs) and the narrator (voice.mjs).
//
//   from, to   a span of the 60 s timeline, in seconds        len   how long that span takes in the cut (speed = (to - from) / len)
//
// The picture is a pure function of the 60 s time, so playing a span faster just samples it faster; the music is re-laid from the same
// note list at the compressed times (pitches stay put, only the spacing shrinks).

export const SEGS = [
  { id: 'hook',     from: 0.0,   to: 3.0,  len: 3.0 },   // "7 years of guitar." / "Zero songs without tabs." — real time
  { id: 'ask',      from: 11.7,  to: 14.1, len: 2.0 },   // "Then someone says…", "Play something!", the guitar is handed over
  { id: 'phone',    from: 14.1,  to: 16.9, len: 2.0 },   // no signal — "…and your tab is gone."
  { id: 'fail',     from: 17.6,  to: 21.1, len: 2.8 },   // Ode to Joy: five right notes, then a wrong one
  { id: 'handover', from: 38.9,  to: 41.0, len: 1.9 },   // the swap: the cough, the guitar changes hands, the loser slides to the corner and greys out
  { id: 'listen',   from: 41.0,  to: 43.0, len: 1.2 },   // the quiet guy listens once
  { id: 'lights',   from: 43.0,  to: 50.8, len: 5.6 },   // he plays it back; the crowd turns, lights up, hearts, clapping
  { id: 'end',      from: 52.85, to: 59.0, len: 4.9 },   // wipe to the end card, "Play what you hear.", the call to action
];

/** Narrator, in cut time: `at` is when the line starts (s). Each line sits on the caption it reads. */
export const LINES = [
  { at: 0.1,  say: 'Seven years of guitar.' },
  { at: 1.5,  say: 'Zero songs without tabs.' },
  { at: 3.1,  say: 'Then someone says: play something.' },
  { at: 6.2,  say: 'And the tab is gone.' },
  { at: 7.6,  say: 'You know the song. Your hands don’t.' },
  { at: 11.9, say: 'He didn’t read it.' },
  { at: 14.9, say: 'He heard it.' },
  { at: 16.0, say: 'And the whole room lights up.' },
  { at: 18.7, say: 'Play what you hear.' },
];

export const CUT_DURATION = SEGS.reduce((s, g) => s + g.len, 0);
/** Where each segment starts in the cut (s). */
export const SEG_STARTS = SEGS.map((_, i) => SEGS.slice(0, i).reduce((s, g) => s + g.len, 0));

/** Cut time (s) → 60 s timeline time (s). */
export function srcAt(o) {
  const t = Math.min(Math.max(o, 0), CUT_DURATION - 1e-6);
  let k = SEGS.length - 1;
  while (k > 0 && SEG_STARTS[k] > t) k--;
  const g = SEGS[k];
  return g.from + ((t - SEG_STARTS[k]) * (g.to - g.from)) / g.len;
}

/** 60 s timeline time (s) → where it lands in the cut: { k, out, speed }, or null when that moment was cut out. */
export function locate(src) {
  for (let k = 0; k < SEGS.length; k++) {
    const g = SEGS[k];
    if (src >= g.from && src < g.to) {
      const speed = (g.to - g.from) / g.len;
      return { k, out: SEG_STARTS[k] + (src - g.from) / speed, speed };
    }
  }
  return null;
}
