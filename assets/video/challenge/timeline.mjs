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
//   melody from frame 0 → "write the notes in the comments" while it plays again, slower → "new melody in the next Short"
// No countdown and no reveal, and no fixed length: the Short is as long as the melody needs (≈ 2.7×melody + 4 s),
// which keeps short phrases short and lets Shorts loop straight back into the melody.
const SERIES_SLOW = 0.7;   // the second playing runs at this fraction of the tempo — time to catch each note
const SERIES_GAP = 0.8;    // between the first and the second playing: the headline swaps here
const SERIES_TAIL = 0.5;   // let the last note ring before the end card
const SERIES_OUTRO = 3.0;  // end card: long enough to read "new melody in the next Short → subscribe"

function seriesTimeline(c) {
  const { notes, length } = melodyTiming(c);
  const slow = melodyTiming({ ...c, tempoBpm: c.tempoBpm * SERIES_SLOW });
  const againAt = length + SERIES_GAP;
  const outroAt = againAt + slow.length + SERIES_TAIL;
  const dur = Math.ceil((outroAt + SERIES_OUTRO) * 30) / 30; // whole frames
  return { notes, length, againNotes: slow.notes, againLength: slow.length, listenAt: 0, againAt, outroAt, dur };
}

export function timeline(c) {
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
