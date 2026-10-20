// Soundtrack of the "by ear" film. The heard phrase is a soft piano through a phone-speaker filter; the answer is the recorded acoustic guitar,
// with one wrong note, a bell when he catches it, and a strummed C chord that lands the ending. Every time comes from story.mjs.
import { track, keys, guitarNote, bell, whoosh, tick, writeWav } from '../../synth.mjs';
import { DURATION, HEARD, ATTEMPTS, T } from './story.mjs';

/** Band-limit to roughly 180 Hz – 2.3 kHz and saturate a little: "music coming out of a small speaker". */
function throughSpeaker(buf) {
  const o = new Float32Array(buf.length);
  let a = 0, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a += 0.33 * (buf[i] - a);
    b += 0.025 * (a - b);
    o[i] = Math.tanh(1.7 * (a - b));
  }
  return o;
}

export function renderByEarAudio(path) {
  const { out, mix } = track(DURATION);

  for (const n of HEARD) mix(throughSpeaker(keys(n.midi, 0.4)), n.t, 0.5);

  for (const n of ATTEMPTS) {
    mix(guitarNote(n.midi, n.ok ? 0.34 : 0.26, n.ok ? 0.12 : 0.08), n.t, n.ok ? 0.9 : 0.8);
    if (n.ok && n.t >= T.fix) mix(tick(1760, 0.07), n.t + 0.01, 0.07);                // the progress pip filling
  }
  mix(bell(88, 0.6), T.fix + 0.02, 0.11);                                              // "oh!" — he found it

  mix(whoosh(0.36), T.chord - 0.36, 0.16);                                             // rises into the strum
  [48, 55, 60, 64, 67].forEach((m, i) => mix(guitarNote(m, 0.7, 0.3), T.chord + i * 0.022, 0.55));
  mix(bell(84, 1.2), T.chord + 0.02, 0.16);
  mix(bell(91, 1.0), T.chord + 0.1, 0.1);

  return writeWav(path, out);
}
