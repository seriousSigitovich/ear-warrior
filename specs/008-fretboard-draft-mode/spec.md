# Feature Specification: Fretboard Draft Mode

**Feature Branch**: `008-fretboard-draft-mode` (not created — work lands on `master`)

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Драфт-режим на грифе (docs/beta-checklist.md, добавлено 2026-11-07): режим в приложении, в котором можно свободно играть на экранном грифе — тапы по грифу не засчитываются как ответ и никуда не уходят (ни в проверку, ни в прогресс, ни в историю). Можно прощупать мелодию, ошибаться и пробовать варианты, а потом уже отвечать."

## Context

Today, on the answer screen of a phrase, every fretboard tap both sounds and fills the next answer slot. A learner
who wants to *search* for a note by ear ("is it this fret? this one?") fills the slots with wrong guesses and has to
undo them one by one. Searching by trial and error is exactly how playing by ear is learned (product thesis: active
reproduction, not recognition), so the board should let the learner search freely and answer only when sure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for notes without filling the answer (Priority: P1)

While answering a phrase, the learner switches the board into draft mode. Every tap now only sounds the note and
shows briefly where it was played; the answer slots do not change. The learner hunts for the melody by ear, then
switches draft off and places the notes they found as the answer.

**Why this priority**: it is the whole feature — a free board inside the exercise. Without it nothing else matters.

**Independent Test**: open a phrase, turn draft on, tap 20 frets → each sounds, the slots stay as they were, Check
stays as it was; turn draft off, tap → the slot fills as before.

**Acceptance Scenarios**:

1. **Given** the answer screen with draft off, **When** the learner turns draft on, **Then** the screen clearly shows
   that taps are not being answered (a distinct label/state visible without reading small print), and the already
   placed answer notes stay as they were.
2. **Given** draft on, **When** the learner taps any fret, **Then** the note sounds at once, the tapped cell lights
   briefly, and no answer slot is filled or changed.
3. **Given** draft on with some answer notes already placed, **When** the learner taps, **Then** Undo, Clear and Check
   still act on the placed answer only, exactly as with draft off.
4. **Given** draft on, **When** the learner turns it off and taps, **Then** taps fill the answer slots again as today.
5. **Given** draft on, **When** the learner presses Replay, **Then** the phrase plays again as today, and a draft tap
   stops the replay the same way an answer tap does.

---

### User Story 2 - Nothing played in draft leaves the device or counts (Priority: P1)

Draft taps are private scratch work: they never become an attempt, a grade, a level change, a history entry or a
synced progress record.

**Why this priority**: the learner must be free to be wrong. If draft taps leaked into scoring, the mode would
punish exactly the behaviour it exists for.

**Independent Test**: on one phrase do 30 draft taps and no Check → no attempt in local history, no progress record
queued, no change of level or of the phrase's result; then answer and Check → exactly one attempt, graded only on the
placed answer.

**Acceptance Scenarios**:

1. **Given** draft taps on a phrase and no Check, **When** the learner leaves the screen, **Then** no attempt, grade,
   history entry or progress record exists for those taps.
2. **Given** draft taps followed by a placed answer and Check, **When** the phrase is graded, **Then** the grade is
   computed from the placed answer alone and is identical to the grade the same answer gets without any draft taps.
3. **Given** draft taps, **When** they are made, **Then** they do not count as "started answering" in the funnel
   (only a placed answer note does).

---

### User Story 3 - Know how much draft mode is used (Priority: P2)

The owner can see in the beta analytics how many learners turn draft on and whether phrases answered after drafting
are graded better than the rest.

**Why this priority**: the beta is about learning what helps; a mode nobody finds or that does not help should be
visible as such. It does not block the learner value of stories 1–2.

**Independent Test**: turn draft on and off once on a phrase, then Check → the analytics stream shows one "draft on"
event for that phrase and the check event marks that draft was used on it.

**Acceptance Scenarios**:

1. **Given** the learner turns draft on, **When** the event is sent, **Then** it carries the level and phrase position,
   and no note or fret data.
2. **Given** a phrase on which draft was on at least once, **When** it is checked, **Then** the check event says so.

---

### Edge Cases

- Draft on and the answer already full: taps still sound and light, the answer is unchanged (no replacing the last
  note).
- Draft left on when the phrase is checked, retried, or the next phrase starts: the mode the learner chose stays
  until they switch it off or leave the practice screen; on the next visit to the screen it starts off.
- A learner who forgets draft is on and taps expecting to answer: the slot row does not fill and the draft state is
  visibly marked on screen, so the reason is apparent without help text.
- Screen reader users: the toggle has a label and an on/off state, switching it is announced, and a draft tap is
  announced as the note played, not as a placed answer note.
- The first-melody (onboarding) screen is coached step by step and does not offer draft mode.
- The result view (after Check) keeps its read-only board; draft applies only while answering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While answering a phrase on the fretboard, the learner MUST be able to switch draft mode on and off with
  one tap on a control on the answer screen.
- **FR-002**: In draft mode, a fret tap MUST sound its note with the same latency as an answer tap and MUST briefly
  mark the tapped cell on the board.
- **FR-003**: In draft mode, a fret tap MUST NOT add, replace or remove any answer note.
- **FR-004**: Undo, Clear, Replay and Check MUST behave the same in draft mode as outside it and act on the placed
  answer only.
- **FR-005**: Draft taps MUST NOT be graded, recorded as attempts, stored in history, synced as progress, or affect
  level, phrase results or help offers.
- **FR-006**: The draft state MUST be visible on the answer screen at all times while it is on, by more than colour
  alone.
- **FR-007**: The draft state MUST persist across phrases and retries within one visit to the practice screen and MUST
  start off on each new visit.
- **FR-008**: The draft control MUST meet the project's accessibility baseline (label, on/off state announced, touch
  target at least as large as the other answer controls); a draft tap MUST be announced as a played note, not a placed
  one.
- **FR-009**: The system MUST send an analytics event when draft is switched on (level, phrase position), and the
  phrase check event MUST state whether draft was used on that phrase. No per-tap events and no note data are sent.
- **FR-010**: Draft taps MUST NOT trigger the "started answering" funnel event.

### Key Entities

- **Draft state**: on/off for the current practice visit; not stored on the device, not synced.
- **Draft use per phrase**: whether draft was on at least once while answering this phrase; lives only until the
  phrase's check event is sent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A draft tap sounds as fast as an answer tap (no perceptible difference; within the 200 ms interaction
  budget).
- **SC-002**: 100% of graded phrases are graded on the placed answer only — the same answer gives the same grade with
  or without draft taps before it.
- **SC-003**: A learner can go from "draft on" to "first answer note placed" in two taps (toggle off, tap fret).
- **SC-004**: Within two weeks of release, the share of learners who turn draft on at least once and the first-try
  accuracy of phrases answered after drafting vs. without it are readable from the beta analytics.

## Assumptions

- Draft lives inside the existing phrase answer screen; a separate "free play" screen outside the exercise is out of
  scope.
- No new sounds or samples: draft taps play the same note samples as answer taps.
- The cell mark for a draft tap fades on its own (about a second) and is not a persistent trail of all draft taps.
- The mode is not remembered between visits so a learner never opens practice in a state where taps silently do not
  answer.
- Analytics goes to the existing beta event stream; the server accepts the new event name before the app ships it.
