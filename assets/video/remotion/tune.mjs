// Turns a tune file (tunes/*.json) into everything the video and the soundtrack need. Pure — no fs, no node APIs — so the Remotion bundle
// (src/Root.tsx) and the CLI (render.mjs, audio.mjs) read the very same result.
//
// Tune file:
//   { "id": "turkish-march", "bpm": 120, "key": "A minor",
//     "listen": "B3:.25 A3:.25 …",   // the question, ≤ 2 s  (scene 1, played again as the learner's answer in scene 3)
//     "tour":   "F4:.25 …",          // optional continuation, ≤ 2 s (scene 2: the neck tour). Absent → the neck tour replays `listen`.
//     "chord":  ["A2","E3","A3","C4"],   // optional final stab; default = the tonic triad of `key`
//     "copy":   { …any of DEFAULT_COPY… } }
// A note token is NAME:BEATS with an optional fretting, e.g. "C#4:.5" or "B3:.25@G4" (string letter + fret; E = low E, e = high e).
// Without `@` the fretting is chosen automatically: the path along the neck with the least hand movement.

export const FPS = 60;
export const SCENE = 2;                 // seconds per scene; the three musical scenes are 0–2, 2–4, 4–6 s
export const STINGER_AT = 6;
export const DURATION_SEC = 7;
export const OPEN = [40, 45, 50, 55, 59, 64];
export const MAX_FRET = 12;
const STRING_LETTERS = ['E', 'A', 'D', 'G', 'B', 'e'];
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export const DEFAULT_COPY = {
  listen: ['Hear it', '*once.*'],
  tour: ['Every note', 'has a *fret.*'],
  answer: ['Now play', 'it *back.*'],
  chip: 'Your answer',
  result: 'Every note *landed.*',
  tagline: 'Play it by ear. On guitar.',
  brand: 'EAR WARRIOR',
};

export function midiOf(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m || !(m[1] in PC)) throw new Error(`bad note name "${name}"`);
  return PC[m[1]] + 12 * (+m[2] + 1);
}

function parseNotes(str, label) {
  return str.trim().split(/\s+/).map((tok) => {
    const m = /^([A-G][#b]?-?\d):([\d./]+)(?:@([EADGBe])(\d+))?$/.exec(tok);
    if (!m) throw new Error(`${label}: cannot read note "${tok}" (expected NAME:BEATS or NAME:BEATS@G4)`);
    const beats = m[2].includes('/') ? m[2].split('/').reduce((a, b) => a / b) : +m[2];
    const midi = midiOf(m[1]);
    const note = { midi, beats };
    if (m[3]) {
      note.s = STRING_LETTERS.indexOf(m[3]);
      note.f = +m[4];
      if (OPEN[note.s] + note.f !== midi) throw new Error(`${label}: ${tok} — string ${m[3]} fret ${m[4]} sounds ${OPEN[note.s] + note.f}, not ${midi}`);
    }
    return note;
  });
}

/** Cheapest path over the neck: stay near the previous fret, avoid hopping strings, slight pull toward the nut. */
function autoFret(notes, label) {
  const cands = notes.map((n) => {
    if (n.s !== undefined) return [{ s: n.s, f: n.f }];
    const c = [];
    for (let s = 0; s < 6; s++) { const f = n.midi - OPEN[s]; if (f >= 0 && f <= MAX_FRET) c.push({ s, f }); }
    if (!c.length) throw new Error(`${label}: note ${n.midi} is off the 12-fret neck (E2–E5, MIDI 40–76)`);
    return c;
  });
  const cost = cands.map((c) => c.map(() => 0));
  const from = cands.map((c) => c.map(() => 0));
  cands[0].forEach((p, j) => { cost[0][j] = 0.03 * p.f; });
  for (let i = 1; i < cands.length; i++) {
    cands[i].forEach((p, j) => {
      let best = Infinity;
      cands[i - 1].forEach((q, k) => {
        const c = cost[i - 1][k] + Math.abs(p.f - q.f) + 0.4 * Math.abs(p.s - q.s) + 0.03 * p.f;
        if (c < best) { best = c; from[i][j] = k; }
      });
      cost[i][j] = best;
    });
  }
  let j = cost[cost.length - 1].indexOf(Math.min(...cost[cost.length - 1]));
  const out = new Array(notes.length);
  for (let i = notes.length - 1; i >= 0; i--) { out[i] = cands[i][j]; j = from[i][j]; }
  return out;
}

function triad(key) {
  const m = /^([A-G][#b]?)\s+(major|minor)$/i.exec(key ?? '');
  if (!m) return [];
  const pc = PC[m[1]];
  const root = 40 + ((pc - 40) % 12 + 12) % 12;
  return [root, root + 7, root + 12, root + 12 + (m[2].toLowerCase() === 'minor' ? 3 : 4)];
}

/** @returns the props the Remotion composition receives. */
export function resolveTune(raw) {
  const id = raw.id;
  if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('tune.id must be a lowercase slug (a-z, 0-9, -)');
  const bpm = raw.bpm;
  if (!(bpm > 30 && bpm < 300)) throw new Error(`${id}: bpm must be 30–300`);
  const beat = 60 / bpm;

  const sections = [['listen', 0, parseNotes(raw.listen ?? '', `${id}.listen`)]];
  const tourSrc = raw.tour ? parseNotes(raw.tour, `${id}.tour`) : sections[0][2];
  sections.push(['tour', SCENE, tourSrc], ['answer', 2 * SCENE, sections[0][2]]);

  const notes = [];
  for (const [phase, start, list] of sections) {
    const frets = autoFret(list, `${id}.${phase}`);
    let t = 0;
    list.forEach((n, i) => {
      notes.push({ phase, s: frets[i].s, f: frets[i].f, midi: n.midi, t: start + t * beat, dur: n.beats * beat });
      t += n.beats;
    });
    if (t * beat > SCENE + 1e-6) throw new Error(`${id}.${phase}: ${(t * beat).toFixed(2)} s at ${bpm} bpm — a scene is ${SCENE} s. Shorten the phrase or raise bpm.`);
  }
  const chord = raw.chord ? raw.chord.map(midiOf) : triad(raw.key);
  return {
    id,
    title: raw.title ?? id,
    bpm,
    beat,
    notes,
    listenCount: notes.filter((n) => n.phase === 'listen').length,
    chord,
    stingerAt: STINGER_AT,
    copy: { ...DEFAULT_COPY, ...(raw.copy ?? {}) },
    audio: `${id}.wav`,
    // optional: a rendered band mix to play instead of the synthesized pulse (see audio.mjs), and a longer film than the 7 s default
    band: raw.band ?? null,
    durationSec: raw.duration ?? DURATION_SEC,
  };
}
