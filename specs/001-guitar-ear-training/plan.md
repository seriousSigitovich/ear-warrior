# Implementation Plan: Guitar Ear Training — Melody Recall & Playback Feedback

**Branch**: `001-guitar-ear-training` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-guitar-ear-training/spec.md`

## Summary

A cross-platform mobile app that trains ear-to-guitar recall through a tight loop: the app plays a
short generated melody from pre-rendered note samples, then captures the learner's guitar reproduction
via the microphone, detects the played notes with monophonic pitch detection, grades them note-by-note,
and shows immediate feedback. Adaptive difficulty (US2) and cross-session progress (US3) build on that
loop.

**Technical approach**: React Native + Expo with a **custom dev client** (not Expo Go, because native
modules are required). Monophonic pitch detection uses **react-native-pitchy** (YIN). Melody playback
uses **expo-av** to sequence **pre-rendered note/chord audio samples** bundled as assets. **Local
SQLite is the source of truth** for sessions/attempts/progress (satisfying the offline-core-loop and
cross-session-persistence requirements), while **Supabase** is a best-effort, account-less, insert-only
sink for anonymous attempt logs. Distribution is via **EAS** — internal distribution on Android and
TestFlight/ad-hoc on iOS — to 10–15 testers. Per **Constitution Principle II (Test-First)**, all pure
logic — grading, note segmentation, pitch↔note math, and melody generation — is developed **test-first**
with unit and contract tests (Jest / `jest-expo`); native pitch-detection accuracy and audio fidelity are
additionally validated on real devices.

## Technical Context

**Language/Version**: TypeScript 5.x on React Native (Expo SDK 52+), targeting Hermes.

**Primary Dependencies**: Expo (custom dev client), `react-native-pitchy` (YIN monophonic pitch
detection), `expo-av` (audio playback of pre-rendered samples), `@supabase/supabase-js` (anonymous
attempt logging), `expo-sqlite` (local persistence, source of truth), `expo-router` (navigation),
`expo-asset`/`expo-file-system` (bundled sample assets). ESLint + Prettier + TypeScript `strict`.

**Storage**:
- **Local (source of truth)**: `expo-sqlite` for Sessions, Attempts, and derived Progress — works fully
  offline (FR-013, offline-core-loop assumption).
- **Remote (telemetry only)**: Supabase Postgres, single insert-only `attempt_log` table, no accounts,
  anonymous per-install device id, best-effort with an offline outbox queue.

**Testing**: **Jest** with the **`jest-expo`** preset + **React Native Testing Library**. Pure logic
(grading engine, frame segmentation, pitch↔note math, melody generator) is written **test-first** with
table-driven unit tests; each service boundary in `contracts/` has contract tests run against mocked
native modules (`react-native-pitchy`, `expo-av`, Supabase client) and recorded pitch-frame fixtures.
Native pitch-detection accuracy and audio fidelity — which cannot be unit-tested — are validated on real
devices via `quickstart.md`.

**Target Platform**: iOS 15+ (TestFlight / ad-hoc) and modern Android (EAS internal distribution).
Physical devices required (microphone + audio output).

**Project Type**: Mobile application (single Expo React Native project).

**Performance Goals**:
- Feedback rendered within **2 s** of the learner finishing playing (SC-003).
- Full listen→play→feedback cycle completable in **under 15 s** (SC-001).
- Pitch-detection frame latency low enough for responsive capture (target **< 100 ms** per analyzed
  frame; grading completes **< 500 ms** after the last detected note).
- Correct/incorrect verdict agrees with a human evaluator on **≥ 95%** of attempts under normal
  conditions (SC-002).
- 60 fps UI during playback and feedback.

**Constraints**:
- **Offline core loop**: generation, playback, capture, and grading MUST work with no network; Supabase
  logging is deferred to an outbox when offline.
- **Monophonic only**: single-note melodies matched to `react-native-pitchy`'s monophonic YIN output.
- **Guitar range**: generated notes stay within standard 6-string range (~E2–E6).
- **Note-match tolerance**: a note matches when detected pitch is the intended note within normal tuning
  deviation (±~40–50 cents), never a different semitone (FR-016).
- **Pre-rendered samples**: per-note (and chord) audio files are produced out-of-band and bundled as
  assets; playback sequences them at runtime.
- Microphone permission required; audio session configured so playback fully stops before capture
  begins (listen-then-play, not simultaneous).

**Scale/Scope**: 10–15 closed testers; single local learner per install; small data volume
(hundreds–thousands of attempts). ~6–8 screens/flows.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| **I. Code Quality & Maintainability** | ESLint + Prettier enforced in CI-equivalent local checks; TypeScript `strict`; single-responsibility services; no dead code | ✅ PASS — committed in Project Structure; tooling is a merge prerequisite |
| **II. Test-First & Comprehensive Coverage (NON-NEGOTIABLE)** | New behavior has failing tests first; contracts have tests | ✅ PASS — Jest/`jest-expo` + RNTL; pure logic (grading, segmentation, pitch↔note, generator) is test-first; each contract has boundary tests against mocked natives + frame fixtures. Native detector accuracy validated on-device (not unit-testable). |
| **III. User Experience Consistency** | Shared component library, consistent feedback/error patterns, accessibility baseline | ✅ PASS — `src/components/` is the single source for shared UX; unified feedback and error states; accessible controls planned |
| **IV. Performance by Design** | Measurable targets declared before implementation; evidence-driven optimization | ✅ PASS — targets declared above; pitch-detection latency and grading time are budgeted and will be measured on-device |

**Initial gate result**: PASS — no exceptions. All four principles are satisfied by the plan.

**Post-Design re-check**: Design keeps grading (`src/services/grading`), pitch↔note math (`src/lib`), and
melody generation (`src/services/melody`) as pure functions with explicit contracts, making them directly
unit-testable; native IO is isolated behind mockable service wrappers so boundaries are contract-tested.
No violations introduced by the design. ✅

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
│   ├── pitch-detection.md
│   ├── audio-playback.md
│   ├── melody-generator.md
│   ├── grading-engine.md
│   └── supabase-attempt-log.md
└── checklists/
    └── requirements.md
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
│   ├── controls/             # Play / Replay / Retry / Next buttons
│   └── common/               # Buttons, layout, accessible primitives
├── features/
│   ├── practice/             # US1 orchestration (state machine, hooks)
│   ├── difficulty/           # US2 adaptive + manual difficulty
│   └── progress/             # US3 aggregation + views
├── services/
│   ├── audio/
│   │   ├── playback.ts       # expo-av sample sequencing  → contracts/audio-playback.md
│   │   └── pitch.ts          # react-native-pitchy wrapper → contracts/pitch-detection.md
│   ├── melody/               # generator (pure)            → contracts/melody-generator.md
│   ├── grading/              # grading engine (pure)       → contracts/grading-engine.md
│   ├── storage/              # expo-sqlite repositories (source of truth)
│   └── logging/              # Supabase anonymous outbox    → contracts/supabase-attempt-log.md
├── models/                   # Entity types (data-model.md)
└── lib/                      # pitch↔note math, cents/tolerance, segmentation helpers (pure)

tests/                        # Jest (jest-expo) + React Native Testing Library
├── unit/                     # pure logic (grading, segmentation, pitch↔note, generator) — test-first
├── contract/                 # boundary tests vs mocked react-native-pitchy / expo-av / supabase
└── fixtures/                 # recorded pitch-frame arrays for deterministic grading tests

assets/
└── samples/                  # Pre-rendered note/chord audio files (bundled)

supabase/
└── migrations/               # attempt_log table + insert-only RLS policy

eas.json                      # development (dev-client) + internal/ad-hoc distribution profiles
app.config.ts                 # Expo config: mic permission, plugins, bundle ids
```

**Structure Decision**: Single Expo React Native app using `expo-router`. Code is organized by the three
user stories under `src/features/` for independent implementation, with cross-cutting capabilities
(`audio`, `melody`, `grading`, `storage`, `logging`) isolated as services behind the contracts in
`contracts/`. Pure logic (`melody`, `grading`, `lib`) is deliberately separated from native/IO
(`audio`, `storage`, `logging`) so it is directly unit-testable test-first, while native modules are
mocked at the service boundary for contract tests.

## Complexity Tracking

> **No Constitution gate deviations.** All four principles are satisfied by this plan; this section is
> intentionally empty.

An earlier draft of this plan deferred automated testing as a Principle II exception. That deviation was
**withdrawn**: Principle II is now satisfied by a test-first unit layer for all pure logic (grading,
segmentation, pitch↔note math, melody generator) plus contract tests at each service boundary. The only
behavior left to manual, on-device validation is native pitch-detection accuracy and audio fidelity,
which are inherently not unit-testable — not a deviation from the principle.
