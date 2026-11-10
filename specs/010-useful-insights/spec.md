# Feature Specification: Useful Insights

**Feature Branch**: `010-useful-insights` (not created — work lands on `master`)

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "аналитика выглядит как бесполезная хуйня, нужны идеи как сделать полезной" → from the ideas offered, the owner took all but one: note accuracy instead of melody accuracy, weak intervals, the character of mistakes, a "practise this" action, and library progress. Left out: first-try vs. replays.

## Context

The Progress (Insights) screen answers nothing a learner can act on. Its accuracy counts a whole tune as right or
wrong, so one wrong note in 56 reads as 0% and the trend sits near zero. Its "weak areas" describe tunes ("56-note
melodies: 100% missed"), not the ear. And it never says what to do next. Everything needed for a better answer is
already on record: each finished tune keeps, per note, what was expected and what was played.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See accuracy that moves (Priority: P1)

The headline is the share of notes the learner got right over the last week, how that compares with the week before,
and a line of accuracy per practice day.

**Independent Test**: finish tunes with 3 of 4 notes right → the headline says 75%, not 0%.

**Acceptance Scenarios**:

1. **Given** tunes finished in the last 7 days, **When** Progress opens, **Then** the headline is notes matched over
   notes in those tunes, as a percentage.
2. **Given** tunes in the 7 days before that too, **When** Progress opens, **Then** the difference between the two
   weeks is shown.
3. **Given** practice on two or more days, **When** Progress opens, **Then** a trend of accuracy per practice day is
   drawn.
4. **Given** nothing in the last 7 days but older tunes on record, **When** Progress opens, **Then** the headline is
   the all-time figure and says so.

---

### User Story 2 - A map of the ear by interval (Priority: P1)

For each kind of melodic move — repeated note, step, third, fourth or fifth, wider leap; up or down — the learner sees
how often they land the note that follows it, weakest first.

**Independent Test**: answer tunes where every step is right and every leap up is wrong → "Wide leaps up" is at the
top with 0%, "Steps" below it with 100%.

**Acceptance Scenarios**:

1. **Given** enough played notes for a kind of move, **When** Progress opens, **Then** it is listed with its
   percentage and number of tries, weakest first.
2. **Given** a kind of move with too few tries to mean anything, **When** Progress opens, **Then** it is not listed
   and the screen says more playing will fill the map in.
3. **Given** a note the learner did not play at all, **When** the map is built, **Then** it is not counted as a miss
   of that interval (a phrase given up on says nothing about the ear).
4. **Given** the first note of a phrase, **When** the map is built, **Then** it is not counted (it is found without
   a note to move from).

---

### User Story 3 - Practise the weak spot (Priority: P1)

Under the weakest kind of move the learner gets melodies that are full of it, and one tap starts any of them.

**Independent Test**: weakest is "Thirds down" → three melodies rich in descending thirds are offered; tapping one
opens practice with that melody.

**Acceptance Scenarios**:

1. **Given** a weakest kind of move below a "nothing to fix" threshold, **When** Progress opens, **Then** up to three
   melodies that contain it most are offered, not far above the levels the learner has played.
2. **Given** an offered melody, **When** it is tapped, **Then** practice opens with that melody.
3. **Given** every kind of move is strong, **When** Progress opens, **Then** no melody is pushed and the screen says
   there is no weak spot yet.

---

### User Story 4 - How the misses go (Priority: P2)

A few plain sentences about the character of the wrong notes: too high or too low, close or far, wrong octave,
right direction but wrong distance.

**Acceptance Scenarios**:

1. **Given** enough wrong notes, **When** a pattern is strong enough, **Then** it is stated as a sentence with its
   share; patterns that are not there are not stated.
2. **Given** too few wrong notes, **When** Progress opens, **Then** the section is absent.

---

### User Story 5 - Progress through the library (Priority: P2)

How many melodies have been played and how many at 100%, overall and per level, with a way into the list.

**Acceptance Scenarios**:

1. **Given** any history, **When** Progress opens, **Then** "N of 100 played · M at 100%" and a bar per level are
   shown, and one tap opens Melodies.

---

### User Story 6 - A finished tune at a glance (Priority: P2)

A finished tune is summed up, not listed note by note: in Recent melodies as progress phrase by phrase, on its
closing card as a strip of notes with the first wrong ones named.

**Acceptance Scenarios**:

1. **Given** finished tunes, **When** Progress opens, **Then** each of the latest ten shows its name, day, score,
   how many phrases were right, and one segment per phrase filled by the share of its notes landed.
2. **Given** a tune just finished with wrong notes, **When** its closing card shows, **Then** the tune is drawn as
   one cell per note, the misses are counted in one line, and the first wrong notes are named with the right note.

---

### Edge Cases

- No finished tunes: the empty state, no invented numbers.
- Extra notes (played but not in the tune) belong to no interval and are not counted in the map.
- Old microphone-era or timed-out attempts are left out of accuracy, the map and the patterns.
- A melody already played at 100% is offered for practice only after those that are not.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Accuracy on Progress MUST be notes matched over notes of the finished tunes, never tunes right over
  tunes played.
- **FR-002**: Progress MUST show accuracy for the last 7 days, its change against the 7 days before when both have
  data, and a per-practice-day trend when there are two or more days.
- **FR-003**: Progress MUST show accuracy per kind of melodic move (size class × direction), weakest first, only for
  kinds with at least a minimum number of tries.
- **FR-004**: The map MUST count only notes that were played and have a previous note inside the same phrase.
- **FR-005**: For the weakest kind of move below the threshold, Progress MUST offer up to three melodies richest in
  it, at most one level above the highest level played, unfinished-at-100% first; a tap MUST start that melody.
- **FR-006**: Progress MUST state patterns among wrong notes (higher/lower lean, closeness, octave, direction) only
  when there are enough wrong notes and the pattern passes its threshold.
- **FR-007**: Progress MUST show library progress overall and per level and link to Melodies.
- **FR-008**: The former session-verdict accuracy and tune-shaped "weak areas" MUST be removed from the screen and
  their now-unused aggregation deleted.
- **FR-009**: Everything MUST be derived on the device from stored attempts and melodies; no server change and no new
  analytics event names.
- **FR-010**: In Recent melodies a finished tune MUST show only its name, day, score and its progress phrase by
  phrase: one segment per phrase, filled by the share of its notes landed, and how many phrases were right. No note
  lists there (owner, 2026-11-10: a line or a chip per note per melody is unreadable). The closing card of a tune
  keeps a compact note review — a strip of one cell per note, a one-line count of the misses and the first wrong
  notes as "place · played → right note" chips. Supersedes the per-note lists of spec 009 FR-004/FR-006.

### Key Entities

- **Note event**: one note of a finished tune — expected pitch, played pitch (or none), result, and the expected
  pitch before it in the same phrase (or none).
- **Interval kind**: repeated note, or a size class (step, third, fourth/fifth, wide) with a direction.

## Success Criteria *(mandatory)*

- **SC-001**: A tune with one wrong note out of N shows as (N−1)/N accuracy, not 0%.
- **SC-002**: From Progress, practice aimed at the weakest interval starts in two taps.
- **SC-003**: Every number on the screen is reproducible from the stored attempts by the unit-tested functions.

## Assumptions

- Thresholds are constants, not settings: 5 tries for an interval kind to be listed, 8 wrong notes for patterns,
  85% as "nothing to fix".
- Fourths and fifths share one class and sixths-and-wider another, so each class gathers enough tries to mean
  something for a beginner; a finer split can follow when learners have more history.
- Out of scope: first-try vs. replay counts (replays are not stored on the device), server-side insights.
