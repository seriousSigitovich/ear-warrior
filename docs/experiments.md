# Ear Warrior — Growth Experiments Log

What we are testing with the social challenge videos, what each variant changes, and what we
decided. One row per result, hypotheses stated *before* the numbers come in.

Videos are generated from `assets/video/challenge/` (`challenges.json` is the source of truth for
melodies #1–#7, `classics.mjs` for the famous-tune series #8+; render with `node render.mjs video <id|series|all>`).

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
| H4 familiar tune | play a melody everyone knows (Beethoven, a folk tune) instead of a generated one, and tease it in the hook | the 3-s hold and the number of comments with notes go up: recognition lowers the barrier to try | "viewed vs swiped away", comments with note names, average watch time | #8–#12 vs #6–#7 | not posted yet |
| H4b stat hook | open with a claim ("90% get it wrong") rather than a plain dare ("You know it. But can you play it by ear?") | the claim holds the first 3 s better — *or* it reads as clickbait and hurts | same | #8 (claim) vs #9–#12 (dare) | not posted yet |

**Not tested yet:** the app's feedback loop itself; the waitlist funnel (needs thousands of
views, far above current volume).

**Decision rules:** *to fill after the baseline from #1/#2 — "if metric X is clearly below/above Y
(a multiple, not 10–20 %), then we change/keep Z".*

**The "90%" is not a measured number.** It is a hook device taken from the brief; we have no data on how
many people miss these notes. Fine for a hook test (H4b), but if it wins, do not carry it into the store page or
landing as a fact — and drop it if comments call it out.

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

### Series #8–#12 — famous tunes

One Short per melody (`ear-challenge-NN`), YouTube Shorts, English. There are no separate answer videos (tried, cut):
the end card says "New melody in the next Short → Subscribe", which is the same reason to follow as the old "Follow
for challenge #N" in #1–#7 — so it is **not** a separate hypothesis. Nothing on screen promises an answer.

| # | Hook on screen | Melody | Notes | Timbre | Length |
|---|---|---|---|---|---|
| 8 | Can you play this by ear? *90% get it wrong* | Ode to Joy, Beethoven (C major) | E E F G G F E D | piano | 14.0 s |
| 9 | You know it. But can you *play it by ear?* | Für Elise, Beethoven (A minor) | E D♯ E D♯ E B D C A | piano | 10.9 s |
| 10 | You'll know it in one second. *Can you play it?* | Symphony No. 5, Beethoven (C minor) | G G G E♭ F F F D | piano | 14.5 s |
| 11 | Sounds easy? *Play it by ear* | Frère Jacques, French folk | C D E C C D E C | guitar | 14.0 s |
| 12 | Everyone knows this one. *Can you play it?* | Twinkle, Twinkle (Ah! vous dirai-je, maman), French folk | C C G G A A G | guitar | 14.0 s |

Structure of the quiz: headline + melody from frame 0 (keyboard in frame, each note pulses only its frame — no hint
which key) → headline swaps to "Write the notes in the comments" while the melody plays again at 70 % speed (`SERIES_SLOW`
in timeline.mjs) → end card. No countdown and no reveal: the Short is ~2.7 × melody + 4 s, and loops straight back into the melody. Melodies were transcribed from
memory and only the ones I was certain of used; check them against a score before posting. Who writes the right
notes is up to the comments — the tune is never named in the video.

Cleaner pairs: **#9 vs #11 vs #12** (same layout and copy structure, different melody and difficulty). **#8 vs #9–#12**
is the stat-hook test, but #8 is also the first of the series, so it is confounded with posting order.

---

## 3. Results log

| date | video | platform | hypothesis | metric | result | decision |
|---|---|---|---|---|---|---|
| 2026-10-03 | #1, #2 | TikTok | H1 | — | posted, no data yet | wait 24–48 h |
| 2026-10-04 | #8–#12 | YouTube Shorts | H4, H4b | — | #8 posted 2026-10-04 (3 views after 30 min); #9–#12 rendered, not posted | post the rest; #8 carries the stat hook |
| 2026-10-04 | #1–#7 (posted 2026-10-03) | YouTube Shorts | H1, H2 | Read from Studio ~1.5 days after posting. Channel: 519 views, **86.9 % from the Shorts feed**, 8.1 % channel pages, 4.1 % search; viewed vs swiped away **14.3 % / 85.7 %**; 79 engaged views; 3 likes; 0 subs; the only 2 comments are the channel's own. Per video: #2 407 (94 % feed; viewed **11.6 %** / swiped 88.4 %; 54 engaged views; avg 31 s on a 15 s clip ≈ 2 loops among those who stayed), #1 83, #7 11, #5 10, #4 5, #3 3. | the audience is cold (feed), and ~86–88 % of it swipes away; the few who stay loop ~2×. Baseline for the classic opening (1 s silent hook): ≈ 12 % viewed. No viewer comments, so H1's score-comments part has no evidence. Views are concentrated in one video (#2), n ≈ 400 — | **no decision.** Compare #8–#12 (cold open) against the 11.6–14.3 % baseline; only a multiple counts |
