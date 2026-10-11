// Single source of truth for when things happen in a challenge video. score.mjs lays audio on it and
// render.mjs hands it to slides.html as window.CHALLENGE.timeline, so sound and picture can't drift.
//
//   hook → LISTEN (melody plays once) → TURN (countdown, silence) → REVEAL (melody again, notes light up) → OUTRO
//
// The video is a fixed 15 s. The melody plays twice (listen + reveal), so the "your turn" window is
// whatever is left: longer melodies leave the viewer less time, which is why gen-melodies.mjs speeds the
// 6-note phrases up a little.
export const DUR = 15;

const HOOK = 1.0;     // headline alone before the melody starts (0 for a coldOpen challenge: sound from frame 0)
const GAP = 0.3;      // breath between sections
const OUTRO = 2.0;    // end card

/** Onset time (s) of each note, relative to the start of the melody, plus the melody's total length. */
export function melodyTiming(c) {
  const sec = 60 / c.tempoBpm;
  let beat = 0;
  const notes = c.notes.map(n => {
    const note = { onset: beat * sec, dur: n.beats * sec };
    beat += n.beats;
    return note;
  });
  return { notes, length: beat * sec };
}

// --- series videos (classics.mjs, kind "quiz") ------------------------------------------------------------
//   melody from frame 0 → "write the notes in the comments" while it plays again, slower → ends
// No end card: nobody watches it, and a CTA that names one platform ("next Short") is wrong on the others — the call
// to subscribe lives in the comments. An entry that needs the viewer to DO something (comment the right note) can add
// a short CTA slide with `cta: { title, sub }` — that slide asks for the comment and nothing else. No countdown and no
// reveal, and no fixed length: the video is as long as the melody needs (≈ 2.7×melody + 1 s, + CTA_LEN with a slide),
// which keeps short phrases short and lets it loop straight back into the melody.
const SERIES_SLOW = 0.7;   // the second playing runs at this fraction of the tempo — time to catch each note
const SERIES_GAP = 0.8;    // between the first and the second playing: the headline swaps here
const SERIES_TAIL = 1.0;   // let the last note ring out; the video ends here
const CTA_LEN = 2.5;      // the optional CTA slide (`cta` on an entry): long enough to read a two-word title and one line

// `once` videos (classics.mjs): the melody plays a single time at `speed` × its tempo, then the headline swaps to "write the notes"
// for ONCE_ASK seconds, then the video ends — about half the length of the two-playings format.
const ONCE_ASK = 2.2;

/** Where a series video ends: at `endAt`, or CTA_LEN later when the entry has a CTA slide (which then starts at `endAt`). Whole frames. */
function seriesEnd(c, endAt) {
  const dur = Math.ceil((endAt + (c.cta ? CTA_LEN : 0)) * 30) / 30;
  return c.cta ? { outroAt: endAt, dur } : { dur };
}

function onceTimeline(c) {
  const { notes, length } = melodyTiming({ ...c, tempoBpm: c.tempoBpm * (c.speed ?? 1) });
  const againAt = length + SERIES_GAP;   // headline swap (starts SERIES's 0.4 s fade-in before this)
  return { notes, length, againNotes: notes, againLength: length, listenAt: 0, againAt, once: true, ...seriesEnd(c, againAt + ONCE_ASK) };
}

function seriesTimeline(c) {
  if (c.once) return onceTimeline(c);
  const { notes, length } = melodyTiming(c);
  const slow = melodyTiming({ ...c, tempoBpm: c.tempoBpm * SERIES_SLOW });
  const againAt = length + SERIES_GAP;
  return { notes, length, againNotes: slow.notes, againLength: slow.length, listenAt: 0, againAt, ...seriesEnd(c, againAt + slow.length + SERIES_TAIL) };
}

// --- key quiz (classics.mjs, kind "key") -------------------------------------------------------------------
//   cadence from frame 0 → same cadence again under the answer cards → ends (the answer is in the pinned comment; no end card)
// Both playings at the SAME tempo (the viewer is choosing among options, not catching notes), so the second one is just a replay.
const KEY_GAP = 0.7;   // between the first and the second playing
const KEY_TAIL = 1.0;  // let the last chord ring out; the video ends here

// An entry with `audio` ({ file, length, changes: chord-change times in s, optionsAt }) is one recorded take instead of a synthesized cadence:
// it plays once, the answer cards come in at `optionsAt` while it keeps going, and the video is as long as the take needs.
function keyAudioTimeline(c) {
  const { length, changes, optionsAt } = c.audio;
  const notes = changes.map((t, i) => ({ onset: t, dur: (changes[i + 1] ?? length) - t }));
  const dur = Math.ceil((length + KEY_TAIL) * 30) / 30;
  return { notes, length, againNotes: notes, againLength: length, listenAt: 0, againAt: optionsAt, dur, once: true };
}

function keyTimeline(c) {
  if (c.audio) return keyAudioTimeline(c);
  const { notes, length } = melodyTiming(c);
  const againAt = length + KEY_GAP;
  const dur = Math.ceil((againAt + length + KEY_TAIL) * 30) / 30;
  return { notes, length, againNotes: notes, againLength: length, listenAt: 0, againAt, dur };
}

export function timeline(c) {
  if (c.kind === 'key') return keyTimeline(c);
  if (c.kind === 'quiz') return seriesTimeline(c);
  const { notes, length } = melodyTiming(c);
  const hook = c.coldOpen ? 0 : HOOK;
  const listenAt = hook;
  const turnAt = listenAt + length + GAP;
  const turn = DUR - OUTRO - GAP - 2 * length - hook - GAP;
  const revealAt = turnAt + turn + GAP;
  const outroAt = revealAt + length;
  if (turn < 4) throw new Error(`Challenge #${c.id}: only ${turn.toFixed(1)} s to play it back — melody too long`);

  // Countdown shows ceil(turnEnd − t); it ticks over at turnAt and every whole second before turnEnd.
  const turnEnd = turnAt + turn;
  const ticks = [turnAt];
  for (let k = Math.ceil(turn) - 1; k >= 1; k--) ticks.push(turnEnd - k);
  return { notes, length, listenAt, turnAt, turn, turnEnd, ticks, revealAt, outroAt, dur: DUR };
}
