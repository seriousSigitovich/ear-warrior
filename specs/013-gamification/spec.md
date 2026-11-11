# Feature Specification: Gamification MVP

**Feature Branch**: `013-gamification` (not created — work lands on `master`)

**Created**: 2026-11-11

**Status**: Implemented

**Input**: Owner's "Gamification MVP — Implementation Instructions" (XP, 7 ranks gated by Level Mastery, daily challenges, daily streak; no leaderboards, social, seasons or shops) with two decisions of 2026-11-11: an exercise counts as completed from **80%** of notes landed, and **XP can be earned phrase by phrase**, not only by finishing a whole melody. Supersedes the unreleased spec 012 (notes-based XP), which was removed.

## Context

A beta tester said that after playing there was "nothing" to come back for. The app already shows a score and a
mistake review (spec 009) and a Progress screen (spec 011). What is missing is something that accumulates and has a
next step: points, ranks that need real mastery rather than only time, a small daily goal, and a streak. The product
principle stays: reinforce independence from tabs; do not become a generic points game.

In this app an **exercise** is one library melody, answered **phrase by phrase**; a **level** is one of nine
difficulty levels (`L1`…`L9`); every melody belongs to one level.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Earn XP phrase by phrase (Priority: P1)

Each phrase answered well pays XP at once, so leaving a long melody half-way still pays for what was played.

**Acceptance Scenarios**:

1. **Given** a phrase checked with ≥80% of its notes landed, **When** the result shows, **Then** the learner is
   awarded 10 XP, +5 at ≥90%, +5 more at 100%, and sees it on the result.
2. **Given** a phrase below 80%, **When** the result shows, **Then** no XP is awarded; a retry that reaches 80% pays
   once for that phrase.
3. **Given** a phrase already paid in this play of the melody, **When** it is checked again, **Then** nothing more is
   awarded (one award per phrase per play).
4. **Given** taps, replays and draft mode, **When** XP is counted, **Then** they give nothing.
5. **Given** a phrase whose answer was shown ("Show answer"), **When** it is checked, **Then** it pays nothing
   (otherwise showing the answer and pressing Check would earn XP for no listening); "Show first note" still pays.
6. **Given** a melody left unfinished, **When** the learner leaves, **Then** the XP of its paid phrases stays.

---

### User Story 2 - Ranks that need mastery as well as XP (Priority: P1)

Seven ranks — Beginner, Apprentice, Listener, Musician, Virtuoso, Maestro, Mozart. A rank unlocks only when BOTH its
XP and its required mastered levels are met.

**Acceptance Scenarios**:

1. **Given** enough XP but a required level not mastered, **When** the rank is derived, **Then** the learner stays
   on the lower rank and sees what is still locked ("Master Level 1").
2. **Given** both met, **When** the last requirement is met (an exercise or a phrase), **Then** the rank rises and a
   celebratory modal shows once.
3. **Given** the ranks screen, **When** it opens, **Then** all seven ranks show locked/unlocked, XP needed, mastery
   needed, and the current one highlighted.

---

### User Story 3 - Level mastery (Priority: P1)

Each of the nine levels reaches Mastered independently: ≥10 completed exercises in the level, the last 5 averaging
≥85%, and ≥3 completed without hints. Mastery is kept for good, with its date.

**Acceptance Scenarios**:

1. **Given** a level's exercises, **When** a new one is completed, **Then** mastery is recalculated and, if met,
   recorded with the date and announced once.
2. **Given** a mastered level, **When** a later exercise scores low, **Then** the level stays mastered.
3. **Given** the same completion reported twice, **When** mastery is calculated, **Then** it counts once.

---

### User Story 4 - Three daily challenges (Priority: P2)

Every day three challenges: complete 3 melodies (+10 XP), reach 90% in a melody (+20 XP), complete 5 melodies
(+35 XP); all three give +25 XP more. They reset at local midnight and each pays exactly once.

**Acceptance Scenarios**:

1. **Given** completed melodies today, **When** the challenges screen opens, **Then** each shows its progress and
   reward, and a finished one shows as completed.
2. **Given** a challenge reached, **When** the melody completes, **Then** its reward is awarded once and stays
   completed for the day.
3. **Given** local midnight passes, **When** the screen opens, **Then** three fresh challenges at zero progress.

---

### User Story 5 - Daily streak (Priority: P2)

Consecutive local calendar days with practice (at least one XP award). Missing a day resets it; opening the app
does not.

**Acceptance Scenarios**:

1. **Given** practice today and yesterday, **When** Home opens, **Then** it shows a 2-day streak with a flame.
2. **Given** no practice yesterday, **When** the next practice happens, **Then** the streak restarts at 1.

