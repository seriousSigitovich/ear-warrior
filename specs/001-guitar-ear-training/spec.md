# Feature Specification: Guitar Ear Training — Melody Recall & Playback Feedback

**Feature Branch**: `001-guitar-ear-training`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Build an application that can help me improve my ears in terms of playing music. I want to build an ability to quickly recognise musical phrases and be able to reproduce it on a guitar. The main idea is to play right after the short generated melody and app should check for the correctness through the feedback."

## Clarifications

### Session 2026-07-22

- Q: Note-match tolerance — how close must a detected pitch be to count as the intended note? → A: Nearest-note within ±50 cents (a pitch that rounds to the target semitone matches; the adjacent semitone never matches; intonation inside that window is not itself graded).
- Q: How is the played sequence aligned to the target when a note is inserted or omitted? → A: Best-fit sequence alignment (edit-distance/LCS) — one extra note is flagged `extra`, one skipped note `missed`, and surrounding correct notes still count as `matched` (no cascade to `wrong`).
- Q: How are consecutive notes separated, especially same-pitch repeats? → A: Segment by pitch change or silence gap only; same-pitch re-attack detection is out of scope this phase, so generated melodies avoid consecutive identical pitches.
- Q: What happens when input is not cleanly monophonic (a chord or overlapping ringing strings)? → A: Treat it as low-confidence and prompt retry (do not grade); reuses the FR-017 low-confidence path.
- Q: When does an attempt end or time out? → A: Auto/silence-based — time out after ~8 s of no playing after the "your turn" cue; end a started attempt ~2 s after the last detected note (hands-free; values calibratable).

### Session 2026-07-23

