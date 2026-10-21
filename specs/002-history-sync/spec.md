# Feature Specification: Practice History Sync

**Feature Branch**: `002-history-sync` (not created — work landed on `master`)

**Created**: 2026-10-11 (**retroactive**: the feature was built before this spec; the requirements below are
read from `server/src/routes/sync.ts`, `src/services/sync/`, and research R8/R9 of `001-guitar-ear-training`)

**Status**: Draft — implemented, **untested on the server side**, open questions below

**Input**: A learner's practice history must survive losing or reinstalling the app, and the practice loop
must keep working with no network.

## Clarifications

### Session 2026-10-11 (recorded from the implementation — confirm or correct)

- Q: Which side is authoritative? → A: The **device's SQLite is the practice loop's authoritative local store**; the server (Postgres) is the **durable, cross-install copy**. Practice never waits on the network (offline-core-loop, spec 001).
- Q: Who owns an account? → A: **Nobody — there are no accounts.** *(Amended 2026-10-21 by spec 005: an optional email account may now exist; sync is still keyed by `device_id` and does not change.)* History is keyed by the anonymous per-install `device_id` (spec 001 FR-019). Consequence: history follows the install, not a person; see Open Questions.
- Q: How are conflicts resolved? → A: **Last-write-wins per document on `updated_at`** (client wall-clock ms). A push older than what the server holds is ignored, so replays and retries are safe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - History survives reinstall (Priority: P1)

As a learner, I want my sessions, attempts and difficulty progress to be restored after I reinstall or move
the app, so that months of practice are not lost.

**Why this priority**: Progress is the learner's motivation (spec 001 US3); losing it on a reinstall is the one
failure that breaks trust. **Independent Test**: practise, sync, wipe the app's local store, relaunch with the
same device id → the progress view and difficulty settings match what they were.

**Acceptance Scenarios**:

1. **Given** a device with local history and a reachable server, **When** a sync runs, **Then** every
   syncable local document is pushed and the server holds it.
2. **Given** a fresh install that knows its `device_id`, **When** a pull with `since = 0` runs, **Then** the
   full history is written into the local store.
3. **Given** a later sync, **When** it pulls with the last `serverNow`, **Then** only documents changed since
   then are transferred.
4. **Given** the server is unreachable or `EXPO_PUBLIC_API_URL` is unset, **When** the learner practises,
   **Then** nothing is blocked or surfaced as an error and the work syncs later.

---

### Edge Cases

- A stale push (older `updated_at` than the server's copy) MUST NOT overwrite newer data.
- A push of more than 2000 documents, an unknown collection, or a malformed body → `400 invalid_payload`.
- A database failure → `502 store_failed` / `read_failed`; the client retries on the next sync.
- The device id is local-only and MUST NOT itself be synced as a document.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST sync these collections: `sessions`, `attempts`, `melodies`,
  `difficulty_settings`. The device id (`key_value`) is local-only.
- **FR-002**: `POST /api/sync { device_id, documents[] }` MUST upsert each document keyed by
  `(device_id, collection, doc_id)`, last-write-wins on `updated_at`, and report how many were applied.
- **FR-003**: `GET /api/sync?device_id&since` MUST return every document for that device with
  `updated_at > since`, plus `serverNow`, so an incremental sync can resume from it.
- **FR-004**: Sync MUST be best-effort and non-blocking: the practice loop never awaits it and never fails
  because of it (consistent with spec 001 FR-019's telemetry posture).
- **FR-005**: The payload MUST contain **no audio and no PII**. It holds the same practice records the device
  already stores (note-level results included), keyed by the anonymous `device_id`.
- **FR-006**: Attempts MUST carry their `inputMode` (spec 001 FR-020) through sync unchanged.

### Key Entities

- **Sync document**: `{ collection, doc_id, data, updated_at }` — one stored row, opaque to the server.
- **Device id**: random per-install id, no PII, generated locally (spec 001 T013).

## Success Criteria *(mandatory)*

- **SC-001**: After a wipe and a pull with `since = 0`, the restored history is identical to the pre-wipe
  history (sessions, attempts, melodies, difficulty settings).
- **SC-002**: With the server down, the full practice loop completes and no error is shown.
- **SC-003**: Replaying the same push twice leaves the server unchanged (idempotent).
- **SC-004**: Outbound sync traffic contains only the documents above — no audio, no pitch frames (extends
  spec 001 SC-008).

## Assumptions

- One learner per `device_id`; two devices sharing a history is out of scope.
- The server is a single self-hosted Fastify + Postgres instance (`server/`, spec 001 R9).
- Client clocks are roughly right; last-write-wins trusts `updated_at` from the device.

## Open Questions (not decided — owner to resolve)

- **History follows the install, not the person.** With no accounts, a reinstall gets a *new* `device_id`
  and cannot reach the old history. Is "survives reinstall" (US1) actually deliverable without an account or
  a recovery code? As written, only a restore of the same device id works.
- **Retention and deletion**: no route deletes a device's data. Is a deletion path required (privacy)?
- **Conflict with spec 001 SC-008.** SC-008 says outbound traffic "shows only the anonymized
  attempt-metadata payload defined in FR-019". Sync pushes **full attempt documents** (`detectedNotes`,
  `noteResults`, melodies) — still no audio or pitch frames, but far more than the FR-019 aggregate. Either
  SC-008/FR-019 must be widened to cover the sync payload, or sync must be reduced. **Decision needed**; until
  then spec 001 SC-008 cannot honestly pass.
- **Client-stamped time**: `collectLocalDocuments` stamps every pushed row `updated_at = now`, so a device
  that was offline can overwrite newer data from elsewhere. Acceptable for one device per id?

## Verification status

- **No tests anywhere for sync.** Neither `src/services/sync/` (client orchestration, pure and testable
  against the in-memory `RowStore` and a mock client) nor `server/src/routes/sync.ts` has a test. That is a
  gap against Constitution II (boundaries need contract tests; core logic needs unit tests). Tracked as
  T001–T003 below.

## Tasks (retroactive)

- [ ] T001 Unit tests for `collectLocalDocuments` / `applyPulledDocuments` against the in-memory `RowStore` (collections synced, device id excluded, singleton difficulty row)
- [ ] T002 Contract test for the sync client against a mocked transport (push, pull since, offline no-op when `EXPO_PUBLIC_API_URL` is unset)
- [ ] T003 Server route tests for `POST/GET /api/sync` (last-write-wins, stale push ignored, 400 on bad body, idempotent replay)
- [ ] T004 Resolve the open questions above and fold the answers back into this spec
