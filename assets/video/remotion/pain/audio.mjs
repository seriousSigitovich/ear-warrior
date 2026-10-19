// Soundtrack of the pain sketch: recorded acoustic guitar (../synth.mjs) for every note, synthesized room tone, chatter, cheer, a cricket.
// The notes come from story.mjs — the same list the picture reads — so every wrong note is heard when it is seen.
import { track, guitarNote, writeWav, SR, whoosh, bell } from '../../synth.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DURATION, T, RIFF, ATTEMPTS, QUIET_MELODY, QUIET_LINE2, QUIET_HARMONY, QUIET_CHORD_AT, END_MELODY, END_CHORD_AT, WRONG_AT, RESTARTS
} from './story.mjs';
import { SEGS, SEG_STARTS, LINES, CUT_DURATION, locate } from './cut.mjs';
import { voicePath, CROWD, crowdPath } from './voice.mjs';

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 0xffffffff) * 2 - 1; };
}
/** Piecewise-linear envelope: env([[t,v],…])(t). */
const env = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return pts[pts.length - 1][1];
};

function kick(len = 0.28) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, f = 48 + 120 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.002);
  }
  return o;
}
function noiseBurst(len, decay, hp = 0.9, seed = 0x1234567) {
  const r = rand(seed), total = Math.round(len * SR), o = new Float32Array(total);
  let prev = 0;
  for (let i = 0; i < total; i++) { const n = r(); o[i] = (n - prev * hp) * Math.exp(-(i / SR) * decay); prev = n; }
  return o;
}
/** A fret that does not ring: a dull "thunk" with a bit of string buzz. */
function deadNote(len = 0.22) {
  const total = Math.round(len * SR), o = new Float32Array(total), r = rand(77);
  let lp = 0;
  for (let i = 0; i < total; i++) { const t = i / SR; lp += 0.16 * (r() - lp); o[i] = lp * 2.2 * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 138 * t) * Math.exp(-t * 28) * 0.4; }
  return o;
}
/** Chatter: several "voices" of low-passed noise, each opened and closed at a syllable rate, scaled by level(t). */
function babble(out, level, from, to, seed) {
  const r = rand(seed);
  for (let v = 0; v < 5; v++) {
    const f1 = 2.2 + 1.6 * Math.abs(r()), f2 = 0.35 + 0.5 * Math.abs(r()), p1 = r() * 6, p2 = r() * 6, a = 0.07 + 0.1 * Math.abs(r());
    let y = 0, z = 0;
    for (let i = Math.round(from * SR); i < Math.min(out.length, Math.round(to * SR)); i++) {
      const t = i / SR;
      y += a * (r() - y); z += 0.5 * (y - z);                              // two one-pole low-passes ≈ a muffled vowel
      const syl = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * f1 * t + p1), 2) * (0.35 + 0.65 * Math.max(0, Math.sin(2 * Math.PI * f2 * t + p2)));
      out[i] += z * syl * level(t) * 0.55;
    }
  }
}
function cheer(out, from, to) {
  const r = rand(5);
  let y = 0, z = 0;
  const e = env([[from, 0], [from + 0.5, 1], [to - 0.6, 1], [to, 0.6]]);
  for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) {
    const t = i / SR;
    y += 0.2 * (r() - y); z += 0.3 * (y - z);
    out[i] += (z * 1.1 + (r() - y) * 0.06) * e(t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5.3 * t) * Math.sin(2 * Math.PI * 1.7 * t));
  }
}

/**
 * Where events land. Without `cut` it is the plain 60 s track. With it, every event is routed by its 60 s time into the cut's segment
 * that covers it, placed at the compressed time and clipped at that segment's edges; moments that were cut out simply drop.
 */
function makeMixer(cut) {
  if (!cut) {
    const { out, mix } = track(DURATION);
    return { out, mix, speed: () => 1, finish: () => out };
  }
  const bufs = SEGS.map((g) => new Float32Array(Math.round(g.len * SR)));
  const mix = (buf, t, gain = 1) => {
    const p = locate(t);
    if (!p) return;
    const dst = bufs[p.k], o = Math.round((p.out - SEG_STARTS[p.k]) * SR);
    for (let i = 0; i < buf.length && o + i < dst.length; i++) dst[o + i] += buf[i] * gain;
  };
  const finish = () => {
    const out = new Float32Array(Math.round(CUT_DURATION * SR)), fade = Math.round(0.02 * SR);
    bufs.forEach((b, k) => {
      const at = Math.round(SEG_STARTS[k] * SR);
      for (let i = 0; i < b.length && at + i < out.length; i++) out[at + i] += b[i] * Math.min(1, i / fade, (b.length - i) / fade);
    });
    return out;
  };
  return { out: null, mix, speed: (t) => locate(t)?.speed ?? 1, finish };
}

