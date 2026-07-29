# Ear Warrior — Voice & Copy Guide

The source of truth for user-facing copy and brand reviews.

This guide was **reconstructed from the shipped copy** (2026-07-29), not invented — the
app already had a coherent voice; this writes it down. Where a current string doesn't yet
match the target, it's called out as **fix** so the guide describes where the copy should be,
not just where it is.

Scope: everything a user reads — screen copy, buttons, feedback, empty states, permission
strings, and store listings. Internal identifiers (code, comments, DB fields) are exempt.

---

## 1. Personality

If Ear Warrior were a person, they'd be **the patient guitar teacher sitting next to you**:
they hear every note, tell you the plain truth about what landed, and never make a missed
note feel like a failure. Calm, precise, quietly encouraging. They talk like a player, not
like an app.

---

## 2. Voice attributes

Four attributes, in priority order. When two pull against each other, the higher one wins.

### Direct
- **We are**: short sentences, second person, imperative. We say the thing.
- **We are not**: terse to the point of cold, or padded with filler.
- **Sounds like**: *"Your turn."* · *"Press play, listen, then play back the melody."*
- **Does NOT sound like**: *"Whenever you're ready, you may attempt to reproduce the musical phrase you just heard."*

### Encouraging (blame-free)
- **We are**: on a miss, we name it plainly and point forward. The user is never at fault.
- **We are not**: gushing, cheerleading, or falsely upbeat. No hype.
- **Sounds like**: *"Not quite"* · *"Hard to hear that"* · *"Easing off"* · *"let's try again"*
- **Does NOT sound like**: *"Wrong!"* · *"You failed this level."* · *"Amazing job superstar!!!"*

### Honest & precise
- **We are**: concrete and specific. Real note names, real counts, real state. If we don't
  have the data, we say so — we never show invented numbers. (See §8.)
- **We are not**: vague, or over-claiming beyond what the grader actually knows.
- **Sounds like**: *"3 of 5 notes matched"* · *"G3 missed"* · *"which notes landed"*
- **Does NOT sound like**: *"Great progress!"* (with no data) · *"We detect every note perfectly."*

### Calm
- **We are**: measured and quiet. Low-status process notes, no urgency.
- **We are not**: loud, punchy-for-the-sake-of-it, or exclamation-heavy.
- **Sounds like**: *"Listening…"* · *"worth a tune-up"* · *"Checking your notes…"*
- **Does NOT sound like**: *"LISTEN NOW!"* · *"Don't miss your streak!!"*

---

## 3. Audience

Guitar players practising ear training — advanced-beginner to intermediate. They are
**music-literate**: they know note names, "sharp/flat", tuning, and BPM without a glossary.
They are **not** necessarily theory nerds and don't want a lecture.

Address them as **a peer who plays**. They came for fast, honest reps, not gamified fluff.
Respect their time (short copy) and their ear (never fake the feedback).

---

## 4. Messaging pillars

In priority order. Every piece of copy should reinforce at least one and contradict none.

1. **Feedback you can trust.** The core promise: we tell you what actually landed. This
   pillar is why §8 (data integrity) is non-negotiable — one fabricated number breaks it.
2. **Reps in seconds.** Hear → play back → know. Low friction, no ceremony.
3. **Meets you where you are.** Adaptive difficulty, blame-free retries, no unlock gating.

---

## 5. Tone by moment

The four attributes stay fixed; the *balance* shifts by context.

| Moment | Dial up | Example |
|---|---|---|
| Hero / first run | Direct, a little bold | "Hear it. Play it back. Nail it." |
| "Your turn" prompt | Direct, calm | "Play it back on your guitar" |
| Live status | Calm, quiet | "Listening…" · "note 3 of 5" |
| **Win verdict** | **Encouraging** (warm) | "Nailed it" — *fix: currently flat "Correct"* |
| Miss verdict | Encouraging, honest | "Not quite" · "3 of 5 notes matched" |
| Retry (unclear / no input) | Calm, blame-free | "Hard to hear that — let's try again" |
| Tuning nudge | Calm, optional | "Reading a touch flat — worth a tune-up." |
| Difficulty change | Honest, matter-of-fact | "Level up" · "Easing off" (never silent) |
| Empty state (no data yet) | Honest, encouraging | say there's no data yet — never invent it |

