// "Tab Guy, ep. 5 — Wedding March": the same three-piece (public/band/) plays a wedding reception. The newlyweds walk in, the bassist asks for the
// Wedding March; the guitarist (Tab Guy) searches his phone (only piano sheet music, no guitar tab), plays it wrong twice and freezes while the
// bride's patience runs out and her bouquet wilts; the bassist plays the theme by ear, the drummer and the room join with a march, the bouquet
// bursts into petals on the reprise and she jumps; end card with the first line on real guitar frets ("your turn"). One timeline for the
// soundtrack (audio.mjs), the voices (voice.mjs) and every frame (src/wedding/WeddingScene.tsx).
// Tune: Mendelssohn, Wedding March (the theme, bars 6–13; same notes as `wedding` in src/services/melody/library.abc), ♩ = 130 (the source MIDI).
export const FPS = 60;
export const BPM = 120;
export const BEAT = 0.5;                      // the opening groove's beat
export const MB = 60 / 130;                   // one beat of the march, 0.4615 s

export const T = {
  endHit: 2.0,                                 // the band ends its song: roll + hit
  couple: 2.05,                                // the newlyweds walk in
  ask: 3.2,                                    // bassist: "Play the Wedding March!"
  phone: 4.9,                                  // camera on the guitarist, the phone comes up
  try1: 6.95,                                  // first try: two right notes, then a wrong one (miss1)
  try2: 7.95,                                  // second try (miss2)
  freeze: 8.75,                                // he stops; the room waits, the bouquet wilts
  listen: 9.95,                                // camera to the bassist
  lick: 10.5,                                  // the theme, by ear, on the bass
};
T.miss1 = T.try1 + 0.5;
T.miss2 = T.try2 + 0.5;
T.join = T.lick + 8 * MB;                      // bar 3: the drummer and the claps come in
T.hit = T.lick + 16 * MB;                      // the reprise ("C" again, the highest note): petals, the room's chord, the jump
T.card = T.hit + 2.3;
T.replay = T.card + 0.9;                       // the first line again, on a clean guitar, while the dots land on the frets
export const DURATION = T.card + 5.0;          // ≈ 25 s

