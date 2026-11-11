# Feature Specification: Continue a Melody Where You Stopped

**Feature Branch**: `017-resume-melody` (not created — work lands on `master`)

**Created**: 2026-11-12

**Status**: Implemented

**Input**: Owner (2026-11-12): "on tapping a melody it must be possible to skip ahead to the phrase I stopped on, and there must be a Continue button. It must be saved on the backend like the rest of the progress."

## Context

Leaving a melody half-way loses the place: the next visit starts at phrase 1 and the first-try results of the phrases
already answered are gone (only the XP stays). A learner on a 60-note tune should be able to come back, or pick it up
on another device, and carry on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continue from the list (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a melody with saved progress, **When** the Melodies list shows, **Then** its row says "Phrase 3 of 5" and
   has a Continue button.
2. **Given** the Continue button is pressed, **When** practice opens, **Then** it starts at the saved phrase, the
   earlier phrases show as done in the progress bar, and finishing the melody scores it from all first tries,
   earlier ones included.
3. **Given** a melody without saved progress, **When** the list shows, **Then** there is no Continue button.

### User Story 2 - Tap the melody, skip ahead (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a melody with saved progress, **When** its row is tapped, **Then** practice opens at phrase 1, as for any
   melody.
2. **Given** that melody is being practised from phrase 1, **When** the answer screen shows before a note is placed,
   **Then** a "Skip to phrase 3" button jumps to the saved phrase.
3. **Given** the skip is used, **When** the saved phrase opens, **Then** the same state as Continue results.
4. **Given** earlier phrases are played again from phrase 1, **When** they are checked, **Then** the saved first
   tries are kept (a replay is practice, as always).

### User Story 3 - Saved with the account (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a signed-in learner checks a phrase, **When** they are online, **Then** the place is saved to the
   server; offline it is kept and sent later.
2. **Given** the same account on another device, **When** its Melodies list opens, **Then** the place shows and
   Continue works.
3. **Given** the melody is finished, **When** the attempt is recorded, **Then** the saved place is cleared locally and
   on the server.
4. **Given** an anonymous learner, **When** they leave a melody, **Then** the place is kept on the device only.

### Edge Cases

- The place is the first phrase not yet checked (first try); if all phrases were checked but the melody not finished,
  it is the last phrase, so Finish is one tap away.
- An older write never overwrites a newer one (last write wins by its time), including a stale offline device.
- Starting a different melody leaves other melodies' places alone.
- The first (onboarding) melody and a draft tap are never saved.
- A saved place for a tune no longer in the library is ignored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After each first-try check of a phrase of a recorded melody, the app MUST save, per tune: the phrase to
  continue at, the phrase count and each answered phrase's first-try results (note results and the answer's notes).
- **FR-002**: The Melodies list MUST show "Phrase N of M" and a Continue button for a melody with a saved place.
- **FR-003**: Continue MUST open practice at the saved phrase with earlier first tries restored; tapping the row MUST
  open at phrase 1 with a "Skip to phrase N" button until a note is placed.
- **FR-004**: Finishing a melody MUST clear its saved place.
- **FR-005**: A signed-in learner's places MUST be stored on the server per account and tune
  (`PUT/GET/DELETE /api/progress/melodies…`, bearer auth), last write wins by time, and synced both ways.
- **FR-006**: Unsent changes MUST wait on the device and go out at the next sync; nothing is lost offline.
- **FR-007**: No new analytics event names.

### Key Entities

- **Melody place**: tune id, phrase to continue at, phrase count, first-try results of the answered phrases, time of
  the last change, and (on the device) whether the server has it.

## Success Criteria *(mandatory)*

- **SC-001**: Leaving a 5-phrase melody after phrase 3 and tapping Continue lands on phrase 4 in two taps.
- **SC-002**: The same place appears on a second device of the account after a sync.

## Assumptions

- Resuming does not pay phrase XP again for earlier phrases (they are not replayed); replaying them from phrase 1
  pays like any replay (spec 013).
- Practice from "Start practice" keeps picking a new melody; a Continue card on Home is a later step.
