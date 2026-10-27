# Implementation Plan: Guitar Ear Training — Melody Recall & Playback Feedback

**Branch**: `001-guitar-ear-training` | **Date**: 2026-07-22 (revised 2026-10-11) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-guitar-ear-training/spec.md`

## Summary

> **Scope (2026-10-11, revised 2026-10-27, FR-020 / R14):** the app answers on an **on-screen fretboard**
> and uses **no microphone**. The microphone capture → segmentation → tuning pipeline and the melody
> generator were **deleted on 2026-10-27**; melodies come from the curated library
> (`src/services/melody/curated.ts`, FR-021), which the owner assembles. Grading, difficulty, persistence,
> sync and telemetry work on the notes the learner tapped. See `contracts/fretboard-input.md`; tasks in
> tasks.md Phase 9 and 11.

A cross-platform mobile app that trains ear-to-guitar recall through a tight loop: the app plays a
short curated melody from runtime-synthesized note tones, then the learner finds the notes on an on-screen
fretboard, the app grades the answer note-by-note, and shows immediate feedback. Adaptive difficulty (US2)
and cross-session progress (US3) build on that loop.

**Technical approach**: React Native + Expo with a **custom dev client** (not Expo Go, because native
modules are required). Melody playback
uses **expo-audio**, synthesizing a plucked-string tone (Karplus–Strong) per note at runtime and playing
it from a cached WAV — **no bundled audio samples**. **Local
SQLite is the on-device cache and the practice loop's authoritative local store** for
sessions/attempts/progress (satisfying the offline-core-loop and cross-session-persistence requirements),
while a **self-hosted Node/Postgres backend** (`server/`, Fastify + Drizzle) is a best-effort,
account-less sink for anonymous attempt logs **and** the durable, cross-device home for synced game
history. Distribution is via **EAS** — internal distribution on Android and
TestFlight/ad-hoc on iOS — to 10–15 testers. Per **Constitution Principle II (Test-First)**, all pure
logic — grading, pitch↔note math, the fretboard model and the curated library — is developed **test-first**
with unit and contract tests (Jest / `ts-jest`); audio fidelity is additionally validated on real devices.

## Technical Context

**Language/Version**: TypeScript 5.3.x on React Native 0.86 (Expo SDK 57), targeting Hermes.

**Primary Dependencies**: Expo (custom dev client), `expo-audio` (playback of runtime-synthesized tones), the built-in `fetch` (anonymous
attempt logging + game-history sync to the Node backend — no client SDK), `expo-sqlite` (local cache /
authoritative offline store), `expo-router` (navigation),
`expo-file-system` (writes/reads the cached synthesized-tone WAVs). ESLint + Prettier + TypeScript
`strict`.

**Storage**:
- **Local (offline cache / authoritative in the loop)**: `expo-sqlite` for Sessions, Attempts, and derived
  Progress — works fully offline (FR-013, offline-core-loop assumption).
- **Remote (Node/Postgres backend, `server/`)** — telemetry is owned by this spec (FR-019); game-history
  sync is specified in `specs/002-history-sync/` and the waitlist in `specs/003-landing-waitlist/`: Fastify + Drizzle + Postgres, no accounts. Insert-only
  `attempt_log` telemetry (`POST /api/attempts`), `signups` waitlist (`POST /api/subscribe`), and durable
  game-history sync (`POST/GET /api/sync` into `sync_documents`, last-write-wins on `updated_at`).
  Anonymous per-install device id; telemetry is best-effort with an offline outbox queue.

**Testing**: **Jest** (`ts-jest`, node environment — no `jest-expo`, no React Native Testing Library; hooks and `.tsx` are therefore not unit-testable, so their logic lives in pure `.ts` and the screens are validated on-device via `quickstart.md`). Pure logic
(grading engine, pitch↔note math, fretboard model, curated library) is written **test-first** with
table-driven unit tests; each service boundary in `contracts/` has contract tests run against mocked
native modules (`expo-audio`) and the injected HTTP transport (attempt-log / sync clients). Audio
fidelity — which cannot be unit-tested — is validated on real devices via `quickstart.md`.

**Target Platform**: iOS 15+ (TestFlight / ad-hoc) and modern Android (EAS internal distribution). The
app needs only audio output, so it also runs in a simulator or emulator.

**Project Type**: Mobile application (single Expo React Native project).

**Performance Goals**:
- Feedback rendered within **2 s** of the learner pressing Check (SC-003), and grading completes
  **< 500 ms** after Check.
- Full listen→answer→feedback cycle completable in **under 15 s** (SC-001).
- 60 fps UI during playback and feedback.
- **Fretboard input (FR-020, SC-010)**: a tap sounds its note without perceptible lag. The original
  target was **p95 < 200 ms** (the constitution default for interactive operations); it was **not
  measured** — the owner accepted a hands-on check on a physical device on 2026-10-11 (T075A). The 37 neck
  pitches are pre-rendered once the screen has settled so no tap pays for synthesis.

**Constraints**:
- **Offline core loop**: melody selection, playback, answering, and grading MUST work with no network; backend
  telemetry and sync are deferred to an outbox / next sync when offline.
- **Monophonic only**: single-note melodies.
- **Neck range**: melodies stay inside the 12-fret neck, **E2–E5 (MIDI 40–76)**.
- **Note match**: a tapped note matches when its MIDI number equals the target's — pitch class and octave
  together (FR-016).
- **Grading alignment**: best-fit sequence alignment (edit-distance/LCS) so a single inserted/omitted note
  doesn't cascade following notes to wrong (FR-005).
- **Repeated pitches are allowed**: curated melodies (FR-021) may repeat a pitch back-to-back — a fretboard tap is a separate tap.
- **Difficulty ladder (US2)**: exactly **9 ranks** (FR-010) that differ in note count (3–10); every rank
  plays at a fixed **90 BPM**. The curated tunes are assigned to ranks (FR-021). Targets can span octaves,
  so the octave-mismatch path (FR-016) is live.
- **Adaptation rule (US2)**: asymmetric consecutive streaks — 3 correct → +1 rank, 2 incorrect → −1 rank,
  steps always ±1, counter resets on every rank change (this is the anti-thrash hysteresis), rank clamps at
  1 and 9. Only the **first graded attempt per new melody** counts; retries are excluded entirely and leave
  the streak untouched (FR-011a). Mode, adaptive rank, and fixed
  selection are three independently persisted values (FR-011b). Implemented as a **pure reducer** in
  `src/features/difficulty/` — see `contracts/difficulty-adaptation.md`.
- **Difficulty defaults & disclosure** (design decisions taken at plan time, not spec clarifications): a
  brand-new learner starts in `adaptive` mode at **rank 1**, which is also the rank the US1-only build runs
  at. When adaptation moves the rank, the app **announces the change in the feedback step** ("Level up —
  4 notes"), so difficulty never shifts silently (Constitution III: predictable behavior). The announcement
  is a shared feedback component carrying an accessible label so screen readers report it too (SC-009).
- **Runtime tone synthesis**: per-note plucked-string tones are synthesized at runtime (Karplus–Strong),
  encoded as WAV, and cached on device; no audio samples are bundled. Any MIDI note in range can be
  produced on demand, so the library is not constrained to a pre-rendered asset set.
- **No audio capture (FR-019, FR-020)**: the app declares no microphone permission on either platform
  (`expo-audio` `microphonePermission: false` / `recordAudioAndroid: false`, `RECORD_AUDIO` blocked in
  `app.config.ts`); remote telemetry is limited to anonymized attempt metadata (no PII, no accounts),
  best-effort and non-blocking. Verified by SC-008.
- **Accessibility (SC-009)**: the UI meets a WCAG 2.1 AA, mobile-adapted baseline — labeled controls and
  roles, text contrast ≥ 4.5:1, full VoiceOver/TalkBack operability, touch targets ≥ 44pt (iOS)/48dp
  (Android), and layouts usable at the OS's largest standard font-scaling.

**Scale/Scope**: 10–15 closed testers; single local learner per install; small data volume
(hundreds–thousands of attempts). ~6–8 screens/flows.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| **I. Code Quality & Maintainability** | ESLint + Prettier enforced in CI-equivalent local checks; TypeScript `strict`; single-responsibility services; no dead code | ✅ PASS — committed in Project Structure; tooling is a merge prerequisite |
| **II. Test-First & Comprehensive Coverage (NON-NEGOTIABLE)** | New behavior has failing tests first; contracts have tests | ✅ PASS — Jest (`ts-jest`, node; no RNTL, so hooks/`.tsx` are validated on-device); pure logic (grading, pitch↔note, fretboard, curated library) is test-first; each contract has boundary tests against mocked natives. Audio fidelity validated on-device (not unit-testable). |
| **III. User Experience Consistency** | Shared component library, consistent feedback/error patterns, accessibility baseline | ✅ PASS — `src/components/` is the single source for shared UX; unified feedback and error states; accessibility baseline made concrete as **WCAG 2.1 AA, mobile-adapted (SC-009)** — labeled controls, ≥ 4.5:1 contrast, VoiceOver/TalkBack, ≥ 44pt/48dp targets |
| **IV. Performance by Design** | Measurable targets declared before implementation; evidence-driven optimization | ✅ PASS — targets declared above; tap-to-sound latency (SC-010) and grading time are budgeted; the cycle budgets (SC-001/003) are measured by T092 |

**Initial gate result**: PASS — no exceptions. All four principles are satisfied by the plan.

**Post-Design re-check**: Design keeps grading (`src/services/grading`), pitch↔note math (`src/lib`), and
the curated library (`src/services/melody`) as pure functions with explicit contracts, making them directly
unit-testable; native IO is isolated behind mockable service wrappers so boundaries are contract-tested.
The audio design (expo-audio + runtime Karplus–Strong synthesis) keeps the synth (`src/services/audio/synth.ts`)
pure and unit-tested, with only the cache-write and playback native and injected behind a `NativePlayer`.
The FR-019 on-device-audio boundary and the concrete SC-009 accessibility baseline introduce no gate
deviation. No violations introduced by the design. ✅

**Post-clarification re-check (2026-07-24, US2 difficulty design)**: The adaptation rule is specified as a
**pure reducer** with no IO, clock, or randomness (`contracts/difficulty-adaptation.md`), so Principle II is
satisfied by table-driven unit tests covering every transition, including the exclusion and clamping cases —
no on-device validation is required for the rule itself. Principle IV: the decision is O(1) arithmetic over a
5-field record on an already-persisted row, so it cannot threaten the 15 s cycle budget (SC-001); no
additional performance target is warranted beyond the existing budgets. Principle III: the ladder collapses
to a single varying dimension and manual mode exposes all ranks ungated (9 since 2026-09-23), keeping the settings surface
simple and predictable. Principle I: difficulty logic stays a single-responsibility pure module, separate
from the storage that persists it. No new gate deviations. ✅

**Post-implementation re-check (2026-10-11, FR-020 fretboard input — historical: `resolveInputMode` and the mic pipeline it kept were deleted on 2026-10-27)**: The change landed before its spec
(recorded retroactively — see tasks Phase 9 and 10), which the **Specification first** rule forbids; it is
corrected here, not repeated. Principle I: input-mode selection is one pure function
(`resolveInputMode`) and the tap model is a pure module (`src/lib/fretboard.ts`); the mic pipeline is kept
rather than deleted, which is the one added layer — justified in R14 as the planned next phase.
Principle II: the tap model, mode resolution, mode-aware progress and the telemetry field are unit/contract
tested; the hook wiring and screens are not executable under ts-jest and are validated manually
(quickstart F1–F8) — the same boundary the plan already draws for native audio. Principle III: the new
controls carry accessibility labels, but the baseline (SC-009) is **not yet validated** for the fretboard —
open task T076; this is a known gap, not a pass. Principle IV: tap-to-sound responsiveness declared above
(SC-010), accepted on a hands-on check rather than a measurement (T075A). **Status: conditional pass** — T075 passed on a device and the owner accepted the hands-on latency check in place of a measurement (T075A, 2026-10-11); Principle IV is therefore met by an accepted exception, not by data. Closes when T076 (accessibility, Principle III) is done. ⚠️

**Post-removal re-check (2026-10-27, microphone + generator removed)**: Principle I — dead code is gone, not
flagged off: the detector, capture, segmenter, calibration, tuning check, `react-native-pitchy`, the
input-mode and melody-source flags and the generator were deleted together with their tests, which
removes the one added layer the previous re-check justified. Principle II — suite green (227 tests) after
the removal; the loop hook and screens remain on-device-validated. Principles III and IV — unchanged;
T076 (accessibility) and T092 (cycle budgets) are still open. **Status: conditional pass**, as before. ⚠️

## Project Structure

### Documentation (this feature)

```text
specs/001-guitar-ear-training/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (manual validation guide — primary QA gate this phase)
├── contracts/           # Phase 1 output
│   ├── audio-playback.md
│   ├── grading-engine.md
│   ├── difficulty-adaptation.md
│   ├── attempt-log.md
│   └── fretboard-input.md
└── checklists/
    ├── requirements.md
    ├── audio.md
    ├── difficulty.md
    └── fretboard-a11y.md
