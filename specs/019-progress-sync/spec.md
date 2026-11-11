# Feature Specification: Gamification and Practice Progress on the Server

**Feature Branch**: `019-progress-sync` (not created — work lands on `master`)

**Created**: 2026-11-12

**Status**: Implemented

**Input**: Owner (2026-11-12): "gamification and practice progress must be stored on the server too."

## Context

What the server holds today for a signed-in learner: finished attempts (pushed, never pulled), the difficulty state,
a short "what was played" history, and (spec 017) where they stopped in each melody. XP, ranks, mastery, challenge
rewards and the streak live only on the device (spec 013), and a second device — or a reinstall — starts empty: the
Melodies list shows nothing played, Progress shows nothing, rank is Beginner.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rank, XP and mastery follow the account (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a signed-in learner earns XP, completes a melody or masters a level, **When** they are online, **Then**
   it is sent to the server; offline it waits on the device and is sent later.
2. **Given** the same account on a second device (or after a reinstall), **When** it syncs, **Then** the same total
   XP, rank, mastery and streak show there.
3. **Given** both devices earned XP before syncing, **When** they sync, **Then** both sets of rewards count once each, and
   a reward both devices paid for the same thing (the same day's challenge) counts once.
4. **Given** mastery was reached on two devices at different times, **When** they sync, **Then** the earlier date stays.
5. **Given** an anonymous learner signs in, **When** they sync, **Then** what they earned before is sent.

### User Story 2 - Practice history follows the account (Priority: P1)

**Acceptance Scenarios**:

1. **Given** attempts finished on another device, **When** this device syncs, **Then** they appear here: best scores
   in Melodies, the "Next up" weak spot in Progress, the week.
2. **Given** an attempt the device already has, **When** it is pulled again, **Then** it is not duplicated.
3. **Given** a long history, **When** syncing, **Then** it arrives in pages and only what is new is asked for next time.

### Edge Cases

- Sync never blocks a screen and never throws; a failed step is retried at the next sync.
- A reward row is identical wherever it is made (deterministic id), so combining sets of rows never changes a figure
  except by adding what the other device has.
- Syncing does not run more often than once a minute unless something was just earned.
- Another account's data is never mixed in: every row belongs to the signed-in account.
- What is not synced: challenge definitions (the server derives them from the date), "started" flags, the one-time
  conversion flag, the first-melody flag, playback speed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The server MUST store, per account, XP awards, melody completions and mastery records, each with a
  stable id; storing a row twice MUST change nothing, and for mastery the earliest date MUST win.
- **FR-002**: The server MUST give them back in pages after a cursor (`seq`), and the account's attempts the same way
  (with their note results), so a device asks only for what it has not seen.
- **FR-003**: The app MUST push every locally created row the server does not have, and mark it as sent only after the
  server accepted it.
- **FR-004**: The app MUST pull rows after its cursor, add the ones it lacks (mastery: keep the earlier date), and keep
  the cursor; derived figures (total XP, rank, streak, challenge progress) then follow from the rows.
- **FR-005**: The app MUST pull the account's attempts it lacks, rebuild the melody each belongs to from the library,
  and never duplicate an attempt.
- **FR-006**: Sync MUST run on launch, when the app returns to the foreground and when Home opens (at most once a
  minute), and right after a melody is completed; it MUST be a no-op for an anonymous learner or a build without a server.
- **FR-007**: Every server route MUST need the session token and MUST be scoped to that account; payloads are validated
  and bounded.
- **FR-008**: No new analytics event names, no new dependency.

### Key Entities

- **Game row**: kind (award, completion, mastery), id, the row's data, server order number (`seq`).
- **Sync cursor**: the last `seq` this device has seen, per kind of data.

## Success Criteria *(mandatory)*

- **SC-001**: After signing in on a fresh device and one sync, rank, XP and mastery equal the first device's.
- **SC-002**: Syncing twice in a row changes nothing.

## Assumptions

- Rewards are append-only and deterministic (spec 013), which is what makes combining two devices safe; a device that
  signs in to a different account than it was used with is out of scope (as for attempts today).
- Total XP is recomputed from rows, never stored as a number on the server.
