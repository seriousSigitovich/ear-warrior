// "Tab Guy, ep. 2 — Happy Birthday": the same three-piece (public/band/) plays a friend's birthday. The cake rolls in, the bassist asks for
// Happy Birthday; the guitarist (Tab Guy) searches his phone (the tab is behind a sign-up wall), plays it wrong twice and freezes while the
// candles melt; the bassist plays the tune by ear, the drummer and the room join, the candles go out on the high note. End card: the first line
// on real guitar frets ("your turn"). One timeline for the soundtrack (audio.mjs), the voices (voice.mjs) and every frame (src/bday/BdayScene.tsx).
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;                 // 0.5 s

// --- the band's last bar before the cake (4/4, so the waltz later reads as a new song) ------------------------------------------------
export const T = {
  endHit: 2.0,                                 // the band ends its song: roll + hit
  cake: 2.05,                                  // the cake rolls in
  ask: 2.65,                                   // bassist: "Cake's here! Play Happy Birthday!"
  phone: 4.3,                                  // camera on the guitarist, the phone comes up
  try1: 6.35,                                  // first try: two right notes, then a wrong one (miss1)
  try2: 7.35,                                  // second try (miss2)
  freeze: 8.35,                                // he stops; the room waits, the candles melt
  listen: 9.85,                                // camera to the bassist
  lick: 10.4,                                  // "Hap-" — the tune by ear, on the bass
};
T.miss1 = T.try1 + 0.5;
T.miss2 = T.try2 + 0.5;
T.join = T.lick + 3.0;                         // second line: the drummer and the claps come in
T.hit = T.lick + 6.5;                          // "BIRTH-" of the third line: the octave leap, the candles go out
T.card = T.hit + 2.6;
T.replay = T.card + 1.0;                       // the first line again, on a clean guitar, while the dots land on the frets
export const DURATION = T.card + 4.7;          // ≈ 24.3 s

// The opening bar (0 → endHit): a straight groove in C with a walking bass, then a four-note roll into the hit.
export const OPEN_KICKS = [0, 1.0], OPEN_SNARES = [0.5], OPEN_HATS = [0, 0.25, 0.5, 0.75, 1.0, 1.25];
export const OPEN_FILL = [1.5, 1.625, 1.75, 1.875];
export const OPEN_BASS = [36, 40, 43, 45, 46, 45].map((midi, i) => ({ t: i * 0.25, midi, dur: 0.24 }));

// Happy Birthday in C, 3/4 (G2…G3 on the bass, frets 0–12): [seconds from T.lick, midi, length in s]. Pickups are a dotted eighth + sixteenth.
const MEL = [
  [0, 43, 0.37], [0.375, 43, 0.12], [0.5, 45, 0.48], [1.0, 43, 0.48], [1.5, 48, 0.48], [2.0, 47, 0.95],          // Happy birthday to you
  [3.0, 43, 0.37], [3.375, 43, 0.12], [3.5, 45, 0.48], [4.0, 43, 0.48], [4.5, 50, 0.48], [5.0, 48, 0.95],        // Happy birthday to you
  [6.0, 43, 0.37], [6.375, 43, 0.12], [6.5, 55, 0.48], [7.0, 52, 0.48], [7.5, 48, 0.48], [8.0, 47, 0.48], [8.5, 45, 1.3], // Happy BIRTHday dear Mi-a
];
export const LEAD = MEL.map(([o, midi, dur]) => ({ t: T.lick + o, midi, dur }));
/** Neck position for each melody note on a 4-string bass (E1 A1 D2 G2): of the strings that can play it, the one nearest the 5th fret. */
export const LEAD_POS = LEAD.map((n) => [28, 33, 38, 43].map((open, s) => ({ s, f: n.midi - open })).filter((p) => p.f >= 0 && p.f <= 12).sort((x, y) => Math.abs(x.f - 5) - Math.abs(y.f - 5))[0]);