```

### Source Code (repository root)

```text
app/                          # expo-router screens
├── _layout.tsx
├── index.tsx                 # Home / start session
├── practice.tsx              # US1 core loop screen
├── settings.tsx              # US2 difficulty controls
└── progress.tsx              # US3 progress view

src/
├── components/               # Shared UI (Principle III: single source of shared UX)
│   ├── feedback/             # NoteResult chips, verdict banner, per-note breakdown
│   ├── fretboard/            # on-screen neck, 6 × 13 tappable cells (FR-020)
│   ├── practice/             # fretboard answer stage (slots + neck)
│   ├── controls/             # Play / Replay / Retry / Next, Undo / Clear / Check buttons
│   └── common/               # Buttons, layout, accessible primitives
├── features/
│   ├── practice/             # US1 orchestration (state machine, hooks)
│   ├── difficulty/           # US2 adaptive + manual difficulty (pure reducer)
│   │                         #   → contracts/difficulty-adaptation.md
│   └── progress/             # US3 aggregation + views
├── services/
│   ├── audio/
│   │   ├── playback.ts       # expo-audio synthesized-tone playback → contracts/audio-playback.md
│   │   ├── synth.ts          # runtime Karplus–Strong tone synth → WAV (pure)
│   │   └── session.ts        # audio-mode (playback) driver
│   ├── melody/               # curated.ts — the hand-written tune library (FR-021); levels.ts — the 9-rank ladder
│   ├── grading/              # grading engine (pure)       → contracts/grading-engine.md
│   ├── storage/              # expo-sqlite repositories (offline cache / authoritative in the loop)
│   ├── sync/                 # game-history push/pull       → server /api/sync (offline-safe)
│   └── logging/              # anonymous attempt-log outbox → server /api/attempts (contracts/attempt-log.md)
├── models/                   # Entity types (data-model.md)
└── lib/                      # pitch↔note math, schedule, fretboard.ts — neck geometry and tap → note model
                              #   → contracts/fretboard-input.md (pure)

