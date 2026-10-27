# Phase 0 Research: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

This document resolves the technical unknowns implied by the chosen stack (React Native + Expo dev
client, react-native-pitchy/YIN, expo-audio with runtime tone synthesis, a self-hosted Node/Postgres
backend, EAS distribution) and
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

> **Superseded 2026-10-27**: the microphone and `react-native-pitchy` were removed (FR-020). Kept as the decision record.

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

> **Superseded 2026-10-27**: there is no pitch stream to segment (FR-004 withdrawn). Kept as the decision record.

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
- **Adaptive voicing gate (Tier 1 noise robustness, 2026-08-15)**: on-device testing showed a *fixed*
  clarity gate assumes a quiet room and a loud source — a noisy room either drops real notes or admits
  background as spurious notes, and a weak source in a quiet room falls under the gate. So the gate is now
  set **relative to the room**: per capture, estimate the ambient clarity floor (a low percentile of the
  frames — every capture is padded with ambient by its pre-onset lead-in and the ~2 s silent tail) and
  gate at `clamp(ambient + margin, hardMin, hardMax)`. With too few frames it falls back to the band
  midpoint, which equals the old fixed 0.5, so behavior degrades safely. Pure + unit-tested in
  `src/lib/noiseFloor.ts` (`tests/unit/lib/noiseFloor.test.ts`); margin/percentile/clamps are on-device
  calibration knobs. **Not** done here (needs native/UI, deferred): waveform DSP (band-pass / noise gate /
  AGC) — `react-native-pitchy` exposes per-frame pitch, not raw PCM, so those require a native change;
  a "play your quietest note" onboarding calibration; and adapting the capture-onset gate (streaming),
  which still uses a fixed threshold.

## R4. Pitch → note mapping and match tolerance

> **Partly superseded 2026-10-27**: matching is now by exact MIDI number (FR-016); the ±50-cent window applied to microphone pitch. Kept as the decision record.

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

> **Superseded 2026-10-27**: the tuning check was removed with the microphone (FR-014 withdrawn). Kept as the decision record.

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
  MIDI note on demand, so the melody library is not coupled to a rendered sample set and the app stays small.
  The synth (KS render + WAV encoding, in `src/services/audio/synth.ts`) is pure and fully
  unit-testable; only the cache write + `expo-audio` playback are native. `expo-audio` is the current,
  non-deprecated Expo audio API (it replaces `expo-av`).
- **Supersedes**: an earlier draft chose `expo-av` sequencing of one pre-rendered sample per note. That
  was replaced because bundling a sample for every note across E2–E6 added asset weight and coupled the
  melodies to the rendered set, whereas runtime synthesis removes both. Playback stays isolated behind
  `contracts/audio-playback.md`, so the swap did not ripple beyond the audio service.
- **Alternatives considered**: Pre-rendered samples + `expo-av` — rejected (asset weight, melody
  coupling, deprecated API). Pre-render each full melody — rejected, combinatorial asset explosion.

## R7. Audio session (playback then capture)

> **Partly superseded 2026-10-27**: only the playback half remains (`enterPlayback`); there is no capture stage. Kept as the decision record.

- **Decision**: Configure the audio session so melody playback completes and the output stream is torn
  down **before** starting microphone capture (sequential listen-then-play), and request/verify mic
  permission at session start.
- **Rationale**: The product loop is "listen, then play", so simultaneous full-duplex audio is
  unnecessary and avoiding it removes echo/feedback and platform audio-mode complexity.
- **Alternatives considered**: Simultaneous play+record — rejected, unneeeded and error-prone across iOS
  categories and Android audio focus.

## R8. Local persistence — expo-sqlite as the offline cache (durable history in Postgres)

- **Decision**: Use `expo-sqlite` as the **offline cache and the practice loop's authoritative local
  store** for Sessions, Attempts, and derived Progress. Repositories in `src/services/storage` expose
  typed CRUD; Progress (US3) is computed by queries/aggregation over the local rows. The durable,
  cross-device copy lives in the Node/Postgres backend (R9): the local RowStore documents are pushed up
  and pulled back via `/api/sync`, so Postgres is the long-term source of truth while the device keeps
  working fully offline.
