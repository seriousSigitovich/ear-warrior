# Feature Specification: Listening Controls, Mistake Review, Daily Habit and Melody Library

**Feature Branch**: `009-listen-review-habit-library` (not created — work lands on `master`)

**Created**: 2026-11-10

**Status**: Implemented (spec written together with the change, same day)

**Input**: User description: "Отзыв бета-тестера (новичок, Android, 2026-11-10), 7 пунктов. Прислушаемся к тому, о чём она просит, но пока без микрофона и прочих излишностей." Follow-up from the owner while the work was under way: "у каждой мелодии должно быть название".

## Context

A beta tester — a beginner guitarist — wrote down what stopped her: (1) she cannot see what a lesson will ask before
starting it, (2) Insights shows a graph but not which note was wrong and what the right one was, (3) she cannot go
back to an old melody or skip one she knows, (4) after playing there is "nothing" — no score, no word of praise, no
reason to come back tomorrow, (5) she wants to use a real guitar, (6) she wants chord recognition, (7) while the
melody plays there is no pause, replay or skip.

Points 1–4 and 7 are about the product's core loop (hear → play back → learn what landed → come back) and are in
scope. Point 5 (microphone/MIDI, tuner) and point 6 (chord recognition — recognition, not reproduction) are out of
scope for this change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Control the melody while listening (Priority: P1)

While the whole melody or a phrase plays before the answer, the learner can pause it, hear it again from the start,
or skip ahead.

**Why this priority**: listening is the first step of every exercise; today it cannot be held, repeated or cut short
(a phrase had no control at all, the whole tune only a quiet "Skip to phrase 1").

**Independent Test**: start a melody → Pause holds the sound and the screen says "Paused"; Resume carries on from the
same place; Restart plays it from its start; Skip on the whole tune goes to phrase 1, Skip on a phrase goes straight
to answering it.

**Acceptance Scenarios**:

1. **Given** the whole tune or a phrase is playing before the answer, **When** the learner looks at the screen,
   **Then** Pause, Restart and Skip are visible as full-size buttons.
2. **Given** it is playing, **When** the learner presses Pause, **Then** the sound stops where it is, the screen says
   so, and it stays held until Resume, Restart or Skip.
3. **Given** it is paused, **When** the learner presses Resume, **Then** it continues from where it was held and ends
   as much later as it was held.
4. **Given** it is playing or paused, **When** the learner presses Restart, **Then** the same tune/phrase plays from
   its start.
5. **Given** the whole tune is playing, **When** the learner presses Skip, **Then** phrase 1 plays; **Given** a phrase
   is playing, **When** the learner presses Skip, **Then** the answer screen for that phrase opens.

---

### User Story 2 - See which notes went wrong and what they should have been (Priority: P1)

When a tune is finished, the learner sees every note that was not matched: its place in the tune, what they played and
what the tune has there. The same review is kept for the latest tunes on the Progress screen.

**Why this priority**: "if I can't see my mistakes, I can't fix them" — the feedback half of the loop.

**Independent Test**: finish a tune with wrong notes → the closing card lists "Note N: you played X, it was Y"; open
Progress → "Recent melodies" shows that tune with its score and the same lines.

**Acceptance Scenarios**:

1. **Given** a finished tune with unmatched notes, **When** the closing card shows, **Then** each of the first few is
   listed with its place, the played note and the right note, and the rest are counted.
2. **Given** finished tunes on record, **When** the learner opens Progress, **Then** the latest ten are listed newest
   first with name, day, score and all their mistakes; a clean tune says every note was right.
3. **Given** a phrase that can still be retried, **When** its result shows, **Then** the right notes are NOT named
   (finding them by ear is the exercise); help after repeated misses stays as it is.

---

### User Story 3 - A score, a word of praise and a daily habit (Priority: P1)

Finishing a tune ends with a score and a word that matches it, and shows the day's goal and the run of days in a row.
Home shows the streak and today's count.

**Why this priority**: the tester's biggest point — after playing there was nothing to come back for.

**Independent Test**: finish one tune → the card shows the percentage, a word of praise and "1 of 3 today"; Home shows
"Streak 1 day · Today 1 of 3"; with tunes on three consecutive days the card says "3-day streak".

**Acceptance Scenarios**:

1. **Given** a finished tune, **When** the closing card shows, **Then** it carries the percentage of notes matched,
   notes and phrases counts, and a word that matches the result (never a triumph for a poor run).