/**
 * The soundtrack as samples — the 60 s one, or (`cut`) the same events laid into the compressed cut.
 * `crowd: false` leaves out the synthesized chatter, cheer and claps (all filtered noise — it reads as hiss).
 */
function buildPain({ crowd: withCrowd = true, cut = false } = {}) {
  const { out, mix, speed, finish } = makeMixer(cut);
  // a note keeps its pitch; a faster passage gets shorter notes
  const note = (n, gain = 0.9, rel = 0.12) => mix(guitarNote(n.midi, Math.max(0.1, (n.dur * 1.05) / speed(n.t)), rel), n.t, gain);

  // 0–11: the riff (the template's pulse joins at 3 s, once the "legend" part starts)
  for (const n of RIFF) note(n, 0.85, 0.08);
  const k = kick(), hat = noiseBurst(0.07, 60);
  for (let b = 0; T.legend + b * 0.5 < T.party; b++) {
    const t = T.legend + b * 0.5;
    mix(k, t, b % 2 === 0 ? 0.55 : 0.35);
    mix(hat, t + 0.25, 0.14);
  }

  // 11–17: party. Chatter is loud until someone asks, then everyone goes quiet.
  const crowd = env([
    [T.party, 0.7], [T.ask - 0.1, 0.9], [T.ask + 0.5, 0.12], [T.phone + 2, 0.12], [T.fail, 0.18], [20.2, 0.18], [20.6, 0.4], [21.5, 0.22], [26.2, 0.2], [26.8, 0.42],
    [28, 0.22], [34.6, 0.14], [35.2, 0.28], [36.4, 0.1], [T.silence, 0], [T.quiet - 0.4, 0], [T.quiet + 1.2, 0.18], [48, 0.28], [49, 0.12], [T.end, 0],
  ]);
  if (withCrowd) babble(out, crowd, T.party, T.end, 42);
  // phone: low-battery double blip then a falling "no signal" tone
  const blip = (f, len) => { const n = Math.round(len * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.sin((2 * Math.PI * f * i) / SR) * Math.min(1, i / 200) * Math.min(1, (n - i) / 400); return o; };
  mix(blip(988, 0.09), T.phone + 0.15, 0.25); mix(blip(988, 0.09), T.phone + 0.3, 0.25);
  mix(blip(392, 0.16), T.phone + 1.25, 0.28); mix(blip(294, 0.28), T.phone + 1.45, 0.28);

  // 17–37: his attempts. A wrong note is a real note a semitone off; each ends with a dead-string thunk.
  for (const n of ATTEMPTS) note(n, n.ok ? 0.85 : 0.95, n.ok ? 0.12 : 0.3);
  for (const t of WRONG_AT) mix(deadNote(), t + 0.55, 0.5);
  for (const t of RESTARTS) mix(noiseBurst(0.09, 40, 0.3, 91), t, 0.25);      // palm on the strings
  mix(noiseBurst(0.12, 30, 0.2, 14), 30.9, 0.12);                            // a throat clearing somewhere in the crowd

  // 37–41: silence — a fridge, a cricket, a cough
  const r = rand(3), hum = new Float32Array(Math.round((T.quiet - T.silence) * SR));
  for (let i = 0; i < hum.length; i++) hum[i] = Math.sin((2 * Math.PI * 58 * i) / SR) * 0.006 + r() * 0.0015;
  mix(hum, T.silence, 1);
  const chirp = new Float32Array(Math.round(0.035 * SR));
  for (let i = 0; i < chirp.length; i++) chirp[i] = Math.sin((2 * Math.PI * 4300 * i) / SR) * Math.sin((Math.PI * i) / chirp.length) * 0.02;
  for (let c = 0; T.silence + 0.4 + c * 1.1 < T.quiet - 0.3; c++) for (let p = 0; p < 3; p++) mix(chirp, T.silence + 0.4 + c * 1.1 + p * 0.07, 1);
  mix(noiseBurst(0.22, 14, 0.5, 8), 38.4, 0.2);

  // 41–53: Quiet Guy. Slightly softer, steadier; second voice a third below on the second line; a chord to finish.
  for (const n of QUIET_MELODY) note(n, 0.85, 0.1);
  for (const n of QUIET_LINE2) note(n, 0.85, 0.1);
  for (const n of QUIET_HARMONY) note(n, 0.55, 0.1);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 1.2, 0.5), QUIET_CHORD_AT + [48, 55, 60, 64, 67].indexOf(m) * 0.02, 0.5);
  if (withCrowd) cheer(out, 49.4, T.end + 0.4);
  const clap = noiseBurst(0.05, 70, 0.5, 12);
  const rc = rand(21);
  for (let t = 50.2; (withCrowd || cut) && t < 53.2; t += 0.07 + Math.abs(rc()) * 0.14) mix(clap, t, 0.06 + 0.08 * Math.abs(rc()));

  // 53–60: end card — a chord, the phrase on the app's fretboard, a resolving chord
  mix(kick(0.4), T.end, 0.9);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 1.4, 0.6), T.end + [48, 55, 60, 64, 67].indexOf(m) * 0.02, 0.45);
  for (const n of END_MELODY) note(n, 0.8, 0.1);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 2.6, 1.2), END_CHORD_AT + [48, 55, 60, 64, 67].indexOf(m) * 0.018, 0.65);
  mix(kick(0.4), END_CHORD_AT, 0.8);

  return finish();
}