tests/                        # Jest (ts-jest, node) — no React Native Testing Library
├── unit/                     # pure logic (grading, pitch↔note, fretboard, curated library) — test-first
└── contract/                 # boundary tests vs mocked expo-audio / HTTP transport

assets/
└── samples/                  # (legacy scaffold) note-range guard only — no bundled audio; tones synth'd at runtime

server/                       # self-hosted backend (replaces Supabase) — Fastify + Drizzle + Postgres
├── src/routes/               # /api/attempts (telemetry), /api/subscribe (waitlist), /api/sync (history)
├── src/db/                   # Drizzle schema + boot DDL: attempt_log, signups, sync_documents
└── Dockerfile, docker-compose.yml

eas.json                      # development (dev-client) + internal/ad-hoc distribution profiles
app.config.ts                 # Expo config: no microphone permission, plugins, bundle ids, EXPO_PUBLIC_API_URL
```

**Structure Decision**: Single Expo React Native app using `expo-router`. Code is organized by the three
user stories under `src/features/` for independent implementation, with cross-cutting capabilities
(`audio`, `melody`, `grading`, `storage`, `logging`) isolated as services behind the contracts in
`contracts/`. Pure logic (`melody`, `grading`, `lib`) is deliberately separated from native/IO
(`audio`, `storage`, `logging`) so it is directly unit-testable test-first, while native modules are
mocked at the service boundary for contract tests.

## Complexity Tracking

Constitution exceptions in force. Each has an owner decision and a way out; none is silent.

| # | Principle | Exception | Why accepted | Closes when |
|---|-----------|-----------|--------------|-------------|
| 1 | IV Performance | **SC-010** (tap-to-sound) was never measured; the owner accepted a hands-on check on 2026-10-11 (T075A). SC-001 / SC-003 were never measured in `fretboard` mode. | The tap sounds without perceptible lag on a device; instrumenting costs more than the risk. | A tap ever feels late (re-open T075A with a measurement), and T092 measures SC-001 / SC-003. |
| 2 | III UX / accessibility | **SC-009 is not met for the fretboard**: fret cells are ≈ 51 × 29 pt against the 44 pt target (re-measured on a simulator after the 12-fret change; 16 frets gave ≈ 24 pt). See `checklists/fretboard-a11y.md`. | **Pending owner decision** (exempt the dense grid, or redesign it) — not yet an accepted exception. | T076 closes: the decision is recorded here and the cheap fixes are applied. |

An earlier draft of this plan deferred automated testing as a Principle II exception. That deviation was
**withdrawn**: Principle II is satisfied by a test-first unit layer for all pure logic (grading,
pitch↔note math, fretboard model, curated library) plus contract tests at each service
boundary. The only behavior left to manual, on-device validation is audio
fidelity and the screens (hooks and `.tsx` cannot run under ts-jest) — not a deviation from the principle.