---

## 6. Style rules

Concrete and enforceable. These match what the copy already does, except where marked **fix**.

- **Case**: sentence case for headings and buttons — "Start practice", "No notes detected",
  "Current level". Never Title Case.
- **Person / mood**: second person, imperative — "Play it back", not "The user plays back".
- **Live status**: lowercase, trailing ellipsis `…` (one glyph, not `...`) — "Listening…",
  "Checking your notes…", "note 3 of 5".
- **Em dash**: spaced — ` — ` — "Accuracy — last 7 sessions", "unclear — let's try again".
- **Apostrophes**: typographic `’` everywhere. **fix**: `didn't` in RetryState uses a
  straight `'`; `let's`/`don't` already use `’`. Make them all `’`.
- **Exclamation marks**: effectively zero. The hero doesn't use one and doesn't need one.
  Warmth comes from word choice, not punctuation.
- **Numbers**: numerals for musical quantities — "5 notes", "120 BPM", "Level 2 of 7",
  "3 of 5 notes matched".
- **Note names**: as rendered by `noteName` — ASCII sharp + scientific octave: `G3`, `F#4`,
  `A4` (no flats, no Unicode ♯). Octave mismatch is tagged `(8ve)`, e.g. `E4 (8ve)`.

---

## 7. Terminology

| Use this | Not this | Why |
|---|---|---|
| play it back | reproduce | "reproduce" is clinical; "play it back" is our own warmer synonym |
| Level (user-facing) | Rank | "rank" is internal code only; users always see "Level" |
| Not quite | Wrong / Incorrect / Failed | blame-free — the miss isn't a verdict on the player |
| Nailed it | Correct | the win is the emotional peak; match the hero's energy |
| Easing off | Level down / Demoted | dropping difficulty is a help, not a punishment |
| which notes landed | exactly which notes landed | the grader has a 50-cent tolerance; don't over-claim "exactly" |
| melody | phrase / riff / lick | "melody" is the one term the product uses end to end |
| worth a tune-up | you're out of tune / fix your tuning | it's an optional nudge, never a command |
| Listening… | Now recording / Recording in progress | quiet and human, not a status bar |

**Inclusive language**: prefer "clear/straightforward" over "easy" — what's easy varies by
player. Use they/them for an unspecified person.

---

## 8. Data-integrity rule (non-negotiable)

**Never show fabricated personal metrics as if they were the user's own.** Accuracy,
streaks, attempt counts, trends — if the data isn't there yet, show an honest empty state,
not a placeholder number.

This is a *voice* rule, not just an engineering one: pillar #1 is "feedback you can trust",
and a single invented figure about the user breaks that trust for the whole app. The Home
screen already gets this right — it deliberately omits a streak it can't back with real data
rather than inventing one. Hold every screen to that same bar.

- **fix**: the Progress screen currently ships hardcoded `82%`, `+6% this week`,
  `Streak 6 days`, and `Attempts 142` for every user. Replace with an empty state until real
  history is wired.
- Corollary: never use screens showing placeholder metrics in **store listings or ads** —
  fabricated results copy is a store-review and false-advertising risk.

---

## Quick checklist

Run a new string past this before it ships:

- [ ] Second person, imperative, short?
- [ ] Sentence case (headings/buttons)? Typographic `’`? At most zero `!`?
- [ ] On a miss — blame-free and forward-looking?
- [ ] On a win — warm, not flat?
- [ ] Every number real, or an honest empty state? (No invented metrics — §8.)
- [ ] No over-claim beyond what the grader knows ("exactly", "perfectly", "every")?
- [ ] Right term from §7? ("play it back", "Level", "melody", "Not quite" …)