---

### Edge Cases

- Same completion reported twice (retry, crash): one record, one set of awards.
- Awards and mastery already stored are never recomputed when reward values or thresholds change later.
- Existing testers keep their progress: past attempts are converted once into completions and XP awards (no
  challenge rewards); hints were not recorded before, so past completions count as without hints.
- A day is the learner's local calendar day, fixed when the award is made; a timezone change later does not move it.
- A rank requiring mastery of a level with no melodies is not possible: all nine levels have melodies.
- The first (onboarding) melody earns nothing: it is not recorded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: XP MUST be awarded through one service, never from UI components. Reward values, accuracy threshold,
  ranks, mastery criteria and challenges MUST live in one configuration.
- **FR-002**: A phrase checked at ≥80% MUST earn 10 XP, +5 at ≥90%, +5 at 100%, once per phrase per play of a
  melody; nothing for taps, replays, draft mode, failed or abandoned phrases, or a phrase whose answer was shown;
  never negative XP.
- **FR-003**: A melody finished with ≥80% of its notes landed MUST be recorded as an exercise completion with its
  level, accuracy, hints used and local day. Completions are idempotent by attempt id.
- **FR-004**: Rank MUST be derived from total XP and mastered levels: the highest rank whose XP and mastery
  requirements, and those of every rank below it, are met. Thresholds: 0, 100, 300, 700, 1500, 3000, 5000.
  Mastery: none, L1, L1–2, L1–4, L1–6, L1–8, all nine.
- **FR-005**: Mastery of a level MUST be recorded with its date the first time its criteria hold and MUST never be
  lost; level identifiers MUST come from the app's own levels, not from assumed integers.
- **FR-006**: The service MUST give the three daily challenges per local day, progress them from the day's
  completions, and award each reward and the +25 bonus exactly once.
- **FR-007**: The streak MUST count consecutive local days with at least one XP award, and MUST NOT reset because
  the app was opened.
- **FR-008**: Persistence MUST use the existing local store and survive restarts, and MUST NOT reset existing data.
- **FR-009**: Home MUST show rank, XP progress, streak and an entry to Daily Challenges; a Daily Challenges screen
  and a Musical Journey (ranks and nine levels) screen MUST exist; a rank-up MUST show a celebratory modal once.
- **FR-010**: The closing card MUST show what the melody just finished earned; phrase results MUST show phrase XP.
- **FR-011**: Events `exercise_completed`, `xp_earned`, `rank_up`, `mastery_unlocked`, `daily_challenge_started`,
  `daily_challenge_completed`, `all_daily_challenges_completed`, `streak_extended` MUST be sent through the existing
  event pipeline, once per award, with no personal data. (The app has no Firebase; its own pipeline is the
  analytics integration.)

- **FR-012**: Every rank MUST have its own 2D icon, in the app's palette, shown beside the rank's name on the rank card
  (Home, Progress, Journey), on each row of the ranks list (dimmed until reached) and in the rank-up modal. Icons
  are bundled images (no new native dependency), drawn as SVG and rendered by `scripts/build-rank-icons.sh`.

### Key Entities

- **Exercise completion**: attempt id, melody id, level id, accuracy, hints used, completion time, local day.
- **XP award**: a deterministic id (`phrase:<melody>:<n>`, `challenge:<day>:<id>`, `daily-all:<day>`), XP, local day.
- **Mastery record**: level id and date achieved.
- **Daily challenge**: derived per day from the config and the day's completions; its claim is its XP award.

## Success Criteria *(mandatory)*

- **SC-001**: Replaying the same report of a phrase or melody any number of times never changes XP, mastery or rank.
- **SC-002**: A rank never rises on XP alone.
- **SC-003**: After a restart every figure on screen is the same as before.
- **SC-004**: The exercise flow is unchanged: the same screens, the same controls, only added reward lines.

## Assumptions

- Out of scope: leaderboards, friends, leagues, seasons, collections, currency, shops, streak freezes, push
  notifications, personalised challenges.
- "Exercise" is a whole melody for mastery and challenges; XP is per phrase (owner's decision).
- Challenge "reach 90%" is one melody at ≥90% of its notes landed.
- Streak and today's goal are no longer taken from raw attempts: a day counts when XP was awarded; the week strip's
  goal is the three daily challenges.
- Mastery will make the first rank-up take longer than a time-only system (Apprentice needs Level 1 mastered:
  about ten melodies); the ranks screen shows mastery progress to keep the goal visible.
- Not limited: repeating one melody for XP. A phrase pays once per play, so replaying pays again (owner did not ask
  for a limit); to be revisited with tester data.
