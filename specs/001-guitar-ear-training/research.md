# Phase 0 Research: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

This document resolves the technical unknowns implied by the chosen stack (React Native + Expo dev
client, react-native-pitchy/YIN, expo-audio with runtime tone synthesis, Supabase, EAS distribution) and
records the key algorithmic decisions the plan depends on. Each item follows: **Decision → Rationale →
Alternatives considered**.

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
- **Installed API (react-native-pitchy 1.3.1)**: the streaming event is `{ pitch, confidence, volume,
  tCaptureMs }`. Map `confidence` → the frame's `clarity`, treat `pitch <= 0` as unvoiced, and stamp
  frames with `tCaptureMs` (the sample's true capture-clock time, immune to bridge backlog) rather than
  receipt-time `Date.now()`. `init()` is synchronous and takes a library config (`minVolume` in dBFS,
  `algorithm`, `minConfidence`); the app owns mic permission via the audio session, not pitchy.
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
  note number, i.e. within **±50 cents** (nearest-note quantization — fixed per the FR-016 clarification,
  no longer tuned on-device); anything closer to an adjacent semitone is a non-match. Octave is
  significant by default (assumption).
- **Rationale**: Equal-temperament math is exact and standard. A sub-semitone cents window tolerates
  normal tuning error without ever accepting the wrong note.
- **Alternatives considered**: Match on note name ignoring octave — rejected as default (spec assumption
  makes wrong octave incorrect; revisit as a later option). Fixed-Hz tolerance — rejected, not
  perceptually uniform across the range.

## R5. Tuning check (FR-014)

- **Decision**: Before/around grading, if detected notes show a **consistent** cents offset from their
  nearest notes across a short reference play, warn the learner and offer a reference tone (synthesized on
  the fly) to retune. Provide a standard-tuning reference (E-A-D-G-B-E) using the same runtime synthesis.
- **Rationale**: A systematic offset indicates an out-of-tune instrument rather than a wrong note;
  detecting it prevents unfair grading. Reuses the existing tone playback, no extra dependency.
- **Alternatives considered**: A full chromatic tuner UI — deferred (more than the core loop needs now).

## R6. Melody playback — expo-audio playing runtime-synthesized tones

- **Decision**: Synthesize a **plucked-string tone (Karplus–Strong)** for each MIDI note at runtime,
  encode it as a 16-bit mono WAV, cache it in the app's cache directory (`expo-file-system`), and play it
  with **expo-audio**, scheduling each note's start by the melody's tempo/durations. Pre-generate
  (preload) the active difficulty's note pool so the first note starts without a synthesis hitch.
- **Rationale**: Runtime synthesis needs **no bundled audio assets** and can produce **any** in-range
  MIDI note on demand, so the generator is not coupled to a rendered sample set and the app stays small.
  The synth (KS render + WAV encoding, in `src/services/audio/synth.ts`) is pure and fully
  unit-testable; only the cache write + `expo-audio` playback are native. `expo-audio` is the current,
  non-deprecated Expo audio API (it replaces `expo-av`).
- **Supersedes**: an earlier draft chose `expo-av` sequencing of one pre-rendered sample per note. That
  was replaced because bundling a sample for every note across E2–E6 added asset weight and coupled the
  generator to the rendered set, whereas runtime synthesis removes both. Playback stays isolated behind
  `contracts/audio-playback.md`, so the swap did not ripple beyond the audio service.
- **Alternatives considered**: Pre-rendered samples + `expo-av` — rejected (asset weight, generator
  coupling, deprecated API). Pre-render each full melody — rejected, combinatorial asset explosion.

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
- **Privacy note (codified as FR-019; verified by SC-008)**: captured microphone audio and derived pitch
  frames never leave the device. Remote telemetry logs only melody characteristics, verdict, per-note
  outcome summary, difficulty, app version, timestamp, and the anonymous device id — never audio, raw
  frames, note-by-note pitches, location, or PII.

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

- **Decision**: Generator takes a Difficulty Level and produces a monophonic sequence. Per the 2026-07-23
  clarifications, levels differ in **melody length only**: 7 ranks with `noteCount = rank + 1` (2→8 notes,
  SC-005). All ranks share one **fixed pitch pool — C major diatonic, C4–C5 (MIDI 60–72)** — and a fixed
  **60 BPM** tempo (FR-001, FR-010).
- **Rationale**: A single varying dimension makes the difficulty curve diagnosable — when a learner starts
  failing, length is the only variable that changed. The one-octave pool is deliberate: it contains no
  duplicate note names, so the default octave-sensitive matching cannot produce octave-mismatch failures
  from generated targets. Its 8 distinct pitches (C D E F G A B C) also comfortably satisfy the
  no-consecutive-repeats rule at the 8-note top rank.
- **Alternatives considered**: Advancing range/scale/tempo together — rejected, confounds the difficulty
  signal and makes adaptation coarse. Staged advancement (length, then range, then scale) — deferred to a
  later phase as unnecessary for the first ladder. Varying tempo — rejected outright: rhythm is not graded
  (pitch-first grading), so tempo changes memorization load without changing what is measured. ML/generative
  melody models — rejected, unnecessary complexity for short ear-training phrases.

## R12. Accessibility baseline (SC-009)

- **Decision**: Target **WCAG 2.1 AA, mobile-adapted**: every interactive control exposes an accessible
  label + role; text/icon contrast is ≥ 4.5:1 against the Nocturne dark ground; all core flows are
  operable end-to-end with **VoiceOver** (iOS) and **TalkBack** (Android); touch targets are ≥ 44pt /
  48dp; layouts remain usable at the OS's largest standard font scale. Shared primitives in
  `src/components/common` carry the labels/roles so every screen inherits them (Principle III).
- **Rationale**: The constitution mandates a *stated* accessibility baseline; WCAG 2.1 AA is the
  standard, objectively testable bar, and the mobile analog of "keyboard operability" is screen-reader
  operability. Centralizing accessibility in shared components keeps it consistent as surface area grows.
- **Alternatives considered**: The constitution's literal minimum (labels + contrast only) — rejected,
  leaves screen-reader operability unverified. WCAG AAA (≥ 7:1 contrast) — deferred as stricter than a
  closed-tester build needs.
- **Note**: Contrast, label/role, and target-size checks are validated in the T051 accessibility pass and
  a VoiceOver/TalkBack walkthrough in `quickstart.md`.

## R13. Difficulty adaptation rule (US2, FR-011/011a/011b)

- **Decision**: **Asymmetric consecutive-streak** adaptation. 3 consecutive correct → rank +1; 2
  consecutive incorrect → rank −1; steps are always ±1; the streak counter resets to 0 on any rank change;
  the rank clamps at 1 and 7. Only the **first graded attempt on each newly generated melody** feeds the
  streak — retries (FR-008), low-confidence ungraded captures (FR-017), and no-input timeouts (FR-015) are
  excluded and leave the counter untouched. Mode (`adaptive`/`fixed`), the adaptive rank, and the fixed
  selection are **three independently persisted values** surviving app restart.
- **Rationale**: Streaks are trivially explainable in the UI and directly unit-testable as a pure
  reducer, unlike a rolling accuracy window which needs history and is harder to justify to a learner.
  The asymmetry (slower to promote than to demote) drops a learner out of a too-hard rank quickly while
  requiring real evidence to advance. Excluding ungraded captures is the critical choice: counting them
  would demote a learner for room noise rather than for ability, and since retries are unlimited,
  counting retries would let a learner grind one melody into a promotion. Separating the adaptive rank
  from the fixed selection means dipping into fixed mode for a warm-up does not erase adaptive progress.
- **Alternatives considered**: Symmetric 3/3 thresholds — rejected, three consecutive failures at a
  too-hard rank is three consecutive discouraging minutes. Rolling 5-attempt accuracy window (≥80% up,
  ≤40% down) — rejected, needs persisted history and explains poorly. Treating a retry as an admission
  of failure — rejected, it punishes the learner for wanting to practice. A single shared level for both
  modes — rejected, a brief fixed-mode excursion would silently reset adaptive progress.
- **Note**: The counter reset on rank change supplies the hysteresis that prevents raise/lower thrashing —
  after any adjustment a fresh full streak is required before the next one.

---

## Resolved unknowns summary

All Technical Context items are resolved for design. The remaining **empirical tuning constants** —
pitch clarity threshold (R2), segmentation stability/gap thresholds (R3), cents match window (R4), and
tuning-offset threshold (R5) — are intentionally deferred to on-device calibration during the
feasibility spike and are exposed as named configuration so they can be adjusted without code changes.
None block Phase 1 design.
