# Feature Specification: Progress for a Beginner

**Feature Branch**: `011-beginner-progress` (not created — work lands on `master`)

**Created**: 2026-11-10

**Status**: Implemented

**Input**: User description: "оставь только то что полезно для начинающего гитариста" + "с точки зрения ux/ui выглядит странно и скучно" → the owner approved a mockup: an accuracy ring, the week as a row of day circles, and one "next up" card with a drawn contour of the weak move and a melody to play.

## Context

The Progress screen of spec 010 is correct but reads as a report: six grey cards of equal weight, the same bar
everywhere, more text than picture, and names from music theory a beginner does not know ("fourths & fifths").
Only three of its blocks change what a beginner does next. This change keeps those three, draws them instead of
listing them, and removes the rest.

## User Scenarios & Testing *(mandatory)*

> **Removed 2026-11-11 (owner: "a useless metric")**: the accuracy ring of User Story 1 and the change-on-last-week
> pill were taken off the screen, with the note-accuracy code behind them. A replacement tied to the product (phrases
> right first time, longest phrase reproduced, mastery of the current level) is a candidate for a later spec.

### User Story 1 - "Am I getting better?" at a glance (Priority: P1)

One ring shows the share of notes landed this week, with the change against last week beside it.

**Acceptance Scenarios**:

1. **Given** tunes finished in the last 7 days, **When** Progress opens, **Then** a ring filled to the share of notes
   landed shows the percentage inside, with "N of M notes" beside it.
2. **Given** data for the week before too, **When** Progress opens, **Then** a pill says how many points up or down.
3. **Given** nothing in the last 7 days, **When** Progress opens, **Then** the ring shows the all-time figure and says so.

---

### User Story 2 - "Am I practising regularly?" as a week (Priority: P1)

The current week is a row of seven day circles: practised days are filled, today fills up as the daily goal is
met, days ahead are outlined. Above it: days in a row and today's count.

**Acceptance Scenarios**:

1. **Given** any history, **When** Progress opens, **Then** Monday to Sunday of the current week are shown with each
   day's state (practised, not practised, today with its count, still ahead).
2. **Given** today's goal is met, **When** Progress opens, **Then** today is shown as done like a practised day.

---

### User Story 3 - "What do I play next?" as one card (Priority: P1)

One card names the weakest kind of move in everyday words, draws it as a small contour, and offers one melody to
play with a single button; two more are named beneath as alternatives.

**Acceptance Scenarios**:

1. **Given** a weakest kind of move (spec 010 FR-003–FR-005), **When** Progress opens, **Then** the card says it in
   plain words ("Big jumps up trip you · You land 3 of 9"), draws its shape, and one tap starts the first melody.
2. **Given** not enough notes yet, or no weak spot, **When** Progress opens, **Then** the card says so in one
   sentence and pushes nothing.

---

### Edge Cases

- No finished tunes: the empty state.
- Reduced motion: the ring is drawn filled, without the opening animation.
- A week that starts in one month and ends in another, and a DST change inside the week.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Progress MUST show exactly three blocks: the accuracy ring (spec 010 FR-001/FR-002 without the per-day
  trend), the week strip with streak and today's count, and the next-up card.
- **FR-002**: Kinds of melodic move MUST be named in everyday words everywhere they are shown: "the same note
  again", "small steps", "skips", "jumps", "big jumps", with "up"/"down".
- **FR-003**: The weak move MUST be drawn as a contour whose rise or fall grows with the size of the move.
- **FR-004**: The warm colour MUST be used only for the weak move; everything else stays in the accent/neutral ramps.
- **FR-005**: The interval list, "How your misses go", the library-by-level block, Recent melodies and the trend
  chart MUST be removed from the screen, and code used only by them deleted (with its tests).
- **FR-006**: The ring MUST animate once on opening and MUST NOT animate under reduced motion.
- **FR-007**: No new dependency (the ring and contour are drawn with Views), no server change, no new event names.

## Success Criteria *(mandatory)*

- **SC-001**: The whole screen fits one phone screen without scrolling on a 6" device.
- **SC-002**: From Progress, the recommended melody starts in one tap.
- **SC-003**: No music-theory term appears on the screen.

## Assumptions

- The week runs Monday to Sunday.
- Later, not now (owner, 2026-11-10): a leaderboard. It needs accounts and a server-side score, so it is a feature
  of its own.
- Also later: moving the recommendation onto the tune's closing card ("Next: X, it trains big jumps up").