// The opening bar (0 → endHit): a straight groove in C with a walking bass, then a four-note roll into the hit.
export const OPEN_KICKS = [0, 1.0], OPEN_SNARES = [0.5], OPEN_HATS = [0, 0.25, 0.5, 0.75, 1.0, 1.25];
export const OPEN_FILL = [1.5, 1.625, 1.75, 1.875];
export const OPEN_BASS = [36, 40, 43, 45, 46, 45].map((midi, i) => ({ t: i * 0.25, midi, dur: 0.24 }));

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'F#5' → MIDI (C4 = 60, as in library.abc). */
const midiOf = (n) => { const m = /^([A-G])(#?)(\d)$/.exec(n); return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] ? 1 : 0); };
/** 'C6:2 B5:1.5 …' → [{ o: beats from the start, midi, beats }]. */
const parse = (s) => { let o = 0; return s.split(' ').map((p) => { const [n, d] = p.split(':'); const r = { o, midi: midiOf(n), beats: Number(d) }; o += Number(d); return r; }); };
// The two lines of the theme (bars 1–4, 5–8) + the reprise's first bar; 4 beats a bar.
const THEME = parse('C6:2 B5:1.5 F#5:0.5 A5:1 G5:1 F5:1 D5:1 C5:1.833 B4:0.1667 D5:1 G4:0.75 D5:0.25 E5:2.5 C5:0.5 E5:0.5 G5:0.5 ' +
                    'C6:2 B5:1.5 F#5:0.5');
/** The bassist plays it three octaves down (G1…C3: frets 0–12 of a 4-string bass), the guitar replay two octaves down (G2…C4). */
export const LEAD = THEME.map((n) => ({ t: T.lick + n.o * MB, midi: n.midi - 36, dur: Math.max(0.12, n.beats * MB * 0.95) }));
/** Neck position for each melody note on a 4-string bass (E1 A1 D2 G2): of the strings that can play it, the one nearest the 5th fret. */
export const LEAD_POS = LEAD.map((n) => [28, 33, 38, 43].map((open, s) => ({ s, f: n.midi - open })).filter((p) => p.f >= 0 && p.f <= 12).sort((x, y) => Math.abs(x.f - 5) - Math.abs(y.f - 5))[0]);

// From bar 3 a march under the tune: kick on 1 and 3, snare + claps on 2 and 4, hats on the eighths.
const bar = (k) => T.lick + k * 4 * MB;
export const W_KICKS = [], W_SNARES = [], W_HATS = [], CLAPS = [];
for (let k = 2; k < 5; k++) {
  const d = bar(k);
  for (let i = 0; i < 8; i++) if (d + i * MB / 2 < T.card - 0.1) W_HATS.push(d + i * MB / 2);
  W_KICKS.push(d, d + 2 * MB);
  W_SNARES.push(d + MB, d + 3 * MB);
  for (const c of [d + MB, d + 3 * MB]) if (c < T.card - 0.1) CLAPS.push(c);
}
// The room under the reprise: a big C chord.
export const HIT_CHORDS = [{ t: T.hit, notes: [48, 52, 55, 60], dur: 2.2 }];
export const BEATS = [...[0, 0.5, 1.0, 1.5], ...Array.from({ length: 60 }, (_, i) => T.lick + i * MB)].filter((t) => t < T.card);

// The two tries (the guitarist, single notes from a half-seen sheet): C, B, then a sour one (F instead of F♯, G instead of F♯).
export const TRIES = [
  { t: T.try1, notes: [[0, 60], [0.25, 59], [0.5, 53]] },
  { t: T.try2, notes: [[0, 60], [0.25, 59], [0.5, 55]] },
];

// The end card: the first six notes of the theme on a 6-string guitar (E2 A2 D3 G3 B3 E4), all within the first four frets.
export const REPLAY = [
  { o: 0, s: 4, f: 1, midi: 60, beats: 2 }, { o: 2, s: 4, f: 0, midi: 59, beats: 1.5 }, { o: 3.5, s: 2, f: 4, midi: 54, beats: 0.5 },
  { o: 4, s: 3, f: 2, midi: 57, beats: 1 }, { o: 5, s: 3, f: 0, midi: 55, beats: 1 }, { o: 6, s: 2, f: 3, midi: 53, beats: 1.4 },
].map((n) => ({ s: n.s, f: n.f, midi: n.midi, dur: n.beats * MB * 0.95, t: T.replay + n.o * MB, o: n.o * MB }));

/** Lines, spoken by `who` ('narrator' | 'bassist'); `at` = start (s). Generated by voice.mjs. */
export const LINES = [
  { who: 'narrator', at: 0.08, say: 'Eight years of guitar.' },
  { who: 'narrator', at: 1.25, say: 'Can’t play the Wedding March.' },
  { who: 'bassist',  at: T.ask, say: 'Play the Wedding March!' },
  { who: 'narrator', at: T.phone + 0.6, say: 'He needed a tab.' },
  { who: 'narrator', at: T.freeze + 0.1, say: 'The couple didn’t wait.' },
  { who: 'narrator', at: T.listen + 0.05, say: 'She didn’t need one.' },
  { who: 'narrator', at: T.card + 0.15, say: 'Play what you hear. Not what you read.' },
];
/** Crowd clips from the pain sketch (pain/voice/crowd-*): index into pain/voice.mjs CROWD. */
export const REACTS = [
  { t: 0.0,              crowd: 2,  gain: 0.22 },
  { t: 0.3,              crowd: 1,  gain: 0.18 },
  { t: T.endHit + 0.1,   crowd: 11, gain: 0.5 },   // "Whoo!"
  { t: T.phone + 0.1,    crowd: 3,  gain: 0.12 },
  { t: T.phone + 1.2,    crowd: 5,  gain: 0.1 },
  { t: T.miss1 + 0.25,   crowd: 14, gain: 0.5 },   // "Oh no."
  { t: T.lick + 4.4,     crowd: 8,  gain: 0.5 },   // "That is amazing!"
  { t: T.hit + 0.15,     crowd: 11, gain: 0.7 },   // "Whoo!"
  { t: T.hit + 0.4,      crowd: 10, gain: 0.6 },   // "Yeah!"
];
