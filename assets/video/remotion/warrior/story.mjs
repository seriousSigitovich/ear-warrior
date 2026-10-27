// "Warrior" films — a pixel-art guitarist (the character sheet) plays an E-minor rock riff, a lead lick joins from bar 2, then he winds up during a snare
// roll and lands a big E chord with a jump and a crash. One timeline for the soundtrack (audio.mjs) and every frame (src/warrior/Warrior.tsx),
// so each sound is heard when it is seen.
//   RIFF — 2 bars, 5 s (the first test cartoon).   ROOT — 3 bars, 7 s (the "find the root" challenge: more time to listen).
export const FPS = 60;
export const BPM = 120;
export const EIGHTH = 60 / BPM / 2;          // 0.25 s
export const T0 = 0.15;                       // first chug
export const BAR = EIGHTH * 8;                // 2 s

// Power-chord roots (MIDI) for the eighth notes of each bar.
const RIFF_BARS = [
  [40, 40, 40, 43, 40, 40, 45, 43],           // E E E G E E A G
  [40, 40, 40, 43, 40, 40, 45, 47],           // … the same, ending on B
  [40, 40, 40, 43, 40, 40, 45, 43],
];
// Lead licks (E minor pentatonic) over bars 2 and 3: [offset s in the bar, midi, dur].
const LEADS = [
  null,
  [[0, 76, 0.46], [0.5, 79, 0.2], [0.75, 81, 0.2], [1.0, 83, 0.46], [1.5, 81, 0.2], [1.75, 79, 0.2]],
  [[0, 79, 0.46], [0.5, 81, 0.2], [0.75, 83, 0.2], [1.0, 79, 0.46], [1.5, 76, 0.2], [1.75, 79, 0.2]],
];

export function makeStory(bars) {
  const end = T0 + bars * BAR;
  const T = {
    bar2: T0 + BAR,                            // the lead joins
    fillAt: end - 0.5,                         // snare roll starts (also the wind-up)
    chord: end,                                // the big hit
    hold: end + 0.45 + 0.1,                    // after landing everything freezes a beat
  };
  const bar = (b) => T0 + b * BAR;
  const CHUGS = RIFF_BARS.slice(0, bars).flatMap((notes, b) => notes.map((midi, i) => ({ t: bar(b) + i * EIGHTH, midi, big: i % 4 === 0 })));
  const LEAD = LEADS.slice(1, bars).flatMap((lick, k) => lick.map(([o, midi, dur]) => ({ t: bar(k + 1) + o, midi, dur })));
  const per = (offsets) => Array.from({ length: bars }, (_, b) => offsets.map((o) => bar(b) + o)).flat().filter((t) => t < T.fillAt - 1e-6);
  return {
    DURATION: end + 0.85,                       // 5.0 s for two bars, 7.0 s for three
    T, CHUGS, LEAD,
    KICKS: per([0, 0.75, 1.0, 1.75]),
    SNARES: per([0.5, 1.5]),
    FILL: [0, 0.125, 0.25, 0.375].map((o) => T.fillAt + o),     // four sixteenths up to the chord
    HATS: CHUGS.map((c) => c.t + EIGHTH / 2).filter((t) => t < T.fillAt),
  };
}

export const RIFF = makeStory(2);
export const ROOT = makeStory(3);
