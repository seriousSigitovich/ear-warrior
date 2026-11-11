# Feature Specification: A Simpler Practice Flow

**Feature Branch**: `014-practice-flow` (not created — work lands on `master`)

**Created**: 2026-11-11

**Status**: Implemented

**Input**: Owner's review of the practice screens (2026-11-11): the "Press play" screen and the "Listening" screens are redundant; the whole melody plays first and then the same-looking screen comes back for phrase 1, so Skip looks like a bug. "Propose solutions to improve and simplify UX/UI" → accepted: (1) start playing at once, (2) play each phrase on the answer screen itself, (3) drop the whole-melody intro and offer "Hear whole melody" as a button.

## Context

Today the way to the first answer is three screens: an idle screen with one button, the whole melody with Pause / Restart /
Skip, then the same screen again for phrase 1, and only then the fretboard. Between every two phrases the listening
screen returns. The three buttons (spec 009) exist to manage a screen that should not be there: skipping is starting to
tap, repeating and stopping are the Replay / Stop button already on the answer screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practice starts playing (Priority: P1)

Opening practice (Start practice, a melody from the list, Practice something else) plays the first phrase at once;
there is no screen with a lone Play button.

**Acceptance Scenarios**:

1. **Given** the learner opens Practice, **When** the screen has loaded their level, **Then** a melody is served and
   its first phrase starts without any further tap.
2. **Given** a melody picked from the list, **When** Practice opens, **Then** that melody is served first and plays.
3. **Given** starting fails (for example the audio session), **When** it fails, **Then** a Play melody button is
   shown so the learner is never stuck.

---

### User Story 2 - A phrase plays on the answer screen (Priority: P1)

Each phrase plays while the fretboard is already on screen and usable. Tapping a fret stops the phrase and sounds the
tapped note; Replay and Stop work as before. There is no separate listening screen, at the start or between phrases.

**Acceptance Scenarios**:

1. **Given** a phrase is served (first or next), **When** the answer screen opens, **Then** the phrase plays at once
   with the board live and the caption "Listening… tap a fret to stop".
2. **Given** a phrase is playing, **When** the learner taps a fret, **Then** the phrase stops and the note sounds.
3. **Given** a phrase is playing, **When** the learner presses Check, **Then** it stops and the answer is checked.
4. **Given** the phrase has finished, **When** the learner presses Replay, **Then** it plays again.
5. **Given** the coached first melody (onboarding), **When** it is served, **Then** it keeps its own Listen step with its
   Play button, unchanged.

---

### User Story 3 - The whole melody on request (Priority: P2)

The melody is no longer played whole before the first phrase. On the first phrase's answer screen a small button, Hear
whole melody, plays it on demand. The whole melody still plays at the end as the payoff.

**Acceptance Scenarios**:

1. **Given** the first phrase of a melody with more than one phrase, **When** the answer screen shows and nothing is
   placed yet, **Then** a "Hear whole melody" button is visible.
2. **Given** the button is pressed, **When** the melody plays, **Then** the phrase playing is replaced by the whole
   melody and Replay/Stop control it.
3. **Given** a one-phrase melody or a later phrase, **When** the screen shows, **Then** the button is not offered.

---

### Edge Cases

- Leaving the screen stops the audio; nothing starts behind another screen.
- The speed slider is on screen all the time and follows live while a phrase plays.
- Retry does not replay by itself (the learner just heard it); Replay is one tap away.
- The picked tune's name is not repeated on the practice screen (the list just showed it).
- Funnel events keep their meaning: `melody_play` when a melody is served, `answer_start` on the first placed note.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening Practice MUST serve a melody and start its first phrase without a further tap, once the
  learner's level is loaded; if that fails, a Play melody button MUST appear.
- **FR-002**: Each phrase MUST play on the answer screen (board live), as a replay does; the separate listening phase
  MUST NOT exist in practice.
- **FR-003**: A fret tap, Check, Retry, Next phrase or leaving MUST stop a phrase that is playing.
- **FR-004**: The whole melody MUST NOT play before the first phrase; a "Hear whole melody" button MUST be offered on
  the first phrase of a melody with several phrases, and the whole melody MUST still play at the end.
- **FR-005**: Pause, Restart and Skip for listening (spec 009 FR-001) MUST be removed, with the playback service's
  pause/resume and everything that only they used.
- **FR-006**: The coached first melody MUST behave as before (its own Listen step).
- **FR-007**: No new analytics event names; asking to hear the whole melody counts as `melody_replay` with
  `where: whole`.

## Success Criteria *(mandatory)*

- **SC-001**: From opening Practice to the first tappable fret: zero taps and zero separate screens.
- **SC-002**: A melody of N phrases is N answer screens and N result screens — no listening screens.
- **SC-003**: Replay, Stop, Undo, Clear, Check, Draft and the speed slider behave exactly as before.

## Assumptions

- The three-button listening controls were built for the screen that goes away; the tester's need (repeat, stop, skip
  ahead) is met by Replay/Stop and by simply starting to tap.
- Whether testers want the whole melody first is unmeasured (Skip was not logged); the button keeps it one tap away.
