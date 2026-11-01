// Soundtrack of the Mountain King neon cut: #56's hook hit, the melody once on the recorded acoustic guitar, and the call to action's
// pops — no countdown, no reveal. Every time comes from king/story.mjs, the same file the picture reads.
import { track, guitarNote, pluck, bell, tick, whoosh } from '../../synth.mjs';
import { thump, noise, room, writeAndMeasure } from '../ten/audio.mjs';

export function renderKingAudio(path, S) {
  const { DURATION, T, HEARD, HOOK_NOTE, NOTE_RING } = S;
  const ring = (i) => Math.min(NOTE_RING, HEARD[i + 1].t - HEARD[i].t + 0.12);
  const { out, mix: raw } = track(DURATION);
  const SFX = 0.5;                                                 // every UI sound ~6 dB under where it was designed: the guitar leads
  const mix = (buf, start, gain = 1) => raw(buf, start, gain * SFX);
  const gtr = track(DURATION);                                    // everything that goes through the reverb

  // scene 1 — the hook, on frame 0: a hard pluck of a low string, a pick snap, the board "thock"
  gtr.mix(pluck(HOOK_NOTE.midi, 1.5), 0, 1.1);
  gtr.mix(pluck(HOOK_NOTE.midi + 12, 0.8, 0x1234abcd), 0, 0.4);
  mix(noise(0.05, 90), 0, 0.5);
  mix(thump(95, 52, 0.4, 9), 0, 0.55);
  mix(whoosh(0.34), T.listen - 0.34, 0.1);

  // scene 2 — the melody, once
  HEARD.forEach((n, i) => {
    const last = i === HEARD.length - 1;
    gtr.mix(guitarNote(n.midi, last ? 1.4 : ring(i), last ? 0.5 : 0.14), n.t, 1.0);
  });

  // scene 3 — your turn: a whoosh as the camera swings, pops for each line, a light sweep and a soft closing chord
  mix(whoosh(0.5), T.hold, 0.09);
  mix(thump(150, 70, 0.35, 10), T.cta, 0.3);
  mix(tick(1100, 0.08), T.cta, 0.07);
  mix(thump(180, 100, 0.18, 14), T.sub, 0.12);
  mix(tick(1400, 0.08), T.sub, 0.05);
  mix(thump(180, 100, 0.18, 14), T.comment, 0.13);
  mix(tick(1600, 0.08), T.comment, 0.06);
  mix(whoosh(0.28), T.sweep - 0.28, 0.09);
  [71, 74, 78].forEach((m, i) => mix(bell(m, 1.1), T.sweep + 0.02 + i * 0.03, 0.05));   // B minor, the tune's key

  const wet = room(gtr.out);
  for (let i = 0; i < gtr.out.length; i++) out[i] += gtr.out[i] + wet[i] * 0.16;
  return writeAndMeasure(path, out);
}