export function renderPainAudio(outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  return writeWav(outPath, buildPain());
}

/** A voice line as mono samples at SR, sped up (never slowed) if it would not fit in `maxSec`. */
function loadVoice(file, maxSec) {
  const raw = (tempo) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', `atempo=${tempo}`, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  let buf = raw(1), n = buf.length / 4;
  if (n / SR > maxSec) {
    const tempo = Math.min(1.3, (n / SR) / maxSec);
    console.log(`  voice line ${file.split('/').pop()}: ${(n / SR).toFixed(2)} s > ${maxSec.toFixed(2)} s → ×${tempo.toFixed(2)}`);
    buf = raw(tempo); n = buf.length / 4;
  }
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = buf.readFloatLE(i * 4);
  let peak = 0;
  for (const x of v) peak = Math.max(peak, Math.abs(x));
  return v.map((x) => (x / (peak || 1)) * 0.8);
}


// --- the room (cut only): voices mixed into a murmur and into reactions, plus the hits that punctuate the cuts --------------------------------
function loadClip(file, filter) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const v = new Float32Array(buf.length / 4);
  let peak = 0;
  for (let i = 0; i < v.length; i++) { v[i] = buf.readFloatLE(i * 4); peak = Math.max(peak, Math.abs(v[i])); }
  return v.map((x) => x / (peak || 1));
}
/** Same voice, other pitch/speed (r > 1 = higher and faster), so a handful of clips reads as many people. */
function resample(v, r) {
  const o = new Float32Array(Math.floor(v.length / r));
  for (let i = 0; i < o.length; i++) { const x = i * r, i0 = Math.floor(x), f = x - i0; o[i] = v[i0] * (1 - f) + (v[i0 + 1] ?? 0) * f; }
  return o;
}
/** 60 s timeline time → cut time; a moment that was cut out maps to where the next segment starts. */
function outAt(src) {
  for (let k = 0; k < SEGS.length; k++) {
    const g = SEGS[k];
    if (src < g.from) return SEG_STARTS[k];
    if (src < g.to) return SEG_STARTS[k] + ((src - g.from) * g.len) / (g.to - g.from);
  }
  return CUT_DURATION;
}
const segStart = (id) => SEG_STARTS[SEGS.findIndex((g) => g.id === id)];

