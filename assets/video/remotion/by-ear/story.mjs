// "By ear" — a 5 s animation: he LISTENS to a phrase, then works it out on the guitar by ear (one wrong note, caught and fixed), then nails it.
// One timeline for the soundtrack (audio.mjs) and every frame (src/byear/ByEar.tsx), so each sound is heard when it is seen.
export const FPS = 60;
export const DURATION = 5;

// Ode to Joy, first six notes. `f` = fret on the B string (E4 = 5, F4 = 6, G4 = 8): a hand that really has to travel.
const PHRASE = [[64, 5], [64, 5], [65, 6], [67, 8], [67, 8], [65, 6]];

/** The beats of the film. */
export const T = {
  listen: 0.4,       // first heard note
  earDown: 2.1,      // hand leaves the ear, the world "un-mutes"
  play: 2.5,         // first note played back
  miss: 2.98,        // the wrong note (a G where the F should be)
  fix: 3.34,         // the right F, after a held beat
  chord: 4.3,        // the resolving strum
};

export const HEARD_BEAT = 0.27;
/** What he hears (from the speaker). */
export const HEARD = PHRASE.map(([midi, f], i) => ({ t: T.listen + i * HEARD_BEAT, midi, f }));

/** What he plays, in order, including the wrong note. `ok:false` is the miss. */
export const ATTEMPTS = [
  { t: 2.5, midi: 64, f: 5, ok: true, idx: 0 },
  { t: 2.74, midi: 64, f: 5, ok: true, idx: 1 },
  { t: T.miss, midi: 67, f: 8, ok: false, idx: 2 },
  { t: T.fix, midi: 65, f: 6, ok: true, idx: 2 },
  { t: 3.58, midi: 67, f: 8, ok: true, idx: 3 },
  { t: 3.82, midi: 67, f: 8, ok: true, idx: 4 },
  { t: 4.06, midi: 65, f: 6, ok: true, idx: 5 },
];
