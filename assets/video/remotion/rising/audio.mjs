// Soundtrack of the Rising Sun band cut, a seamless 10 s loop: #71's arpeggio on the acoustic guitar from the very first sample
// (king/audio.mjs layMelody), a quiet band under it — a fingered bass on root and fifth, a soft 6/8 kit (kick on 1, a light snare on 2,
// eighth hats) — the home chord with a cymbal, a bar of E with a snare pickup back into bar 1, and #71's "your turn" pops.
// Rendered 2 s long and folded: whatever rings past the end (the strums, the reverb) is mixed onto the start, so the loop has no seam.
import { track, tick, whoosh, bell, guitarNote, SR } from '../../synth.mjs';
import { thump, room, writeAndMeasure } from '../ten/audio.mjs';
import { layMelody } from '../king/audio.mjs';
import { kick, snare, noise, bass } from '../jam/audio.mjs';
import { S, BAR, EIGHTH, BARS, BEATS, HOME, ROOTS, VAMP, FILL, DOCK, LEAVE, BACK } from './band.mjs';

const OVER = 2;

export function renderRisingBandAudio(path) {
  const { DURATION, T } = S;
  const { out, mix } = track(DURATION + OVER);
  const gtr = track(DURATION + OVER);
  const k = kick(), sn = snare(), hat = noise(0.05, 80, 0.93, 0x13579bd);

  layMelody(gtr, S);
  for (const v of VAMP) v.chord.forEach((m, i) => gtr.mix(guitarNote(m, 1.6, 0.6), v.t + i * 0.025, v.t % BAR ? 0.22 : 0.32));

  // the band, all eight bars
  BARS.forEach((t, i) => { ROOTS[i].forEach((m, j) => mix(bass(m, (BAR / 2) * 0.95), t + (j * BAR) / 2, 0.42)); mix(k, t, i === 6 ? 0.55 : 0.4); });
  BEATS.forEach((t, i) => { if (i % 2 && t < FILL[0]) mix(sn, t, 0.14); });
  for (let t = 0; t < DURATION - 1e-6; t += EIGHTH) if (t < FILL[0] - 1e-6) mix(hat, t, Math.round(t / EIGHTH) % 3 ? 0.035 : 0.06);
  FILL.forEach((t, i) => mix(sn, t, 0.12 + 0.05 * i));
  mix(noise(2.6, 1.6, 0.9, 0x777777), HOME, 0.12);                                          // a soft cymbal on the home chord

  // the slides, then your turn
  [DOCK, LEAVE, BACK].forEach((t) => mix(whoosh(0.5), t - 0.1, 0.035));
  mix(thump(150, 70, 0.35, 10), T.cta, 0.15);
  mix(tick(1100, 0.08), T.cta, 0.035);
  mix(thump(180, 100, 0.18, 14), T.sub, 0.06);
  mix(thump(180, 100, 0.18, 14), T.comment, 0.065);
  mix(tick(1600, 0.08), T.comment, 0.03);
  S.CHORD.forEach((m, i) => mix(bell(m, 1.1), T.sweep + 0.02 + i * 0.03, 0.025));

  const wet = room(gtr.out);
  for (let i = 0; i < out.length; i++) out[i] += gtr.out[i] + wet[i] * 0.16;
  const n = Math.round(DURATION * SR), loop = out.slice(0, n);
  for (let i = n; i < out.length; i++) loop[i - n] += out[i];                               // the tail rings on into the next pass
  return writeAndMeasure(path, loop);
}