// Under the tune: from the second line a soft waltz (kick on 1, hats on 2 and 3, claps on 2 and 3); bass roots on 1 from the hit.
const bar = (k) => T.lick + 0.5 + k * 1.5;    // downbeats of the tune's bars ("birth" of line 1 = bar 0)
export const W_KICKS = [], W_HATS = [], CLAPS = [];
for (let k = 2; k < 6; k++) {
  const d = bar(k);
  if (d < T.join - 0.01) continue;
  W_KICKS.push(d); W_HATS.push(d + BEAT, d + 2 * BEAT);
  if (d + BEAT < T.card) CLAPS.push(d + BEAT, d + 2 * BEAT);
}
// The room under the high note: a warm C chord, then F under "Mi-a" (MIDI triads for synth pad()).
export const HIT_CHORDS = [{ t: T.hit, notes: [48, 52, 55, 60], dur: 1.5 }, { t: T.hit + 1.5, notes: [48, 53, 57, 60], dur: 1.6 }];
export const BEATS = [...[0, 0.5, 1.0, 1.5], ...Array.from({ length: 40 }, (_, i) => T.lick + 0.5 + i * BEAT)].filter((t) => t < T.card);

// The two tries (the guitarist, single notes from a half-seen tab): two right notes, then a sour one.
export const TRIES = [
  { t: T.try1, notes: [[0, 55], [0.25, 55], [0.5, 56]] },     // G G A♭ (should be A)
  { t: T.try2, notes: [[0, 55], [0.25, 55], [0.5, 54]] },     // G G F♯
];

// The end card: the first line on a 6-string guitar (E2 A2 D3 G3 B3 E4), the 5th-fret box: G3 = D5, A3 = D7, C4 = G5, B3 = G4.
export const REPLAY = [
  { o: 0, s: 2, f: 5, midi: 55, dur: 0.33 }, { o: 0.375, s: 2, f: 5, midi: 55, dur: 0.12 }, { o: 0.5, s: 2, f: 7, midi: 57, dur: 0.45 },
  { o: 1.0, s: 2, f: 5, midi: 55, dur: 0.45 }, { o: 1.5, s: 3, f: 5, midi: 60, dur: 0.45 }, { o: 2.0, s: 3, f: 4, midi: 59, dur: 1.1 },
].map((n) => ({ ...n, t: T.replay + n.o }));

/** Lines, spoken by `who` ('narrator' | 'bassist'); `at` = start (s). Generated by voice.mjs. */
export const LINES = [
  { who: 'narrator', at: 0.08, say: 'Ten years of guitar.' },
  { who: 'narrator', at: 1.35, say: 'Can’t play Happy Birthday.' },
  { who: 'bassist',  at: T.ask, say: 'Cake’s here!' },
  { who: 'bassist',  at: T.ask + 0.75, say: 'Play Happy Birthday!' },
  { who: 'narrator', at: T.phone + 0.6, say: 'He needed a tab.' },
  { who: 'narrator', at: T.freeze + 0.1, say: 'The candles didn’t wait.' },
  { who: 'narrator', at: T.listen + 0.05, say: 'She didn’t need one.' },
  { who: 'narrator', at: T.card + 0.15, say: 'Play what you hear. Not what you read.' },
];
/** Crowd clips from the pain sketch (pain/voice/crowd-*): index into pain/voice.mjs CROWD. Chat under the opening, reactions later. */
export const REACTS = [
  { t: 0.0,              crowd: 2,  gain: 0.22 },  // chat: "Oh my god, I love this place…"
  { t: 0.3,              crowd: 1,  gain: 0.18 },  // chat: "Did you see the game…"
  { t: T.endHit + 0.1,   crowd: 11, gain: 0.5 },   // "Whoo!"
  { t: T.phone + 0.1,    crowd: 3,  gain: 0.12 },  // chat while they wait: "Hey, can you pass me that drink…"
  { t: T.phone + 1.2,    crowd: 5,  gain: 0.1 },   // chat: "Let us grab another one…"
  { t: T.miss1 + 0.25,   crowd: 14, gain: 0.5 },   // "Oh no."
  { t: T.lick + 4.2,     crowd: 8,  gain: 0.5 },   // "That is amazing!"
  { t: T.hit + 0.15,     crowd: 11, gain: 0.7 },   // "Whoo!"
  { t: T.hit + 0.4,      crowd: 10, gain: 0.6 },   // "Yeah!"
];