function addRoom(out) {
  const add = (buf, at, gain) => { const o = Math.round(at * SR); for (let i = 0; i < buf.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += buf[i] * gain; };
  const have = CROWD.map((_, i) => existsSync(crowdPath(i)));
  const rr = rand(1234);

  // murmur: the chat clips, low-passed and echoed, at random pitches, laid across the whole cut; its level follows the story
  const chat = CROWD.map((c, i) => (c.kind === 'chat' && have[i] ? i : -1)).filter((i) => i >= 0);
  if (chat.length) {
    const clips = chat.map((i) => loadClip(crowdPath(i), 'highpass=f=200,lowpass=f=2800,aecho=0.8:0.6:45|90:0.35|0.22'));
    const walla = new Float32Array(out.length);
    for (let n = 0; n < 16; n++) {
      const clip = resample(clips[n % clips.length], 0.86 + 0.3 * Math.abs(rr())), at = Math.floor(Math.abs(rr()) * (walla.length - clip.length * 0.6)), g = 0.5 + 0.5 * Math.abs(rr());
      for (let i = 0; i < clip.length && at + i < walla.length; i++) walla[at + i] += clip[i] * g;
    }
    let peak = 0;
    for (const x of walla) peak = Math.max(peak, Math.abs(x));
    const level = [[11.7, 0.55], [12.6, 0.8], [12.75, 0.12], [13.4, 0.08], [16.9, 0.1], [17.6, 0.14], [20.3, 0.14], [20.45, 0.4], [21.1, 0.2], [38.9, 0.08], [41.0, 0.02],
      [43.0, 0.1], [45.0, 0.3], [46.4, 0.5], [48.5, 0.75], [50.8, 0.9]].map(([s, v]) => [outAt(s), v]);
    const lvl = (t) => {
      if (t <= level[0][0]) return level[0][1];
      for (let i = 1; i < level.length; i++) if (t <= level[i][0]) { const [t0, v0] = level[i - 1], [t1, v1] = level[i]; return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
      return level[level.length - 1][1];
    };
    for (let i = 0; i < walla.length; i++) out[i] += (walla[i] / (peak || 1)) * lvl(i / SR) * 0.3;
  }

  // reactions as the quiet guy plays (and one "oh no" at the wrong note): [60 s time, clip, gain, rate]
  const react = (c) => CROWD.findIndex((x) => x.say === c);
  for (const [src, say, gain, rate] of [[20.6, 'Oh no.', 0.5, 1], [44.2, 'Wow.', 0.5, 1], [44.8, 'Whoa, he is good!', 0.6, 1], [45.6, 'That is amazing!', 0.6, 1], [46.9, 'Yeah!', 0.7, 1],
    [47.6, 'Play more!', 0.6, 1], [48.3, 'Whoo!', 0.8, 1], [49.0, 'Oh my god!', 0.7, 1], [49.5, 'Encore!', 0.7, 1], [49.9, 'Whoo!', 0.8, 1.1], [50.3, 'Yeah!', 0.7, 0.93]]) {
    const i = react(say), p = locate(src);
    if (i < 0 || !have[i] || !p) continue;
    add(resample(loadClip(crowdPath(i), 'highpass=f=140,lowpass=f=6000,aecho=0.8:0.7:70|140:0.3|0.18'), rate), p.out, gain * 0.55);
  }

  // punctuation: a whoosh into each scene change, a boom on the wrong note, a "ding" as "Tabs used: 0" lands
  for (const id of ['ask', 'handover', 'end']) add(whoosh(0.32), segStart(id) - 0.3, 0.45);
  const wrong = locate(20.35), tab = locate(41.2);
  if (wrong) add(kick(0.5), wrong.out, 0.9);
  if (tab) add(bell(84, 0.9), tab.out, 0.3);

  // the room holds its breath just before the quiet guy's first note
  const first = locate(42.5);
  if (first) {
    const a = Math.round((first.out - 0.5) * SR), b = Math.round((first.out - 0.03) * SR), ramp = Math.round(0.04 * SR);
    for (let i = a; i < b; i++) out[i] *= 1 - 0.9 * Math.min(1, (i - a) / ramp, (b - i) / ramp);
  }
}

/** The cut's soundtrack: the same music events at the compressed times (no crowd noise), ducked under the narrator when the voice files exist. */
export function renderPainCutAudio(outPath) {
  const out = buildPain({ crowd: false, cut: true });
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  const bed = 0.35 / (peak || 1);
  for (let i = 0; i < out.length; i++) out[i] *= bed;
  addRoom(out);
  let voiced = 0;
  LINES.forEach((line, i) => {
    if (!existsSync(voicePath(i))) return;
    const next = i + 1 < LINES.length ? LINES[i + 1].at : CUT_DURATION;
    const v = loadVoice(voicePath(i), next - line.at - 0.08);
    const start = Math.round(line.at * SR), ramp = Math.round(0.12 * SR);
    for (let k = -ramp; k < v.length + ramp; k++) {                          // duck the music 55 % while the line plays
      const d = 1 - 0.55 * Math.min(1, (k + ramp) / ramp, (v.length + ramp - k) / ramp);
      const j = start + k;
      if (j >= 0 && j < out.length) out[j] *= d;
    }
    for (let k = 0; k < v.length && start + k < out.length; k++) out[start + k] += v[k];
    voiced++;
  });
  mkdirSync(dirname(outPath), { recursive: true });
  const raw = writeWav(outPath, out);
  // short-form loudness: the mix peaks well below full scale (one narrator line, a guitar bed), so bring it to about -14 LUFS
  const tmp = `${outPath}.norm.wav`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', outPath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=8', '-ar', String(SR), '-ac', '1', tmp]);
  renameSync(tmp, outPath);
  return { peak: raw, voiced };
}
