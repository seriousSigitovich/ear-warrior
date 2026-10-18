// "Tabs guy" — the 60 s pain sketch. One timeline read by BOTH the soundtrack (pain/audio.mjs) and the picture (src/pain/*), so a wrong note
// is heard and seen at the same instant. Pure: no fs, no node APIs (it ships inside the Remotion bundle).
//
//   0–11   room        he plays a riff from a tab (hook 0–3, "legend" 3–11)
//   11–17  party       "Play something!" → no tab, phone at 1 %
//   17–37  fail        Ode to Joy, four starts, wrong notes (fretboard inset shows every one)
//   37–41  silence     awkward; guitar changes hands
//   41–53  quiet guy   hears it once, plays it, adds a second voice; the crowd comes over
//   53–60  end card    "Play what you hear."

export const FPS = 60;
export const DURATION = 60;
export const OPEN = [40, 45, 50, 55, 59, 64];                    // E A D G B e
export const STRING_LETTERS = ['E', 'A', 'D', 'G', 'B', 'e'];

export const T = { room: 0, hookSplit: 1.45, legend: 3, party: 11, ask: 12.7, phone: 14.1, fail: 17, silence: 37, pass: 39.6, quiet: 41, end: 53 };

/** Lowest fret ≤ maxFret that sounds `midi`; on a tie the higher string. */
export function fretFor(midi, maxFret = 12) {
  let best = null;
  for (let s = 0; s < 6; s++) {
    const f = midi - OPEN[s];
    if (f < 0 || f > maxFret) continue;
    if (!best || f < best.f || (f === best.f && s > best.s)) best = { s, f };
  }
  if (!best) throw new Error(`no fretting for midi ${midi}`);
  return best;
}
const ev = (t, midi, dur, extra = {}) => ({ t, midi, dur, ...fretFor(midi, 12), ...extra });

// --- 0–11 s: the riff he "knows" (original: an Am–F–C–G picking pattern, 8ths of 0.25 s) -----------------------------------------------
const PATTERNS = [
  [57, 60, 64, 69, 64, 60, 64, 60],     // Am
  [53, 57, 60, 65, 60, 57, 60, 57],     // F
  [60, 64, 67, 64, 60, 64, 67, 64],     // C
  [55, 59, 62, 67, 62, 59, 62, 59],     // G
];
export const RIFF = [];
for (let k = 0; k * 0.25 < T.party - 1e-6; k++) {
  const bar = Math.floor(k / 8) % 4;
  RIFF.push(ev(k * 0.25, PATTERNS[bar][k % 8], 0.3, { bar: Math.floor(k / 8) }));
}

// --- Ode to Joy (public domain), notes in beats ---------------------------------------------------------------------------------------
const D4 = 62, C4 = 60, E4 = 64, F4 = 65, G4 = 67;
export const ODE = [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4];
export const ODE_BEATS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2];
/** Notes ODE[from..to) laid out from `start`, `beat` seconds per beat. */
function odeSlice(start, beat, from, to) {
  const out = [];
  let b = 0;
  for (let i = from; i < to; i++) { out.push(ev(start + b * beat, ODE[i], ODE_BEATS[i] * beat)); b += ODE_BEATS[i]; }
  return out;
}

// --- 17–37 s: Tab Guy's attempts (0.55 s per beat), each ends on a wrong note -----------------------------------------------------------
const wrong = (t, midi, attempt) => ev(t, midi, 0.5, { ok: false, attempt });
const good = (list, attempt) => list.map((n) => ({ ...n, ok: true, attempt }));
export const ATTEMPTS = [
  ...good(odeSlice(17.6, 0.55, 0, 5), 1), wrong(17.6 + 5 * 0.55, 66, 1),                 // …G G, then F#
  ...good(odeSlice(22.6, 0.55, 0, 7), 2), wrong(22.6 + 7 * 0.55, 63, 2),                 // …F E, then D#
  ...good(odeSlice(28.3, 0.55, 0, 11), 3), wrong(34.9, 68, 3),                           // …C C D, long freeze, then G#
  ...good(odeSlice(35.6, 0.55, 0, 1), 4),                                                // one E, then he gives up
];
/** Moments the fail scene counts: restarts (start of attempts 2–4) and wrong notes. */
export const RESTARTS = [21.9, 27.6, 35.1];
export const WRONG_AT = ATTEMPTS.filter((n) => !n.ok).map((n) => n.t);

// --- 41–53 s: Quiet Guy plays it back, then adds a second voice a third below --------------------------------------------------------
export const QUIET_BEAT = 0.4;
export const QUIET_START = 42.5;
export const QUIET_MELODY = [...odeSlice(QUIET_START, QUIET_BEAT, 0, 15)];
const L2 = QUIET_START + 16 * QUIET_BEAT;                                               // 48.9
export const QUIET_LINE2 = odeSlice(L2, QUIET_BEAT, 0, 8);
const THIRD_BELOW = { 64: 60, 65: 62, 67: 64, 62: 59 };
export const QUIET_HARMONY = QUIET_LINE2.map((n) => {
  const m = THIRD_BELOW[n.midi];
  return { ...n, midi: m, ...fretFor(m, 12), s: 4, f: m - OPEN[4], harmony: true };
});
export const QUIET_CHORD_AT = L2 + 8 * QUIET_BEAT + 0.35;                              // 52.45

// --- 53–60 s: end card replays the first phrase on the app's fretboard ------------------------------------------------------------------
export const END_BEAT = 0.42;
export const END_START = 53.7;
export const END_MELODY = odeSlice(END_START, END_BEAT, 0, 8);
export const END_CHORD_AT = END_START + 8 * END_BEAT + 0.15;                           // 57.2
