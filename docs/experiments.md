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
| H4 familiar tune | play a melody everyone knows (Beethoven, a folk tune) instead of a generated one, and tease it in the hook | the 3-s hold and the number of comments with notes go up: recognition lowers the barrier to try | "viewed vs swiped away", comments with note names, average watch time | #8–#12 vs #6–#7 | running — #8, #9 posted 2026-10-04, ~1 day of data; 2 comments with notes so far, both under #8 (TikTok + YouTube), none under the generated melodies |
| H4b stat hook | open with a claim ("90% get it wrong") rather than a plain dare ("You know it. But can you play it by ear?") | the claim holds the first 3 s better — *or* it reads as clickbait and hurts | same | #8 (claim) vs #9–#12 (dare) | running — #8 (claim) and #9 (dare) posted; viewed/swiped not yet available |
| H5 visual | show a guitar fretboard instead of the piano keyboard, same melody (Twinkle), hook, timing and guitar sound | the guitar audience recognises "their" instrument, so the viewed % and the note-comments go up — *or* guitarists can't name notes by ear and comments drop | viewed vs swiped away, comments with notes, views per hour | #13 vs #12 (same everything, only the picture differs) | rendered 2026-10-05, not posted. Baseline to beat/match: #12 ≈ 31 % viewed |
| H6 full tune | play the whole tune (Korobeiniki, 8 bars, 37 notes) instead of a 7–8 note phrase, guitar sound and fretboard picture like #13 | fewer people try to write 37 notes, so note-comments per view drop — *or* the tune is so familiar that people write it anyway, and those who do write longer comments | viewed vs swiped away, comments with notes and how many notes each has, average view duration | #14 vs #12/#13 (guitar, 7–8 notes) | rendered 2026-10-05, not posted |

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
| 13 | Everyone knows this one. *Can you play it?* (same as #12) | Twinkle, Twinkle — identical to #12 | C C G G A A G | guitar | 14.0 s | **fretboard instead of keyboard** (H5); the tag reads #13 |
| 14 | You know it. Now play *the whole thing* | Korobeiniki (Tetris theme, part A), Russian folk (A minor) | 37 notes, 8 bars: E B C D C B A A C E D C B C D E C A A D F A G F E C E D C B B C D E C A A | guitar | 36.7 s | **full tune, fretboard** (H6); the Short is ~2.7 × the melody + 4 s |

Structure of the quiz: headline + melody from frame 0 (keyboard in frame, each note pulses only its frame — no hint
which key) → headline swaps to "Write the notes in the comments" while the melody plays again at 70 % speed (`SERIES_SLOW`
in timeline.mjs) → end card. No countdown and no reveal: the Short is ~2.7 × melody + 4 s, and loops straight back into the melody. Melodies were transcribed from
memory and only the ones I was certain of used; check them against a score before posting. Who writes the right
notes is up to the comments — the tune is never named in the video.

Cleaner pairs: **#12 vs #13** (the cleanest of all: same melody, hook, timing and audio — only the instrument picture differs; confounds: #13 is a repeat of a tune the channel already showed, and it starts without #12's early momentum). **#9 vs #11 vs #12** (same layout and copy structure, different melody and difficulty). **#8 vs #9–#12**
is the stat-hook test, but #8 is also the first of the series, so it is confounded with posting order.

---

## 3. Results log

| date | video | platform | hypothesis | metric | result | decision |
|---|---|---|---|---|---|---|
| 2026-10-03 | #1, #2 | TikTok | H1 | — | posted, no data yet | wait 24–48 h |
| 2026-10-04 | #8–#12 | YouTube Shorts | H4, H4b | — | #8 posted 2026-10-04 (3 views after 30 min); #9–#12 rendered, not posted | post the rest; #8 carries the stat hook |
| 2026-10-04 | #1–#7 (posted 2026-10-03) | YouTube Shorts | H1, H2 | Read from Studio ~1.5 days after posting. Channel: 519 views, **86.9 % from the Shorts feed**, 8.1 % channel pages, 4.1 % search; viewed vs swiped away **14.3 % / 85.7 %**; 79 engaged views; 3 likes; 0 subs; the only 2 comments are the channel's own. Per video: #2 407 (94 % feed; viewed **11.6 %** / swiped 88.4 %; 54 engaged views; avg 31 s on a 15 s clip ≈ 2 loops among those who stayed), #1 83, #7 11, #5 10, #4 5, #3 3. | the audience is cold (feed), and ~86–88 % of it swipes away; the few who stay loop ~2×. Baseline for the classic opening (1 s silent hook): ≈ 12 % viewed. No viewer comments, so H1's score-comments part has no evidence. Views are concentrated in one video (#2), n ≈ 400 — | **no decision.** Compare #8–#12 (cold open) against the 11.6–14.3 % baseline; only a multiple counts |
| 2026-10-04 | #8, #9 (posted 2026-10-04) + #1–#7 | YouTube Shorts | H4, H4b | Read from Studio ~1 day after posting. Channel, last 48 h: 2 049 views. Shorts list: 8 videos, ≈ 1 950 views total. The 0:15 "Can you play this by ear?" video (by length and title most likely **#8**, Studio does not show the number) **≈ 1 085** views in < 1 day, 94.3 % from the Shorts feed, 1.6 % search, 1.5 % channel pages; the 0:11 "Answer in comments!" video (most likely **#9**) 372 views after ~3 h (the list showed 286 and lagged); #2 (best of the first batch) 452. Viewed vs swiped for the new videos is **not available yet** (Studio: up to ~2 days); the channel-wide 14.3 % / 85.7 % still describes #1–#7. 3 likes in 28 days, 0 subscribers. **A viewer also wrote the notes of Ode to Joy in the comments of #8 on YouTube** (reported by the author; I did not open the comments). | the cold open (#8) draws roughly 2.4× the views of the best classic-opening video in its first day, all of it from the feed — but views are not retention, and #8 is also the first of the series (posting-order confound) | **no decision.** Re-read viewed/swiped for #8 and #9 in ~2 days and compare against the 11.6–14.3 % baseline |
| 2026-10-04 | #1–#9 | TikTok | H1, H4, H4b | Read from Studio list + profile. 4 posts, 365 views in total: 133 ("Check you musical ears", 3 Oct), 71 (#2, 4 notes), **160 (#8, "90% get it wrong")**, 1 (the 10 s #9, posted 21:35). 7 likes, 5 comments in total. Studio 7-day analytics lags (56 views). Traffic: For You 52.2 %, own profile 47.8 %, search/sound 0. **#8: 160 views, 2 likes, 2 comments — one is a viewer who typed the notes `E E F G G F E D` (correct Ode to Joy), one of two organic note-comments so far (the other is on YouTube, same video)**; the second is a reply under it (not opened). | volume is 3–4× lower than YouTube, but this is the first evidence for the product thesis: a viewer recognised the tune and reproduced it by ear, unprompted. n = 1, so it supports the format, it does not measure it | **no decision.** Keep #8's hook + familiar-tune format running; look for note-comments on #9–#12 |
| 2026-10-04 | #8, #9, #2 + 1 more | Instagram | H1, H4 | Insights, last 30 days. Account views 59 / 55 viewers, 100 % non-followers, 100 % Reels; top reels by views 89 / 87 / 79 / 59 (the account total looks lagging relative to the per-reel numbers — trust the per-reel ones). Interactions: 1 account, best reel 3. **11 profile visits, which came from the reels (per the author)**. 3 posts, 8 followers, 68 following. | like YouTube, the audience is cold (nobody who follows us sees the reels); no note-comments. The 11 profile visits are the only "wants to know who made this" action seen on any platform so far (≈ 3.5 % of ~314 per-reel views, or ≈ 20 % of the 55 account-level viewers — the denominator is unreliable, see above), and some followers did subscribe on their own (per the author; the lists cannot tell who was first, see the followers audit) | **no decision.** Track profile visits per reel as the cheapest interest metric; check what the profile page offers (link, bio) so a visit can convert |
| 2026-10-04 | all | TikTok, Instagram, YouTube | growth | Followers audit. TikTok 6 followers, Instagram 8, YouTube 0 subscribers. All 6 + 8 are mutual (we follow them), **but the author followed back everyone who followed immediately, so mutual status says nothing about who followed first**; the author confirms that some of them did follow on their own. We follow 49 (TikTok) / 68 (Instagram) accounts. | an earlier version of this row claimed "organic followers = 0" from the mutual lists — that was a wrong inference and is withdrawn. The true organic count is **unknown, > 0**; follower counts cannot be split by origin after the fact, and some of the mutuals may be follow-backs of our own outreach | **rule:** from now on log the origin at the moment a follower appears (they followed first vs we followed first), e.g. from the Activity/notification feed, and count only the first kind. Re-check in ~1 week |
| 2026-10-05 | last Instagram video (most likely #12) | Instagram | waitlist | **First cold waitlist lead.** An unknown person (not a friend, not a test) signed up from the latest Instagram Reel. Reported by the author; source tag and exact video not read from the data. The author later said it is the same lead the author linked to #12 (the latest video), so it is most likely the Instagram Reel of #12 — unconfirmed. | the whole funnel works end to end: video → profile → link → form → email. n = 1: it proves the path exists, it does not measure the conversion. Goal: 100 cold leads | **no decision.** Check the stored source tag (`instagram:…`?) to confirm the link in bio carries UTM; from now on log each lead's platform and video when it appears. Track per 1 000 views: profile visits → link clicks → signups |
| 2026-10-05 | #12 (Twinkle, Twinkle) | YouTube Shorts (confirmed by the author) | H4, H3, waitlist | Reported by the author ~8 h after posting: **> 1 000 views in 8 h**, **31 % continued watching** (viewed vs swiped), the highest engagement of any video so far, **2 comments**; the 1 lead the author mentioned came from Instagram, not Shorts (see the 2026-10-05 waitlist row). Not read from Studio by me; exact views, the other videos' viewed % and the lead's source tag are not known. | 31 % vs the 11.6–14.3 % classic-opening baseline is ≈ 2.2–2.7×, which passes the "a multiple, not 10–20 %" rule. Pace is also faster than #8 (≈ 1 085 views in < 1 day). But #12 is the most familiar *and* easiest melody (7 notes), has the "Everyone knows this one" hook, and is the last in the series — H4 (familiarity), H3 (difficulty), hook and posting order are all confounded. 2 comments on ~1 000 views ≈ 0.2 %, n = 2. No Shorts lead: the single lead so far came from Instagram, so Shorts has 0 signups on ~1 000 views | **no decision.** Re-read viewed % for #8–#11 in ~2 days: if #12 is clearly above the other four, that is a familiarity gradient inside one series (H4); if not, suspect order / algorithm. Check whether the 2 comments contain notes |
| 2026-10-05 | #13 | YouTube Shorts | H5 | — | rendered (`node render.mjs video 13`), `out/ear-challenge-13.mp4`, 14.03 s like #12; not posted | post, then read both at the same age | **proposed decision rule (confirm or change):** compare #13 and #12 at the same age and ≥ ~1 000 views each. viewed % within ±5 pp of #12's → the picture does not matter, stay with the keyboard (cheaper). ≥ +10 pp → the fretboard wins, use it for the next series. Below −10 pp → keep the keyboard. In between → no decision, noise. Also compare comments with notes — if viewed % rises but notes drop, the fretboard attracts watchers, not players |
| 2026-10-05 | #14 | YouTube Shorts | H6 | — | rendered (`node render.mjs video 14`), `out/ear-challenge-14.mp4`, 36.7 s, 37 notes; not posted. Melody transcribed from memory — check against a score before posting | post, then compare with #12/#13 at the same age and ≥ ~1 000 views | **proposed decision rule (confirm or change):** viewed % within ±5 pp of #12/#13 and note-comments don't fall → a harder, longer tune is fine, keep going up in difficulty. Viewed % ≥ 10 pp below → the full tune costs reach, go back to short phrases. Compare how many notes people type, not only whether they comment; watch time will drop by length alone, so judge by viewed %, not average % watched. Confounds: new tune, 37 s vs 14 s, first video not built on a ≤ 5 s phrase |