- **Rationale**: Relational queries fit the accuracy-trend and weak-area aggregations; SQLite is offline,
  durable across app restarts (FR-013, interrupted-session edge case), and bundled with Expo. Keeping the
  loop reading local SQLite preserves the offline-core-loop constraint; syncing to Postgres adds
  durability without a network dependency in the hot path.
- **Alternatives considered**: AsyncStorage/MMKV key-value — rejected, awkward for aggregate queries.
  A remote DB as the *only* store (queried live in the loop) — rejected, violates the offline-core-loop
  constraint; instead the remote store is a sync target, not the runtime store.
- **History**: an earlier plan used **Supabase** for the remote side; it was replaced by the self-hosted
  Node/Postgres backend (see R9).

## R9. Node/Postgres backend — anonymous telemetry, waitlist, and game-history sync

- **Decision**: A self-hosted **Fastify + Drizzle + Postgres** service (`server/`) with a small HTTP API,
  no user accounts. It carries three things: (1) anonymous aggregate telemetry — `POST /api/attempts`
  inserts one row into an insert-only `attempt_log` table; (2) the landing waitlist — `POST /api/subscribe`
  into `signups` (dedup by `lower(email)`); (3) durable game-history sync — `POST/GET /api/sync` upserts
  the device's RowStore documents into `sync_documents` (keyed by `device_id, collection, doc_id`,
  last-write-wins on `updated_at`). Installs are identified by a locally generated random **anonymous
  device id** (no PII). Telemetry writes go through an **offline outbox**: attempts are logged locally
  first and flushed best-effort when online; the whole backend is optional (unset `EXPO_PUBLIC_API_URL`
  → the client no-ops and the app is fully offline).
- **Rationale**: Owning the backend removes the third-party dependency and lets telemetry, waitlist, and
  the new cross-device sync share one typed schema and one deploy, while preserving offline operation and
  storing no personal data beyond the waitlist email. Insert-only is enforced by API surface (there is no
  read/update/delete route for `attempt_log`), zod-validated at the edge.
- **Alternatives considered**: **Supabase** (anon key + insert-only RLS) — the original choice, **replaced**
  by this self-hosted service so telemetry and durable sync live together and there is no external vendor.
  A managed DB queried live in the practice loop — rejected (see R8: the loop reads local SQLite).
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

> **Superseded 2026-10-27**: the generator was removed; only the nine-rank note-count ladder remains (FR-010, FR-021). Kept as the decision record.

*Revised 2026-09-23. The first ladder (7 ranks, length only, C major C4–C5, one beat per note) produced
phrases that felt like mush: no rhythm to group notes, no repetition to hold on to, and every phrase the
same shape and key.*

- **Decision**: Generate top-down in layers — key (tonic + family per melody) → rhythm (cells of
  1 / ½+½ / 2 / 1½+½ beats, final note held 2 beats) → motif (from 6 notes: motif of ⌊n/2⌋ notes, then
  the same rhythm with the pitches repeated / shifted one scale degree / one note varied, closing on the
  tonic) → pitches (weighted walk: small intervals, chord tones on strong beats, gap-fill after leaps,
  arch contour). Candidates are generated and checked against hard constraints; a rejected one is redrawn
  from the same seeded stream. Difficulty is a 9-rank sawtooth through several dimensions:

  | Rank | Scales | Notes | Max leap | Span | Motif |
  |---|---|---|---|---|---|
  | 1 | major pentatonic | 3 | 3 | 5 | — |
  | 2 | major pentatonic | 4 | 5 | 7 | — |
  | 3 | major pentatonic | 6 | 5 | 7 | repeat |
  | 4 | major | 4 | 2 | 7 | — |
  | 5 | major | 6 | 4 | 9 | sequence |
  | 6 | major | 8 | 7 | 12 | sequence |
  | 7 | natural minor | 6 | 4 | 9 | repeat |
  | 8 | natural minor | 8 | 7 | 12 | variation |
  | 9 | major / natural minor | 10 | 12 | 14 | free |

- **Rationale**: Reproducing a phrase by ear is limited by vocabulary, interval size, memory load, and
  predictability, not by note count alone — 8 notes with a repeated motif are easier to hold than 6 free
  ones. The sawtooth keeps the diagnosability argument of the first design: within a stretch only one or
  two knobs move per rank, and a new vocabulary arrives with the load reduced.
