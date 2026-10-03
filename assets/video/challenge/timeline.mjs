// Single source of truth for when things happen in a challenge video. score.mjs lays audio on it and
// render.mjs hands it to slides.html as window.CHALLENGE.timeline, so sound and picture can't drift.
//
//   hook → LISTEN (melody plays once) → TURN (countdown, silence) → REVEAL (melody again, notes light up) → OUTRO
//
// The video is a fixed 15 s. The melody plays twice (listen + reveal), so the "your turn" window is
// whatever is left: longer melodies leave the viewer less time, which is why gen-melodies.mjs speeds the
// 6-note phrases up a little.
export const DUR = 15;

const HOOK = 1.0;     // headline alone before the melody starts
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

export function timeline(c) {
  const { notes, length } = melodyTiming(c);
  const listenAt = HOOK;
  const turnAt = listenAt + length + GAP;
  const turn = DUR - OUTRO - GAP - 2 * length - HOOK - GAP;
  const revealAt = turnAt + turn + GAP;
  const outroAt = revealAt + length;
  if (turn < 4) throw new Error(`Challenge #${c.id}: only ${turn.toFixed(1)} s to play it back — melody too long`);

  // Countdown shows ceil(turnEnd − t); it ticks over at turnAt and every whole second before turnEnd.
  const turnEnd = turnAt + turn;
  const ticks = [turnAt];
  for (let k = Math.ceil(turn) - 1; k >= 1; k--) ticks.push(turnEnd - k);
  return { notes, length, listenAt, turnAt, turn, turnEnd, ticks, revealAt, outroAt, dur: DUR };
}
