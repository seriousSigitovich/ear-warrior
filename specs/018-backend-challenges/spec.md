# Feature Specification: Daily Challenges From the Backend

**Feature Branch**: `018-backend-challenges` (not created — work lands on `master`)

**Created**: 2026-11-12

**Status**: Implemented

**Input**: Owner (2026-11-12): "daily challenges must come from the backend". Today the three challenges are constants in the app (spec 013), so changing them needs an OTA and every learner gets the same three every day.

## Context

The server decides the day's three challenges and their rewards; the app asks for them, shows them, and keeps the offline
constants as a fallback so the screen is never empty. The day's challenges, once the app has them, are fixed for that
day (stored), so a change on the server never alters what a learner already started or was paid for.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The server sets the day's challenges (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a local date, **When** the app asks the server, **Then** it gets exactly three challenges (a warm-up in
   melodies, an accuracy goal, a larger volume goal) with targets, rewards and the all-done bonus.
2. **Given** the same date asked twice, **When** the server answers, **Then** the answers are identical; across days
   they vary within achievable ranges.
3. **Given** a date that is not a real calendar day or is far from today, **When** asked, **Then** the server refuses.

### User Story 2 - The app shows and fixes them (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the server answered, **When** Home or the challenges screen opens, **Then** they show the server's
   challenges for the learner's local day, and the all-done bonus the server gave.
2. **Given** the day's challenges were received, **When** the app is reopened (even offline), **Then** the same ones
   show; they are not asked for again that day.
3. **Given** the server is unreachable, **When** the app opens, **Then** the built-in challenges are used and nothing
   breaks; if a reward is paid from them the day stays on them.
4. **Given** a challenge was paid today, **When** the server later answers differently, **Then** today's challenges do
   not change (no double payment).

### Edge Cases

- An answer with a type the app does not know, a malformed field or a missing challenge is ignored as a whole.
- The challenge screen opening is still the "started" analytics event, once per day.
- The learner's day is their local day; the app sends that date, the server does not guess a timezone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/challenges/today?date=YYYY-MM-DD` MUST return `{ ok, date, challenges[3], all_bonus_xp }`, each
  challenge `{ id, type, target, reward_xp, title, description }`, type `melodies` or `accuracy`; no login needed.
- **FR-002**: The answer MUST be a pure function of the date: stable for a date, varied across dates, ids unique within
  a day, every target achievable with the library (melodies 2–6, accuracy 85–95%).
- **FR-003**: The server MUST refuse a date that is not a valid calendar day or is more than two days from today.
- **FR-004**: The app MUST fetch the day's challenges at most once per day (when none are stored), store them with the
  day, and use stored ones for that day, online or off.
- **FR-005**: The app MUST validate the answer completely before using it and MUST fall back to its built-in
  challenges otherwise.
- **FR-006**: Challenges already paid or started on built-in ones MUST stay fixed for that day.
- **FR-007**: Screens MUST take titles, rewards and the bonus from the day's challenges, not from constants.
- **FR-008**: Opening Home MUST NOT wait for the network.

### Key Entities

- **Day's challenges**: the three challenge definitions and the all-done bonus for one local day, stored on the device.

## Success Criteria *(mandatory)*

- **SC-001**: Changing the server's challenge table changes the next day's challenges for everyone without an OTA.
- **SC-002**: With no network the learner still sees and can complete three challenges.

## Assumptions

- Challenges are the same for everyone on a given date (not personalised); the types are limited to the two the app
  already evaluates. A richer pool or per-level targets are later steps.
- No authentication: the answer carries nothing about the learner.
