# Feature Specification: A Lighter Answer Screen

**Feature Branch**: `016-answer-header` (not created — work lands on `master`)

**Created**: 2026-11-11

**Status**: Implemented

**Input**: Owner (2026-11-11), looking at the answer screen: "make the circles half the size; move the Draft button up to the top navigation, where the back button is."

## Context

On the answer screen the row of note circles (one per note of the phrase) is as tall as a button and the Draft switch
sits in the title row. Both take room from the fretboard, the thing the learner is there for. The circles only count
notes; the Draft switch is a mode toggle that belongs with the other screen-level controls in the navigation bar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smaller note circles (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the answer screen, **When** it shows, **Then** the note circles are half the diameter they were (20 dp
   at most, 16 dp at least, from 40 and 32) and the row stays one line, shrinking, then scrolling by whole circles.
2. **Given** a note is placed, **When** its circle fills, **Then** it still shows the note's name, legibly.
3. **Given** the first melody (onboarding), **When** it shows, **Then** it uses the same smaller circles.

### User Story 2 - Draft in the navigation bar (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the learner is answering a phrase, **When** the screen shows, **Then** the Draft switch is on the right of
   the navigation bar, level with the back button, and no longer in the title row.
2. **Given** the learner is not answering (result, closing card, melody being served), **When** the screen shows,
   **Then** the navigation bar has no Draft switch.
3. **Given** Draft is switched on, **When** the switch is read, **Then** it keeps its text state ("Draft · On"), its
   switch role and checked state, and the toggle is announced; draft behaviour is unchanged (spec 008).
4. **Given** the first melody screen, **When** it shows, **Then** it has no Draft switch, as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Note circles MUST be 20 dp at most and 16 dp at least, in a single row, with the same shrink-then-scroll
  rule as before.
- **FR-002**: A placed note's name MUST stay readable inside its circle.
- **FR-003**: The Draft switch MUST be in the navigation bar's right side while answering, and absent otherwise; its
  role, state, text and announcement MUST be unchanged.
- **FR-004**: The answer screen's body MUST no longer contain a Draft switch.

## Success Criteria *(mandatory)*

- **SC-001**: The row of circles is half as tall and the fretboard gets that room.
- **SC-002**: Draft still switches on and off in one tap, from the bar.

## Assumptions

- Slot gap stays 8 dp, so more circles fit on one row before it scrolls.