2. **Given** tunes finished today, **When** the learner looks at Home, Progress or the closing card, **Then** today's
   count against the daily goal is shown, and the goal is marked done once reached.
3. **Given** practice on consecutive calendar days, **When** the streak is shown, **Then** it counts those days; a day
   not practised on yet does not break it until the day is over.

---

### User Story 4 - Choose any melody and know what it asks (Priority: P2)

A Melodies screen lists the whole library by level. Every melody has its name and says what it asks — notes, phrases,
tempo — and the learner's best result. Any of them can be started at any time.

**Why this priority**: answers "I can't see what's inside" and "I feel stuck in one straight line"; the loop works
without it, so it follows the three above.

**Independent Test**: Home → Melodies → every row has a name and "N notes · M phrases · T BPM"; tap one from a higher
level → it plays; finish it → its row shows the score and the level in effect did not move.

**Acceptance Scenarios**:

1. **Given** the Melodies screen, **When** the learner scrolls it, **Then** all tunes are listed under their level
   with name, notes, phrases, tempo, and "New" or the best score.
2. **Given** a tune is tapped, **When** practice opens, **Then** the idle screen names it and what it asks, and Play
   serves that tune whatever the level in effect.
3. **Given** a picked tune is finished, **When** it is recorded, **Then** it counts for history, streak and Progress
   but does not raise or lower the adaptive level.
4. **Given** a picked tune is finished, **When** the learner presses Next melody, **Then** practice carries on at the
   level in effect as usual.

---

### Edge Cases

- Pause, then leave the screen: playback ends; nothing starts behind another screen.
- Restart or Skip while paused: both work and lift the pause.
- Speed slider is not shown while listening; a speed change during a replay keeps working as before.
- A tune finished around midnight counts for the local calendar day it was finished on.
- An unknown tune id in the practice link is ignored (normal practice).
- A tune with dozens of mistakes: the closing card lists the first six and counts the rest; Progress lists all.
- The first-melody (onboarding) screen keeps its own coached flow and gets no new controls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While the whole tune or a phrase plays before the answer, the learner MUST be able to pause and resume
  it, restart it, and skip ahead (tune → phrase 1, phrase → answering).
- **FR-002**: A paused melody MUST stay held until the learner acts, and the screen MUST say it is paused.
- **FR-003**: The closing card of a tune MUST show the percentage of notes matched, a word matching the result, and
  the notes/phrases counts.
- **FR-004**: The closing card MUST list unmatched notes (place, played, expected; wrong octave marked), capped so the
  Next action stays on screen.
- **FR-005**: The right note MUST NOT be named while its phrase can still be retried.
- **FR-006**: Progress MUST show the latest ten finished tunes with name, day, score and every mistake.
- **FR-007**: The app MUST show a daily goal (3 melodies) and a day streak derived from finished tunes on record, on
  Home, Progress and the closing card. Nothing shown may be invented.
- **FR-008**: The learner MUST be able to open a list of all melodies by level, each with its name, notes, phrases,
  tempo and best result, and start any of them.
- **FR-009**: A tune picked from the list MUST be recorded like any other but MUST NOT change the adaptive level.
- **FR-010**: No new analytics event names are introduced (restart is sent as the existing `melody_replay` with
  `where: playingMelody`), so the app part can ship without a server deploy.

### Key Entities

- **Mistake**: an unmatched note of a finished tune — place, played note, expected note, kind (wrong/missed/extra).
- **Streak**: days in a row with a finished tune, today's count, the daily goal, the best run. Derived, not stored.
- **Catalog tune**: a library tune as listed — name, level, notes, phrases, tempo, played, best score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pause holds a melody for any length of time and resume ends it exactly as much later as it was held.
- **SC-002**: 100% of unmatched notes of a finished tune are reachable in Progress with the played and expected note.
- **SC-003**: From Home, any melody of the library can be started in three taps (Melodies → tune → Play).
- **SC-004**: Within two weeks of release, day-2 return and melodies per active day are readable from the beta
  analytics and compared with the weeks before.

## Assumptions

- Out of scope: microphone/MIDI input, tuner, chord recognition, reminders (push notifications need a native module
  and a new build), badges/achievements.
- The daily goal is fixed at 3 melodies; it is not a setting yet.
- Streak and "played" marks are read from this device's records; a learner signed in on a new device starts them
  empty there.
- Names are shown in the library list (owner's decision); in ordinary practice the name is still revealed at the end.