- Q: How is attempt-level confidence derived and when is a capture flagged low-confidence? → A: Attempt confidence = the **minimum** per-note clarity (each note's clarity is the median frame clarity over its stable window); flag the attempt low-confidence and offer retry when that minimum falls below a calibratable threshold.
- Q: What rule triggers the "consistently out of tune" warning (FR-014)? → A: Warn when the **median signed cents offset** across the attempt's detected notes exceeds a calibratable magnitude (default ~35 cents) with at least a minimum count of notes (default 3) offset **mostly in the same direction** — a systematic offset, not a single sharp note. Magnitude and count are calibratable.
- Q: How is the end-of-attempt silence reconciled with hesitant pauses between notes? → A: Two distinct silence thresholds — a **short segmentation gap** (~150–300 ms) separates consecutive notes, while the **longer end-of-attempt gap** (~2 s) ends the attempt; any pause shorter than the end-of-attempt gap is still captured, so hesitant playing is not cut off. Both are calibratable.
- Q: After the out-of-tune warning, may the learner proceed to grading? → A: **Advisory** — the app shows the warning and offers a tuning reference before grading, but the learner may dismiss it and continue; grading still runs (it is not blocked until retuning).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listen, Play Back, Get Feedback (Priority: P1)

As a guitar learner, I want the app to play a short melody and then let me play it back on my
guitar so that the app can tell me immediately whether I reproduced it correctly. This is the core
practice loop: hear → recall → play → get graded.

**Why this priority**: This is the heart of the product and the minimum that delivers value. Without
this single loop working end-to-end, the app has no reason to exist. It is a complete, usable MVP on
its own: a learner can practice ear-to-instrument recall and improve, even with nothing else built.

**Independent Test**: Start a session, let the app play one generated melody, play it back on a
guitar, and confirm the app reports a correct/incorrect result identifying which notes matched. Fully
testable in isolation with no difficulty settings or history features present.

**Acceptance Scenarios**:

1. **Given** a session has started, **When** the app generates and plays a short melody, **Then** the
   app clearly signals when it is the learner's turn to play.
2. **Given** the melody has finished and it is the learner's turn, **When** the learner plays the same
   notes in the same order on the guitar, **Then** the app reports the attempt as correct.
3. **Given** it is the learner's turn, **When** the learner plays one or more wrong notes, **Then** the
   app reports the attempt as incorrect and indicates which notes were wrong, missed, or extra.
4. **Given** an attempt has been graded, **When** the learner chooses to replay the target melody,
   **Then** the app plays the same melody again unchanged.
5. **Given** an attempt has been graded, **When** the learner chooses to retry, **Then** the app lets
   the learner play the same melody again and grades the new attempt.
6. **Given** an attempt has been graded, **When** the learner chooses to continue, **Then** the app
   presents a new melody.

---

### User Story 2 - Adjustable & Adaptive Difficulty (Priority: P2)

As a learner, I want the difficulty of the melodies to match my ability — and to increase as I
improve — so that practice stays challenging but achievable.

**Why this priority**: Turns a single-loop demo into a sustainable training tool. It multiplies the
value of US1 but is not required for the app to be usable.

**Independent Test**: Choose or reach a difficulty level, then verify that generated melodies reflect
that level's note count, pitch range, and tempo, and that sustained success raises difficulty while
repeated failure lowers it.

**Acceptance Scenarios**:

1. **Given** a difficulty level is selected, **When** melodies are generated, **Then** their length,
   note pool, and tempo match that level's parameters.
2. **Given** the learner answers several melodies correctly in a row, **When** the next melody is
   generated, **Then** the difficulty increases (e.g., more notes, wider range, or faster tempo).
3. **Given** the learner fails several melodies in a row, **When** the next melody is generated,
   **Then** the difficulty decreases to a more achievable level.
4. **Given** the learner prefers manual control, **When** they set a fixed difficulty, **Then** the app
   keeps that level and does not auto-adjust.

---

### User Story 3 - Progress Tracking Over Time (Priority: P3)

As a learner, I want to see how my accuracy and speed improve across sessions so that I stay motivated
and know which kinds of phrases I still struggle with.

**Why this priority**: Drives retention and long-term improvement, but the app trains the ear
effectively without it. Depends on US1 producing gradable attempts.

**Independent Test**: Complete attempts across two or more sessions, then open the progress view and
confirm it shows accuracy trends, practice volume, and identified weak areas derived from real results.

**Acceptance Scenarios**:

1. **Given** the learner has completed attempts, **When** they open the progress view, **Then** they see
   overall accuracy and how it has changed over recent sessions.
2. **Given** multiple sessions of history exist, **When** the learner views their weak areas, **Then**
   the app highlights the melody characteristics (e.g., specific intervals or lengths) most often missed.
3. **Given** the learner finishes a session, **When** the session ends, **Then** a summary of that
   session's accuracy and number of melodies attempted is recorded and viewable later.

---

### Edge Cases

- **No input / silence**: The learner does not start playing within ~8 seconds of the "your turn" cue →
  the app times out gracefully and prompts to replay or retry rather than grading an empty attempt.
- **Guitar out of tune**: Detected pitches deviate consistently from any expected note → the app warns
  the learner and offers a tuning reference before grading continues.
- **Wrong count**: The learner plays fewer or more notes than the target → the app reports missed and/or
  extra notes rather than silently truncating.
- **Wrong octave**: The learner plays the correct note names in a different octave than intended → treated
  as incorrect by default (with a clear indication it was an octave mismatch).
- **Ambiguous / noisy input**: Background noise or overlapping ringing strings makes a note hard to
  identify → the app flags low confidence and lets the learner retry rather than penalizing on a
  misread.
- **Hesitant playing**: Long pauses between notes during an attempt → the app still captures the full
  sequence rather than ending the attempt prematurely.
- **Interrupted session**: The app is closed or loses focus mid-session → in-progress and completed
  attempt results are not lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate short monophonic melodic phrases with a configurable number of notes
  drawn from a defined pitch pool (scale/key and range). The generator's pitch pool MUST fall within the
  standard guitar range **E2–E6 (MIDI 40–88)**; each difficulty level selects a low/high bound inside
  that range. Generated phrases MUST NOT place two identical pitches consecutively, so every note is
  separable by a pitch change (see FR-004).
- **FR-002**: System MUST play the generated melody audibly to the learner.
- **FR-003**: System MUST clearly signal the transition from "listening" to "your turn to play".
- **FR-004**: System MUST capture the learner's guitar performance and derive the ordered sequence of
  notes played by segmenting the pitch stream at **pitch changes and silence gaps**. A **short
  segmentation gap** (default ~150–300 ms, calibratable) separates two consecutive notes; this is
  distinct from and shorter than the end-of-attempt gap (FR-015), so inter-note pauses do not end the
  attempt. Detecting a re-articulated same-pitch note is out of scope this phase; consequently generated
  melodies contain no consecutive identical pitches (see FR-001).
- **FR-005**: System MUST compare the played sequence against the target melody using **best-fit sequence
  alignment** (edit-distance / longest-common-subsequence), so that a single inserted note is flagged
  `extra` and a single skipped note `missed` **without** cascading the surrounding correct notes to
  `wrong`. From that alignment it MUST determine per-note results (matched, wrong, missed, extra) and an
  overall correct/incorrect verdict.
- **FR-006**: System MUST present feedback immediately after the attempt, showing the overall verdict and
  which notes were matched, wrong, missed, or extra.
- **FR-007**: Learners MUST be able to replay the target melody, both before attempting and after
  receiving feedback, without altering the melody.
- **FR-008**: Learners MUST be able to retry the same melody and receive a fresh grading.
- **FR-009**: Learners MUST be able to advance to a new generated melody.
- **FR-010**: System MUST support multiple difficulty levels that vary melody length, pitch range/scale,
  and tempo.
- **FR-011**: System MUST adapt difficulty based on recent performance, and MUST also allow the learner to
  fix difficulty manually.
- **FR-012**: System MUST record each attempt's result (verdict, per-note outcome, timestamp) within a
  session.
- **FR-013**: System MUST persist results across sessions and present accuracy trends, practice volume,
  and identified weak areas over time.
- **FR-014**: System MUST provide a pitch/tuning reference and MUST detect and warn when the guitar
  appears consistently out of tune before grading. "Consistently out of tune" MUST be evaluated as: the
  **median signed cents offset** across the attempt's detected notes exceeds a calibratable magnitude
  (default ~35 cents) with at least a minimum note count (default 3) offset **mostly in the same
  direction** — a systematic offset, not a single sharp/flat note. The warning is **advisory**: the app
  shows it and offers the tuning reference before grading, but the learner MAY dismiss it and continue;
  grading is NOT blocked pending a retune.
- **FR-015**: System MUST detect the end of input by silence — timing out with a replay/retry prompt
  after **~8 seconds** of no playing following the "your turn" cue, and ending a started attempt
  **~2 seconds** after the last detected note — rather than grading an empty attempt. This end-of-attempt
  gap MUST be longer than the inter-note segmentation gap (FR-004): any pause shorter than the
  end-of-attempt gap is captured as part of the attempt, so hesitant playing is not cut off. These timing
  values are calibratable.
- **FR-016**: System MUST count a played note as matched when its detected pitch rounds to the target
  note within **±50 cents** (nearest-note quantization), where frequency-to-note mapping uses **concert
  pitch A4 = 440 Hz** as the reference; a pitch closer to an adjacent semitone MUST NOT match. Intonation
  within that ±50-cent window is not itself graded (this is ear training, not a tuner).
- **FR-017**: System MUST flag low-confidence note detections — including background noise and
  **non-monophonic input** (a chord or overlapping ringing strings) — and prompt the learner to retry
  rather than grading an unreliable capture. Attempt-level confidence MUST be derived as the **minimum**
  per-note clarity across the attempt (each note's clarity being the median frame clarity over its stable
  window); the attempt is flagged low-confidence when that minimum falls below a calibratable threshold.
- **FR-018**: Learners MUST be able to start, pause, and end a practice session, and completed results
  MUST survive interruptions.

### Key Entities *(include if feature involves data)*

- **Melody (Phrase)**: An ordered sequence of notes that the learner must reproduce; carries its
  difficulty level and the scale/key and range it was drawn from.
- **Note**: A single pitch within a melody or an attempt, with its position in the sequence; the unit of
  comparison for grading.
- **Attempt**: One captured performance of a melody by the learner, with the derived note sequence, the
  per-note comparison outcome, the overall verdict, and a timestamp.
- **Session**: A continuous practice run containing multiple attempts, the difficulty settings in effect,
  and summary statistics.
- **Progress Profile**: Aggregated results across sessions for the single learner, including accuracy
  trends, difficulty reached, practice volume, and weak areas.
- **Difficulty Level**: A named configuration defining melody length, pitch pool (scale/range), and tempo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can complete one full listen → play → feedback cycle in under 15 seconds when
  ready to play.
- **SC-002**: Under normal conditions (reasonably quiet room, in-tune guitar), the app's correct/incorrect
  verdict agrees with a human evaluator on at least 95% of attempts.
- **SC-003**: Feedback for an attempt appears within 2 seconds of the learner finishing playing.
- **SC-004**: A first-time learner can start a session, complete an attempt, and understand the feedback
  within 2 minutes without external instructions.
- **SC-005**: The app supports melodies ranging from at least 2 notes at the easiest level up to at least
  8 notes at higher levels.
- **SC-006**: After two weeks of regular practice (e.g., 4+ sessions per week), a returning learner shows
  a measurable improvement in recognition accuracy of at least 25% over their first-session baseline.
- **SC-007**: At least 90% of learners report the feedback clearly tells them which notes they got wrong.

## Assumptions

- **Single learner, one guitar**: The app serves one learner at a time on a standard 6-string guitar in
  standard tuning (E-A-D-G-B-E). No multi-user accounts are required for the initial version; progress is
  stored for that single learner.
- **Monophonic melodies**: Generated phrases are single-note sequences (no chords), matching typical ear-
  training and single-note guitar reproduction.
- **Pitch-first grading**: Correctness is judged on the sequence of pitches (right notes, right order).
  Rhythmic/timing accuracy is out of scope for the initial version and may be added later as a separate
  graded dimension.
- **Audio capture**: The learner's playing is captured through the device's microphone (acoustic sound or
  amplified guitar) in a reasonably quiet environment; specialized hardware (e.g., MIDI pickups) is not
  required.
- **Guitar-playable range**: Generated melodies fall within the standard guitar pitch range **E2–E6
  (MIDI 40–88)** so every target note is physically reproducible; pitch detection guards against
  frequencies outside this band (~80–1320 Hz).
- **Reference tuning**: Detected frequencies are interpreted as notes relative to **concert pitch
  A4 = 440 Hz** (equal temperament).
- **Octave sensitivity**: By default, a correct note name played in the wrong octave is treated as
  incorrect; octave-tolerant matching may become a later option.
- **Offline core loop**: Melody generation, playback, capture, and grading work without network
  connectivity; any progress data is stored on the learner's device.
- **Audible output available**: The device can play the melody through a speaker or headphones and has a
  microphone available to the app.