- **Validation**: The ladder is a hypothesis. First-attempt success rate per rank (already in attempt
  telemetry) should fall smoothly; a cliff or a plateau between two ranks marks the step to retune.
- **Open**: consecutive repeated pitches stay banned until the segmenter splits re-plucked notes by onset
  (FR-004); rhythm is played but not graded.

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

## R14. Answer input for the MVP: on-screen fretboard (FR-020)

- **Decision**: The MVP answers on an **on-screen fretboard** — 6 strings (E-A-D-G-B-E) × 13 positions
  (open + frets 1–12, E2–E5) — instead of the microphone. A tap sounds the note (the existing runtime
  tone synthesis, R6, pre-rendered for all 37 pitches after the screen settles so a tap never stutters),
  adds it to the answer, and the learner presses **Check**. The mic pipeline (R2–R5) is **kept, not
  deleted**, behind `EXPO_PUBLIC_INPUT_MODE` (`fretboard` default, `mic` to restore it).
- **Rationale**: This is a scope cut to ship the MVP, not a change of product thesis. Grading is by pitch
  and order only, so the *input device* is the one piece that can be swapped without touching the grader.
  The microphone path carries the project's largest unresolved risk — on-device calibration, the segmenter
  onset/pitch work, mic warm-up delay and per-device variance (R2, R3, SC-002/T052–T053) — and none of
  that risk exists for a tap: no pitch noise, no capture window, no permission prompt, no low-confidence
  or timeout path, and it works with no instrument in hand. The learner still has to **find the melody by
  ear** and reproduce it, which is the training goal.
- **Design**: A tap is a `(string, fret)` position; grading uses its **MIDI pitch** (`fretMidi`), so the
  same sound on a different string is the same answer. `tapsToDetected` converts taps into `DetectedNote[]`
  — exact pitch, 0 cents, clarity 1, spacing from tap times — the exact shape the segmenter emits, so
  `gradeAttempt`, adaptation, persistence, sync and telemetry run **unchanged**. `tapStatuses` maps the
  grader's results back onto the taps for the result view. Pure logic lives in `src/lib/fretboard.ts`
  (unit-tested); the screen is `FretboardAnswer`, `Fretboard`, `FretboardControls`.
- **Consequences**: (1) a `fretboard` attempt is never `lowConfidence`/`timedOut`; FR-004/014/015/017 and the
  tuning advisory are `mic`-only. (2) Each attempt records `inputMode`, telemetry gains `input_mode`, and
  accuracy MUST NOT be pooled across modes — a tap is exact, so fretboard accuracy is not comparable to
  microphone accuracy and SC-002 is a `mic`-mode claim. (3) Fretboard play trains finding pitches on the
  neck by ear; it does not train **producing** them on a real instrument, which the `mic` mode restores.
  (4) The spec's original input — "reproduce it on a guitar" — is deferred, not dropped.
- **Neck length and melody source (revised 2026-10-11)**: the first neck had 16 positions (frets 1–15) to
  reach G5. The owner chose **12 frets** — a simpler neck, taller cells (the 44 pt target of SC-009 gets
  closer) and 12 is the octave landmark. Cost: the high e tops out at E5 (MIDI 76), so every melody is
  written to fit E2–E5. The owner decided melodies come from a **curated library** (FR-021) and, on
  2026-10-27, removed the melody generator from the codebase; the owner assembles the library himself.
- **Alternatives considered**: Shipping the mic path as-is — rejected for the MVP, it needs the on-device
  calibration spike (T052/T053) to finish first. Piano-keyboard or note-name buttons — rejected, they lose
  the string/fret geometry the target learner (guitarists) actually reads, and make a note a name rather
  than a place. Deleting the mic pipeline — rejected, it is the planned next phase and is tested. A
  runtime in-app toggle — rejected for now, a build flag keeps the MVP UI to one path.

---

## Resolved unknowns summary

All Technical Context items are resolved for design. The remaining **empirical tuning constants** —
pitch clarity threshold (R2), segmentation stability/gap thresholds (R3), cents match window (R4), and
tuning-offset threshold (R5) — are intentionally deferred to on-device calibration during the
feasibility spike and are exposed as named configuration so they can be adjusted without code changes.
None block Phase 1 design. These constants apply to `mic` input mode only; the MVP's default `fretboard`
mode (R14) needs none of them.
