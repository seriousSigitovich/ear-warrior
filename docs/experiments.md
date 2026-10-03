# Ear Warrior — Growth Experiments Log

What we are testing with the social challenge videos, what each variant changes, and what we
decided. One row per result, hypotheses stated *before* the numbers come in.

Videos are generated from `assets/video/challenge/` (`challenges.json` is the source of truth for
melodies and options; render with `node render.mjs video <id|all>`).

---

## 1. Hypotheses

**Product thesis (what the videos ultimately probe).** People are drawn to *active reproduction*
of a melody by ear ("hear it once → play it back"), not to recognizing or naming intervals.
The videos test the first half of that — interest in the *task*. They cannot test the app's
differentiator, the instant positive feedback loop: the viewer grades themselves.

| # | If we… | then… | measured by | test | status |
|---|---|---|---|---|---|
| H1 format | show a "hear once → play it back" challenge | viewers stay through the "Your turn" stage and some post a score | % watched to the end, retention after ~4–5 s, comments like "4/6" | #1, #2 (TikTok) | running — baseline |
| H2 hook | open with a direct dare ("Think your ear is good?"), sound from frame 0, keyboard in frame | the first 3 s retain better than a neutral line ("Play this by ear.") or a silent first second | 3-second hold, average watch time | #6 vs #7; vs #4, #2 | not posted yet |
| H3 difficulty | use short easy melodies (3–4 notes) vs 6 notes | easy ones get more attempts and score comments | comments with a score, completion | #1–#2 vs #3–#5 | secondary, not prioritized |

**Not tested yet:** the app's feedback loop itself; the waitlist funnel (needs thousands of
views, far above current volume).

**Decision rules:** *to fill after the baseline from #1/#2 — "if metric X is clearly below/above Y
(a multiple, not 10–20 %), then we change/keep Z".*

**Known confounds:** melodies differ between videos, so no comparison is perfectly clean (the
clean test is one melody, several hooks); small audiences make one day of data noisy.

---

## 2. Variants

| # | Hook on screen | Melody | Level, notes | Timbre | Time to play back | Opening |
|---|---|---|---|---|---|---|
| 1 | Can you play this *by ear?* | D4 E4 G4 (G major pent.) | L1, 3 | guitar | ~6.1 s | classic |
| 2 | Think your ear is *good?* | G4 A4 G4 C5 (C major pent.) | L2, 4 | piano | ~6.1 s | classic |
| 3 | Sounds easy. *Play it back.* | G4 E4 D4 G4 E4 C4 (C major pent.) | L3, 6 (repeated motif) | guitar | ~4.9 s | classic |
| 4 | No tabs. No sheet music. *Just your ear.* | G4 A4 G4 A4 B4 C5 (C major) | L5, 6 (sequence) | piano | ~4.7 s | classic |
| 5 | Minor key. *One listen.* | E4 G4 F4 E4 G4 A4 (A minor) | L7, 6 | voice | ~4.7 s | classic |
| 6 | Play this *by ear.* | F4 G4 E4 G4 A4 F4 (F major) | L5, 6 | piano | ~5.1 s | cold open |
| 7 | Think your / ear is *good?* | D4 E4 G4 E4 F#4 D4 (D major) | L5, 6 | piano | ~5.7 s | cold open |

All: 15 s, 1080×1920 — melody once → countdown → answer on a keyboard → "How many notes did you get?".

- **Classic opening (#1–5):** 1 s silent hook, then the melody; logo and pulse rings while listening; keyboard appears
  only at the answer; headline 100–116 px.
- **Cold open (#6–7):** melody on frame 0; keyboard on screen the whole video, each note only pulses its frame
  (no hint which key); headline up to 168 px.

Cleaner pairs: **#4 vs #6** (same level, timbre, note count — opening, hook and melody differ),
**#6 vs #7** (same layout and level — hook and melody differ), **#2 vs #7** (same hook text — layout, level and
note count differ).

---

## 3. Results log

| date | video | platform | hypothesis | metric | result | decision |
|---|---|---|---|---|---|---|
| 2026-10-03 | #1, #2 | TikTok | H1 | — | posted, no data yet | wait 24–48 h |
