// Soundtrack bed of the "melody in my head" film: the hum (synthesized "mm" voice) and the room sounds of each shot, 0–3.6 s.
// The solo itself (assets/solo/06-…mp3) is laid over it by render-hum.mjs with ffmpeg. Every time comes from story.mjs.
import { track, bell, whoosh, tick, writeWav, hz, SR } from '../../synth.mjs';
import { DURATION, HUM, SHOTS, T } from './story.mjs';

function noise(len, seed) {
  const o = new Float32Array(Math.round(len * SR));
  let s = seed >>> 0;
  for (let i = 0; i < o.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; o[i] = ((s >>> 0) / 0xffffffff) * 2 - 1; }
  return o;
}
function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; }
  return y;
}
const highpass = (x, cutoff) => { const lp = lowpass(x, cutoff); return x.map((v, i) => v - lp[i]); };

const smoothstep = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

/** Low-passed noise in -1…1: the slow wobble of a human voice (pitch jitter, loudness shimmer). */
function slowNoise(len, seed, cutoff) {
  const n = noise(len, seed), o = lowpass(n, cutoff);
  let peak = 1e-6;
  for (const v of o) peak = Math.max(peak, Math.abs(v));
  return o.map((v) => v / peak);
}

/** Rosenberg glottal pulse: the air puffs of the vocal folds (open, closing, closed) over one period `ph` ∈ [0, 1). */
function glottal(ph) {
  const tp = 0.42, tn = 0.16;
  if (ph < tp) return 0.5 * (1 - Math.cos((Math.PI * ph) / tp));
  if (ph < tp + tn) return Math.cos((Math.PI / 2) * ((ph - tp) / tn));
  return 0;
}

/**
 * One hummed phrase ("mm-mm-mm-mm"), a human mumble rather than a tone:
 *  - a glottal pulse train with pitch jitter and loudness shimmer, a vibrato that only starts after a moment,
 *  - the notes are joined by a short slide (portamento), with a small dip in loudness where the lips re-close on each note,
 *  - the sound goes through the resonances of a closed mouth: a strong low nasal formant that follows the pitch, weak upper ones,
 *  - a breath of noise, the last note trails off flat (or stops dead when it is cut short), `crack` flips to a rough falsetto.
 */
function humPhrase(notes) {
  const t0 = notes[0].t, last = notes[notes.length - 1];
  const len = last.t + last.dur + 0.2 - t0, total = Math.round(len * SR);
  const seed = 0x1badb002 + Math.round(t0 * 1000);
  const jit = slowNoise(len, seed, 28), shim = slowNoise(len, seed + 1, 7), br = noise(len, seed + 2);
  const pitchOf = (n) => (n.crack ? n.midi - 5 : n.midi);
  const o = new Float32Array(total);
  let ph = 0, g1 = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0;
  for (let i = 0; i < total; i++) {
    const t = t0 + i / SR, local = i / SR;
    let k = 0;
    while (k + 1 < notes.length && t >= notes[k + 1].t) k++;
    const n = notes[k], u = (t - n.t) / n.dur, abrupt = n.dur < 0.15 || !!n.crack, isLast = k === notes.length - 1;
    const prev = k ? pitchOf(notes[k - 1]) : pitchOf(n) - 0.7;                          // the first note is scooped up into
    let semis = prev + (pitchOf(n) - prev) * smoothstep((t - n.t) / (k ? 0.07 : 0.12));
    if (isLast && !abrupt) semis -= 0.9 * smoothstep((u - 0.45) / 0.55);                // trails off flat
    if (n.crack && u > 0.4) semis += 1.0 * Math.sin(t * 210) + 0.8 * br[i % br.length];
    const vibRamp = smoothstep((local - 0.28) / 0.35), vibDepth = n.dur > 0.4 ? 0.34 : 0.17;
    semis += vibDepth * vibRamp * Math.sin(2 * Math.PI * 5.1 * local) + 0.16 * jit[i];
    const f0 = hz(semis);
    ph += f0 / SR;
    ph -= Math.floor(ph);
    const g = glottal(ph), src = g - g1;                                                // flow derivative = the radiated voice
    g1 = g;
    // resonators: nasal F1 follows the pitch (so a high note still carries), F2 / F3 only a trace
    const f1 = Math.max(270, f0 * 1.04), r1 = Math.exp((-Math.PI * 110) / SR), c = 2 * r1 * Math.cos((2 * Math.PI * f1) / SR);
    const y1 = (1 - c + r1 * r1) * src + c * a1 - r1 * r1 * a2; a2 = a1; a1 = y1;
    const r2 = Math.exp((-Math.PI * 200) / SR), d = 2 * r2 * Math.cos((2 * Math.PI * 1050) / SR);
    const y2 = (1 - d + r2 * r2) * src + d * b1 - r2 * r2 * b2; b2 = b1; b1 = y2;
    const r3 = Math.exp((-Math.PI * 300) / SR), e = 2 * r3 * Math.cos((2 * Math.PI * 2400) / SR);
    const y3 = (1 - e + r3 * r3) * src + e * c1 - r3 * r3 * c2; c2 = c1; c1 = y3;
    let v = y1 + 0.22 * y2 + 0.06 * y3 + 0.012 * br[i % br.length] * smoothstep(local / 0.05);
    // loudness: onset dip on every note after the first, soft attack on the first, release on the last
    let env = k ? 0.6 + 0.4 * smoothstep((t - n.t) / 0.08) : smoothstep(local / 0.07);
    if (isLast) env *= abrupt ? Math.min(1, Math.max(0, (n.t + n.dur + 0.015 - t) / 0.03)) : Math.min(1, Math.max(0, (n.t + n.dur + 0.1 - t) / 0.14));
    env *= 1 + 0.1 * shim[i];
    if (n.crack && u > 0.4) env *= 0.65 + 0.35 * br[(i * 5) % br.length];
    o[i] = v * env;
  }
  let peak = 1e-6;
  for (const v of o) peak = Math.max(peak, Math.abs(v));
  return lowpass(lowpass(lowpass(o, 2300), 2300), 2300).map((v) => (v / peak) * 0.75);
}

