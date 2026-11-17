# Implementation Plan: Server-Authoritative XP, Ranks and Melody Library

**Branch**: `024-server-authoritative-xp` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-server-authoritative-xp/spec.md`

## Summary

Move every decision about rewards to the server. The server gains a melody library (tunes with answer notes and voiced audio, managed from an admin page), grades each phrase check itself, pays XP by one configuration (level multiplier × attempt factor × hint factor × daily cap), keeps an append-only XP ledger, and derives the rank from total XP alone. The app becomes a display layer: it downloads the catalog and audio (cached by content hash), sends the raw taps of a phrase, and renders the server's answer. Mastery, local grading for XP, local XP storage and the push of reward rows are removed. Anonymous learners get a server identity that merges into the account at sign-in. Details: [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.x. Server: Node ≥ 20 ESM (Fastify 5, Drizzle ORM 0.36, zod 3, `node:test` via tsx). App: Expo / React Native (Jest ts-jest, pure-logic only — see memory `jest-pure-logic-runner`).

**Primary Dependencies**: existing only — Fastify, Drizzle/postgres.js, zod, `@vercel/blob` (already a server dependency, used by the publish tooling) for audio files; expo-file-system on the device (already used for storage). No new package planned.

**Storage**: Postgres (Neon) — new tables `tunes`, `xp_ledger`, `phrase_checks`, `phrase_events`, `daily_xp`; `users` gains an `anonymous` flag and a nullable email. Audio files in Vercel Blob, referenced by URL + SHA-256. On the device: audio cache directory plus a small check queue in the existing key-value store; the SQLite XP tables are dropped after migration.

**Testing**: server — `node:test` against the memory store and, when reachable, Postgres (the existing store-contract pattern); pure rules (XP, rank, cap, grading) unit-tested; routes tested with Fastify `inject`. App — pure `.ts` logic only (cache decisions, queue, display mapping).

**Target Platform**: Vercel serverless (server), iOS/Android app via Expo + OTA.

**Project Type**: mobile app + API (existing `server/` and `src/`).

**Performance Goals**: a phrase check answers in p95 < 400 ms server-side (one grading of ≤ 64 notes, three small queries); a catalog request < 200 ms and ≤ 30 KB; a cached melody starts with no network wait; a clip download ≤ 400 KB per tune (about 260 KB today), prefetch of two levels ≤ 6 MB total, only on Wi-Fi-agnostic background, never blocking a screen.

**Constraints**: the answer notes never leave the server except on an explicit "show answer" (pays 0); a replayed or duplicated request changes nothing (idempotent by `check_id`); offline-capable listening on bundled L1 tunes; old app versions must keep working until the new one is adopted (see Rollout).

**Scale/Scope**: ~100 tunes, 436 phrases, beta-scale users (hundreds), ledger rows ≈ phrases per user (≤ 436 + challenges).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Code Quality | Pass | One XP configuration module on the server (FR-019) replaces two (client and server challenge tables stay separate files by concern). Dead code is deleted, not commented: `src/lib/gamification.ts`, `src/config/gamification.ts`, mastery tables, reward sync. Lint/format gates unchanged. |
| II. Test-First | Pass | Every task group starts with failing tests: rules (XP/rank/cap), grader, store contract on memory + Postgres, route tests, migration idempotency, client cache/queue logic. Replay/forgery regression tests for SC-001. |
| III. UX Consistency | Pass with one declared risk | Rank UI reuses the existing `RankCard`/`RankUpModal`; copy for offline and "download needed" states follows the existing error-message style (what happened + what to do). Risk: offline Check cannot show per-note feedback (the app no longer holds answers) — it shows "waiting for connection" and queues (spec US4); flagged for owner review. |
| IV. Performance | Pass | Targets declared above; audio prefetch is background and bounded; catalog is small and conditional (hash/ETag). |

**Complexity Tracking**: one justified addition — a copy of the pure grader (`gradeAttempt` alignment) on the server. Alternative rejected: importing `src/` from `server/` (separate package, separate tsconfig/build, deployed on its own). The copy is covered by a shared fixture test that runs the same cases against both implementations to prevent drift; the app's copy of the grader is deleted once the server grades (the app only uses it for the draft mode, which is kept as is).

Post-design re-check: still pass; no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/024-server-authoritative-xp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
server/src/
├── game/                      # NEW — pure rules, no IO
│   ├── config.ts              # every reward number (FR-019): multipliers, factors, cap, thresholds, pass mark
│   ├── grade.ts               # phrase grading (copy of the app's alignment grader, on midi lists)
│   ├── xp.ts                  # phrase payout: base × level × attempt × hint, then the daily cap
│   ├── rank.ts                # rank from total XP
│   └── *.test.ts
├── tunes/
│   ├── store.ts / memoryStore.ts / pgStore.ts / store.contract.ts   # tunes + audio refs
│   ├── seed.ts                # loads library.abc → tunes (idempotent)
│   └── adminPage.ts           # /admin/tunes
├── progress/
│   ├── ledger.ts + stores     # xp_ledger, phrase_checks, phrase_events, daily_xp
│   ├── recompute.ts           # one-time migration from stored attempts (FR-017)
│   └── (existing files trimmed: game rows removed)
├── routes/
│   ├── melodies.ts            # GET /api/melodies, audio redirect
│   ├── phrase.ts              # POST /api/progress/phrase, hint, answer, GET state
│   ├── adminTunes.ts
│   ├── auth.ts                # + POST /api/auth/anonymous, merge on sign-in
│   └── progress.ts            # POST /api/progress/gamification → 410
├── db/ddl.ts, schema.ts       # new tables, users.anonymous
└── challenges/                # evaluated from accepted phrases

server/scripts/
└── upload-tunes.ts            # library.abc + assets/app/audio/melodies/*.m4a → Blob + tunes rows

src/
├── services/
│   ├── tunes/                 # NEW: catalog client + on-disk audio cache + prefetch (pure decisions in .ts)
│   ├── gamification/          # REPLACED by a thin client: phrase check call, queue, state fetch
│   └── melody/                # library.ts/library.abc/curated.ts: catalog replaces the bundled library
├── features/practice/         # usePracticeLoop: grade/hint/answer come from the server
├── components/progress|gamification|feedback  # RankCard etc.: show XP only, no mastery
└── lib/gamification.ts, config/gamification.ts   # DELETED
assets/app/audio/melodies/     # all but 5 L1 clips removed from the bundle
```

**Structure Decision**: keep the existing two packages (`server/`, app `src/`). All reward logic lives in `server/src/game/` as pure modules behind the existing store-contract pattern (memory + Postgres). The app keeps no reward logic.

## Rollout

1. **Server first, additive.** Deploy new tables, `/api/melodies`, `/api/progress/phrase` and anonymous identities. The old `POST /api/progress/gamification` still works so installed apps keep syncing; their rows are stored but **ignored** by rank (the ledger is the only source).
2. **Seed and upload** tunes and clips; run the recompute for existing accounts (idempotent, dry-run first, owner reviews the numbers).
3. **Rank thresholds** reviewed by the owner (proposal in research.md D5) before step 4.
4. **App release** (store build, because the bundle shrinks; OTA cannot remove bundled assets) with the thin client.
5. When adoption is sufficient, `POST /api/progress/gamification` answers 410 (FR-015).
