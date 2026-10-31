// Soundtrack of the bouncing-ball cuts (Spring, and the 3D Mozart cut) — rendered ahead of time to a WAV from the cut's story.mjs, the file the picture reads.
// The melody is the recorded acoustic guitar (../synth.mjs `guitarNote`) through ten/audio.mjs's small room; the ball's sounds sit well under it.
import { SR, track, guitarNote, bell, whoosh } from '../../synth.mjs';
import { thump, noise, room, layVoices, writeAndMeasure } from '../ten/audio.mjs';
import * as SPRING from './story.mjs';

/** `S` is a bouncing-ball timeline (spring/story.mjs's exports: DURATION, T, NOTES, BEAT, NOTE_RING, LAST_HOLD, CHORD). */
export function renderBounceAudio(path, S, voices = []) {
  const { DURATION, T, NOTES, BEAT, NOTE_RING, LAST_HOLD, CHORD } = S;
  const { out, mix: raw } = track(DURATION);
  const SFX = 0.5;
  const mix = (buf, start, gain = 1) => raw(buf, start, gain * SFX);
  const gtr = track(DURATION);

  // the hook: the ball's little bounces in tempo, a whoosh as it hops off
  [0, 1, 2, 3].forEach((k) => mix(thump(210, 120, 0.12, 22), k * BEAT, 0.07));
  mix(whoosh(0.3), T.launch, 0.06);

  // the melody, one pluck per landing; the two long B4s land with a low thump under them
  NOTES.forEach((n, i) => {
    const last = i === NOTES.length - 1;
    const hold = last ? LAST_HOLD : Math.min(NOTE_RING, NOTES[i + 1].t - n.t + 0.12);
    gtr.mix(guitarNote(n.midi, hold, last ? 0.4 : 0.14), n.t, 1.0);
    if (n.beats >= 1) mix(thump(90, 48, 0.4, 8), n.t, 0.22);
  });

  if (T.orbit !== undefined) mix(whoosh(0.9), T.orbit, 0.06);    // the camera's sweep round the shape

  // the fold and the pop: a whoosh drawn into the ball, a boom, the tonic chord as a glassy shimmer
  mix(whoosh(0.4), T.flash - 0.4, 0.12);
  mix(thump(72, 34, 0.9, 4.5), T.flash, 0.5);
  mix(noise(0.35, 14), T.flash, 0.08);
  CHORD.forEach((m, i) => mix(bell(m, 1.4), T.flash + 0.015 + i * 0.025, 0.05));

  // your turn: the new ball's taps in tempo
  for (let t = T.comment; t < DURATION - 0.1; t += BEAT) mix(thump(230, 130, 0.1, 24), t, 0.05);

  const wet = room(gtr.out);
  for (let i = 0; i < gtr.out.length; i++) out[i] += gtr.out[i] + wet[i] * 0.16;

  let melPeak = 0;
  for (let i = Math.round(NOTES[0].t * SR); i < Math.round((NOTES.at(-1).t + 0.5) * SR); i++) melPeak = Math.max(melPeak, Math.abs(out[i]));
  layVoices(out, voices, melPeak);
  return writeAndMeasure(path, out);
}
export const renderSpringAudio = (path, voices = []) => renderBounceAudio(path, SPRING, voices);
