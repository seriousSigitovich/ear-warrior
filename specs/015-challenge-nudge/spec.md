# Feature Specification: Daily Challenge Nudge

**Feature Branch**: `015-challenge-nudge` (not created — work lands on `master`)

**Created**: 2026-11-11

**Status**: Implemented

**Input**: Owner (2026-11-11): "make daily challenges more noticeable, or somehow show that there are unfinished challenges". Of the proposals, the first step taken is the cheapest: a pulsing dot while any challenge is unfinished, on the daily challenges tile of Home (not on the Progress button — owner: it does not belong there). (A bigger Home card and challenge lines on the closing card are later steps.)

## Context

Daily challenges (spec 013) are a small tile reading "0 of 3" beside the streak. Nothing says that something is waiting.
An indicator that is on while work is left and off when it is done tells the learner there is something to do without
adding a number to read.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See that challenges are waiting (Priority: P1)

**Acceptance Scenarios**:

1. **Given** at least one of today's three challenges is not completed, **When** Home shows, **Then** a dot marks the
   daily challenges tile.
2. **Given** all three are completed, **When** Home shows, **Then** no dot is shown.
3. **Given** local midnight passes, **When** Home shows again, **Then** the dot is back (new challenges, none done).
4. **Given** the dot is shown, **When** the screen stays open, **Then** it pulses (a soft ring spreads from it and
   fades); under the system's reduced-motion setting it is a still dot.
5. **Given** a screen reader, **When** the tile is read, **Then** it says that challenges are left, in words; the
   dot itself is not announced.

### Edge Cases

- Before the standing has loaded, no dot is shown (never a dot that then disappears).
- The dot is the accent colour, not the warm one (which is kept for the weak move), and is never the only signal: the
  tile still reads "N of 3".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Home MUST show a pulsing dot on the daily challenges tile while any of today's challenges is not
  completed, and MUST NOT show it when all are completed or the standing is not loaded; it MUST NOT be shown on
  the Progress button.
- **FR-002**: The number of challenges left MUST come from one pure function over the day's challenge states.
- **FR-003**: The accessibility label of the marked tile MUST say how many challenges are left.
- **FR-004**: No new analytics event, no new dependency.

## Success Criteria *(mandatory)*

- **SC-001**: With none done the dot is visible on the tile; after the third it is gone.

## Assumptions

- Later steps (separate specs): a larger challenges card on Home, challenge progress on the closing card, an evening
  "resets soon" line. Push reminders are out of scope (spec 013).
