# Phase 0 Research: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

This document resolves the technical unknowns implied by the chosen stack (React Native + Expo dev
client, react-native-pitchy/YIN, expo-av, Supabase, EAS distribution) and records the key algorithmic
decisions the plan depends on. Each item follows: **Decision → Rationale → Alternatives considered**.

---

## R1. App runtime: Expo custom dev client (not Expo Go)

- **Decision**: Ship a **custom Expo dev client** built with EAS; do not use Expo Go for development.
- **Rationale**: `react-native-pitchy` is a native module and cannot run in Expo Go. A dev client keeps
  the Expo DX (fast refresh, OTA of JS) while allowing arbitrary native modules and config plugins.
- **Alternatives considered**: *Expo Go* — rejected, no custom native modules. *Bare React Native* —
  rejected, loses Expo tooling and EAS convenience the team wants.

## R2. Monophonic pitch detection — react-native-pitchy (YIN)

- **Decision**: Use `react-native-pitchy` in continuous/streaming mode to receive `{ pitch (Hz),
  confidence/clarity }` frames from the microphone, at the library's supported frame rate. Treat frames
  below a clarity threshold, or outside the guitar band (~80–1320 Hz), as silence.
- **Rationale**: YIN is a well-proven monophonic pitch estimator suited to a single guitar note; it
  matches the monophonic-melody assumption. Confidence/clarity gating is the standard way to reject
  noise and unvoiced frames.
- **Open items to confirm on-device (feasibility spike)**: exact sample rate / buffer size / callback
  cadence, minimum stable-note duration, and clarity-threshold value that best separates a plucked note
  from string noise and decay. These are tuning constants, resolved empirically during the spike, not
  blockers to design.
- **Alternatives considered**: FFT/autocorrelation hand-roll — rejected, more work and YIN already
  handles octave errors better. Polyphonic detection (chords from playing) — out of scope (monophonic
  reproduction assumption).

## R3. Note onset & segmentation (turning a pitch stream into a note sequence)

- **Decision**: Segment the continuous pitch stream into discrete notes with a **stability + gap**
  heuristic: a note is emitted when clarity is high and the detected pitch stays within a tolerance band
  for a minimum duration; a new note starts on a pitch change beyond tolerance or after a silence gap.
  Each emitted note carries the median detected frequency over its stable window.
- **Rationale**: `react-native-pitchy` yields per-frame pitch, not note events. A stability-plus-gap
  segmenter is simple, deterministic, testable as a pure function over a frame array, and robust to the
  brief pitch instability at a pluck's attack.
- **Alternatives considered**: Energy/onset-only detection — rejected, weaker for legato/hammer-ons and
  needs raw audio access. Fixed time-slicing — rejected, ties detection to the target melody's tempo and
  breaks on hesitant playing (an explicit edge case).
- **Note**: This segmenter lives in `src/lib` as a pure function and is unit-tested (test-first) against
  recorded frame fixtures (Principle II).

## R4. Pitch → note mapping and match tolerance

- **Decision**: Convert frequency to the nearest note via `note = round(12·log2(f/440)) + 69` (MIDI),
  and compute cents deviation. A detected note **matches** a target note when it maps to the same MIDI
  note number and the cents deviation is within **±40–50 cents** (final value tuned in the spike);
  anything a semitone away is a non-match (FR-016). Octave is significant by default (assumption).
- **Rationale**: Equal-temperament math is exact and standard. A sub-semitone cents window tolerates
  normal tuning error without ever accepting the wrong note.
- **Alternatives considered**: Match on note name ignoring octave — rejected as default (spec assumption
  makes wrong octave incorrect; revisit as a later option). Fixed-Hz tolerance — rejected, not
  perceptually uniform across the range.

## R5. Tuning check (FR-014)

- **Decision**: Before/around grading, if detected notes show a **consistent** cents offset from their
  nearest notes across a short reference play, warn the learner and offer a reference tone (bundled
  sample) to retune. Provide a standard-tuning reference (E-A-D-G-B-E) using the same sample assets.
- **Rationale**: A systematic offset indicates an out-of-tune instrument rather than a wrong note;
  detecting it prevents unfair grading. Reuses existing sample playback, no extra dependency.
- **Alternatives considered**: A full chromatic tuner UI — deferred (more than the core loop needs now).

## R6. Melody playback — expo-av sequencing of pre-rendered samples

- **Decision**: Bundle one **pre-rendered audio sample per note** across the guitar range (plus chord
  samples where needed), and sequence them at runtime with `expo-av`, scheduling each note's start by
  the melody's tempo/durations. Preload sample objects for the active difficulty's note pool to avoid
  first-play latency.
