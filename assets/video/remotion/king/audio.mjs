// Soundtrack of the Mountain King neon cut: #56's hook hit, the melody once on the recorded acoustic guitar, and the call to action's
// pops — no countdown, no reveal. Every time comes from king/story.mjs, the same file the picture reads.
import { track, guitarNote, pluck, bell, tick, whoosh } from '../../synth.mjs';
import { thump, noise, room, writeAndMeasure } from '../ten/audio.mjs';
import { STRUM_GAP } from './tunes.mjs';

/** The melody once on the recorded acoustic guitar, into `gtr` (a track()). Shared with the Rising Sun band cut (rising/audio.mjs). */
export function layMelody(gtr, S) {
  const { HEARD, NOTE_RING } = S;
  const ring = (i) => {
    if (!S.LET_RING) return Math.min(NOTE_RING, HEARD[i + 1].t - HEARD[i].t + 0.12);
    const again = HEARD.slice(i + 1).find((m) => m.string === HEARD[i].string);              // an arpeggio: rings until its string plays again
    return Math.min(NOTE_RING, (again ? again.t : HEARD.at(-1).t + 1.4) - HEARD[i].t + 0.05);
  };
  HEARD.forEach((n, i) => {
    const last = i === HEARD.length - 1;
    if (last && S.END_STRUM) S.END_STRUM.forEach((m, k) => gtr.mix(guitarNote(m, 3.6, 1.2), n.t + k * 0.03, 0.75));   // a chord that carries the scene after it
    else gtr.mix(guitarNote(n.midi, last ? 1.4 : ring(i), last ? 0.5 : 0.14), n.t, 1.0);
  });
}

export function renderKingAudio(path, S) {
  const { DURATION, T, HOOK_NOTE, CHORD = [71, 74, 78] } = S;      // the closing chord: B minor, the King's key, unless the story names one
  const { out, mix: raw } = track(DURATION);
  const SFX = 0.5;                                                 // every UI sound ~6 dB under where it was designed: the guitar leads
  const mix = (buf, start, gain = 1) => raw(buf, start, gain * SFX);
  const gtr = track(DURATION);                                    // everything that goes through the reverb

  // scene 1 — the hook, on frame 0: a hard pluck of a low string (or a downstroke of the key's chord), a pick snap, the board "thock"
  if (S.HOOK_CHORD) S.HOOK_CHORD.forEach((n, k) => gtr.mix(guitarNote(n.midi, 2.3, 0.6), k * STRUM_GAP, 0.8));
  else {
    gtr.mix(pluck(HOOK_NOTE.midi, 1.5), 0, 1.1);
    gtr.mix(pluck(HOOK_NOTE.midi + 12, 0.8, 0x1234abcd), 0, 0.4);
  }
  mix(noise(0.05, 90), 0, 0.5);
  mix(thump(95, 52, 0.4, 9), 0, 0.55);
  mix(whoosh(0.34), T.listen - 0.34, 0.1);

  // scene 2 — the melody, once
  layMelody(gtr, S);

  // scene 3 — your turn: a whoosh as the camera swings, pops for each line, a light sweep and a soft closing chord
  mix(whoosh(0.5), T.hold, 0.09);
  mix(thump(150, 70, 0.35, 10), T.cta, 0.3);
  mix(tick(1100, 0.08), T.cta, 0.07);
  mix(thump(180, 100, 0.18, 14), T.sub, 0.12);
  mix(tick(1400, 0.08), T.sub, 0.05);
  mix(thump(180, 100, 0.18, 14), T.comment, 0.13);
  mix(tick(1600, 0.08), T.comment, 0.06);
  mix(whoosh(0.28), T.sweep - 0.28, 0.09);
  CHORD.forEach((m, i) => mix(bell(m, 1.1), T.sweep + 0.02 + i * 0.03, 0.05));

  const wet = room(gtr.out);
  for (let i = 0; i < gtr.out.length; i++) out[i] += gtr.out[i] + wet[i] * 0.16;
  return writeAndMeasure(path, out);
}