/** Three decaying echoes: the bathroom. */
function bathroom(buf) {
  const o = new Float32Array(buf.length + Math.round(0.4 * SR));
  [[0, 1], [0.07, 0.38], [0.14, 0.24], [0.22, 0.14]].forEach(([d, g]) => { const k = Math.round(d * SR); for (let i = 0; i < buf.length; i++) o[i + k] += buf[i] * g; });
  return o;
}

export function renderHumAudio(path) {
  const { out, mix } = track(DURATION);
  const [shower, bus, lift, night, idea] = SHOTS;

  const phrases = [];
  for (const n of HUM) {
    const cur = phrases[phrases.length - 1];
    if (cur && n.t - (cur[cur.length - 1].t + cur[cur.length - 1].dur) < 0.12) cur.push(n); else phrases.push([n]);
  }
  for (const ph of phrases) {
    const pcm = humPhrase(ph);
    mix(ph[0].t < shower.t1 ? bathroom(pcm) : pcm, ph[0].t, 0.9);
  }
  const clip = (buf, a, b) => { const o = buf.slice(0, Math.round((b - a) * SR)); const f = Math.round(0.02 * SR); for (let i = 0; i < f; i++) o[o.length - 1 - i] *= i / f; return o; };

  mix(clip(highpass(lowpass(noise(shower.t1 - shower.t0, 11), 7000), 900), 0, shower.t1 - shower.t0), shower.t0, 0.2);   // water: only in the shower shot, cut dead on the cut
  mix(clip(lowpass(lowpass(noise(bus.t1 - bus.t0, 23), 140), 140), 0, bus.t1 - bus.t0), bus.t0, 0.9);                // bus engine rumble (bass only, no hiss)
  mix(clip(lowpass(lowpass(noise(lift.t1 - lift.t0, 37), 100), 100), 0, lift.t1 - lift.t0), lift.t0, 0.5);                 // lift hum (bass only)
  mix(bell(88, 0.7), T.ding, 0.32);                                                                  // the doors ding

  mix(bell(96, 0.5), T.bulb, 0.28);                                                                  // the idea
  mix(tick(2200, 0.05), T.bulb, 0.12);
  mix(lowpass(lowpass(whoosh(0.28), 1600), 1600), T.whoosh, 0.9);                                                                 // reaching, ends 0.02 s before the solo
  return writeWav(path, out);
}