- **Rationale**: Per-note samples give correct guitar timbre with a small asset set and let the
  generator compose arbitrary melodies without pre-rendering every phrase. Preloading avoids audible
  gaps.
- **Consideration / risk**: `expo-av` is on a deprecation path in favor of `expo-audio` in newer Expo
  SDKs. We follow the **explicit stack choice (expo-av)** for this phase; migrating to `expo-audio` is a
  low-risk follow-up because playback is isolated behind `contracts/audio-playback.md`.
- **Alternatives considered**: Pre-render each full melody — rejected, combinatorial asset explosion.
  Runtime synthesis (synth/oscillator) — rejected, worse timbre and more complexity than the phase needs.

## R7. Audio session (playback then capture)

- **Decision**: Configure the audio session so melody playback completes and the output stream is torn
  down **before** starting microphone capture (sequential listen-then-play), and request/verify mic
  permission at session start.
- **Rationale**: The product loop is "listen, then play", so simultaneous full-duplex audio is
  unnecessary and avoiding it removes echo/feedback and platform audio-mode complexity.
- **Alternatives considered**: Simultaneous play+record — rejected, unneeeded and error-prone across iOS
  categories and Android audio focus.

## R8. Local persistence — expo-sqlite as source of truth

- **Decision**: Use `expo-sqlite` as the offline source of truth for Sessions, Attempts, and derived
  Progress. Repositories in `src/services/storage` expose typed CRUD; Progress (US3) is computed by
  queries/aggregation over stored attempts.
- **Rationale**: Relational queries fit the accuracy-trend and weak-area aggregations; SQLite is offline,
  durable across app restarts (FR-013, interrupted-session edge case), and bundled with Expo.
- **Alternatives considered**: AsyncStorage/MMKV key-value — rejected, awkward for aggregate queries.
  Supabase as source of truth — rejected, violates the offline-core-loop constraint and the "no
  accounts / logging-only" scope for Supabase.

## R9. Supabase — anonymous, insert-only attempt logging

- **Decision**: A single `attempt_log` table; the app inserts anonymized attempt records using the
  Supabase **anon** key with an **insert-only Row Level Security policy** and **no user accounts**.
  Identify installs with a locally generated random **anonymous device id** (no PII). Writes go through
  an **offline outbox**: attempts are logged locally first and flushed to Supabase best-effort when
  online.
- **Rationale**: Matches the stated scope (Supabase only for logging attempts, no accounts) while
  preserving offline operation and avoiding any personal data.
- **Alternatives considered**: Supabase Auth anonymous sessions — rejected as heavier than needed;
  insert-only RLS with an anon device id is sufficient. Storing progress in Supabase — rejected (see R8).
- **Privacy note**: log only melody characteristics, verdict, per-note outcome summary, difficulty, app
  version, timestamp, and the anonymous device id — never audio or PII.

## R10. Distribution — EAS internal / TestFlight ad-hoc

- **Decision**: Define EAS build profiles: a `development` profile producing the dev client, and an
  internal-distribution profile for testers — **Android internal distribution** (direct install links)
  and **iOS TestFlight/ad-hoc** for 10–15 testers. Manage bundle identifiers and mic-permission strings
  in `app.config.ts`.
- **Rationale**: EAS is the Expo-native path to signed builds for both stores' closed-tester channels
  without full public release.
- **Alternatives considered**: Manual Xcode/Gradle signing — rejected, more setup than EAS. Public store
  release — rejected, premature for a 10–15 person feasibility test.

## R11. Melody generation parameters

- **Decision**: Generator takes a Difficulty Level (note count, pitch pool = scale + range, tempo) and
  produces a monophonic sequence within guitar range. Defaults: easiest = 2 notes from a small
  diatonic set at slow tempo; hardest (this phase) up to 8 notes across a wider range/faster tempo
  (SC-005). Adaptation nudges level after configurable win/loss streaks (US2).
- **Rationale**: Deterministic, pure, and directly parameterized by the Difficulty entity; easy to tune
  and unit-test (test-first).
- **Alternatives considered**: ML/generative melody models — rejected, unnecessary complexity for
  short ear-training phrases.

---

## Resolved unknowns summary

All Technical Context items are resolved for design. The remaining **empirical tuning constants** —
pitch clarity threshold (R2), segmentation stability/gap thresholds (R3), cents match window (R4), and
tuning-offset threshold (R5) — are intentionally deferred to on-device calibration during the
feasibility spike and are exposed as named configuration so they can be adjusted without code changes.
None block Phase 1 design.
