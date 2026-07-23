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
- Q: What may leave the device — microphone audio and the remote-telemetry data-handling boundary? → A: Raw and derived audio (pitch frames) **never leave the device**; only **anonymized attempt metadata** (verdict, per-note outcome, difficulty level, timestamps, and an anonymous per-install device id) may be sent to remote telemetry — no PII, no accounts, best-effort and non-blocking.
- Q: What is the accessibility baseline for the mobile UI (Constitution III)? → A: **WCAG 2.1 AA, mobile-adapted** — all interactive controls carry accessible labels/roles, text contrast ≥ 4.5:1, the UI is fully operable via VoiceOver/TalkBack, touch targets are ≥ 44pt (iOS) / 48dp (Android), and the UI respects OS font-scaling.
- Q: Which difficulty dimensions vary across levels (FR-010)? → A: **Melody length only.** The ladder is exactly **7 levels (rank 1–7) whose `noteCount` runs 2→8**; the pitch pool (scale + range) and tempo are **identical at every level** and do not vary. Range/scale/tempo variation is explicitly deferred to a later phase.
- Q: What is the single fixed pitch pool and tempo shared by all levels? → A: **C major (diatonic), C4–C5 (MIDI 60–72), 60 BPM.** That window yields 8 distinct pitches (C D E F G A B C), enough for an 8-note melody under the no-consecutive-repeats rule. Confining the pool to **one octave** means a correct note name is never available in a wrong octave, so the default octave-sensitive matching cannot produce octave-mismatch failures in this phase.
- Q: What thresholds raise or lower difficulty in adaptive mode (FR-011)? → A: **Streak-based and asymmetric — 3 consecutive correct attempts raise the level by one rank; 2 consecutive incorrect attempts lower it by one rank.** Steps are always ±1 rank, the streak counter resets to zero on any level change, and the level clamps at rank 1 and rank 7 (a learner already at the boundary simply stays there).
- Q: How do the difficulty mode and level behave across mode switches and app restarts? → A: **Separate persisted state.** The adaptive rank and the manually selected fixed level are **two independent values**; switching adaptive → fixed → adaptive resumes adaptive at the rank it held, unaffected by the fixed selection. The mode and both level values persist across sessions and app restarts. Fixed mode may select **any** of the 7 levels — there is no unlock gating.
- Q: Which attempt outcomes feed the adaptation streak? → A: **Only the first graded attempt on each newly generated melody.** Retries of the same melody (FR-008), low-confidence ungraded captures (FR-017), and no-input timeouts (FR-015) are **excluded entirely** — they neither extend nor break the streak, leaving it unchanged. An attempt graded after the learner dismissed the out-of-tune advisory (FR-014) counts normally. Rationale: the streak measures first-hearing recall, retries are unlimited and would otherwise let a learner grind one melody into a promotion, and counting ungraded captures would demote a learner for room noise rather than for ability.

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

**Independent Test**: Choose or reach a difficulty rank, then verify that generated melodies contain
exactly that rank's note count, and that 3 consecutive correct first attempts raise the rank by one while
2 consecutive incorrect first attempts lower it by one.

**Acceptance Scenarios**:

1. **Given** difficulty rank *r* is in effect, **When** a melody is generated, **Then** it contains exactly
   `r + 1` notes drawn from the fixed C major C4–C5 pool at 60 BPM.
2. **Given** the learner's first graded attempt is correct on **3 consecutive** new melodies, **When** the
   next melody is generated, **Then** the rank has increased by exactly 1 and the melody contains one more
   note than the previous one.
3. **Given** the learner's first graded attempt is incorrect on **2 consecutive** new melodies, **When** the
   next melody is generated, **Then** the rank has decreased by exactly 1 and the melody contains one fewer
   note than the previous one.
4. **Given** the learner prefers manual control, **When** they set a fixed difficulty, **Then** the app
   keeps that level and does not auto-adjust.
5. **Given** the learner is at adaptive rank 5, **When** they switch to fixed rank 2 and later switch back
   to adaptive, **Then** adaptive resumes at rank 5.
6. **Given** an attempt is a retry, a low-confidence ungraded capture, or a no-input timeout, **When** that
   attempt ends, **Then** the streak counter is unchanged and the rank does not move.
7. **Given** the learner is at rank 7, **When** they answer 3 more melodies correctly, **Then** the rank
   remains 7.

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
  drawn from a defined pitch pool (scale/key and range). For this phase the pitch pool is a single fixed
  pool shared by every difficulty level: **C major (diatonic), C4–C5 (MIDI 60–72)** — the 8 pitches
  C4 D4 E4 F4 G4 A4 B4 C5. It sits inside the standard guitar range **E2–E6 (MIDI 40–88)**, and being
  confined to one octave it contains no duplicate note names, so octave-mismatch outcomes cannot arise
  from generated targets. Generated phrases MUST NOT place two identical pitches consecutively, so every note is
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
- **FR-010**: System MUST support exactly **7 difficulty levels (rank 1–7)** that vary **melody length
  only**: level rank *r* generates melodies of `noteCount = r + 1`, giving 2 notes at rank 1 up to 8 notes
  at rank 7. Every level MUST share the single fixed pitch pool defined in FR-001 (**C major, C4–C5**) and
  a fixed playback tempo of **60 BPM**. Varying pitch range, scale, or tempo across levels is explicitly
  **out of scope for this phase**.
- **FR-011**: System MUST adapt difficulty from recent performance using an **asymmetric consecutive-streak
  rule**: **3 consecutive correct** attempts raise the level by **one rank**; **2 consecutive incorrect**
  attempts lower it by **one rank**. Adjustments are always ±1 rank — never a multi-rank jump. The streak
  counter MUST reset to zero whenever the level changes, so a fresh streak is required before the next
  adjustment. The level MUST clamp at rank 1 and rank 7: further success at rank 7 or failure at rank 1
  leaves the level unchanged. The system MUST also allow the learner to fix difficulty manually, in which
  case no automatic adjustment occurs.
- **FR-011a**: Only the **first graded attempt on each newly generated melody** MUST feed the adaptation
  streak. Retries of the same melody (FR-008), low-confidence ungraded captures (FR-017), and no-input
  timeouts (FR-015) MUST be **excluded** — they neither extend nor break the streak and MUST leave the
  counter unchanged. An attempt graded after the learner dismissed the out-of-tune advisory (FR-014)
  MUST count normally. Excluded attempts MUST still be recorded per FR-012 and still contribute to
  progress statistics (FR-013); the exclusion applies to difficulty adaptation only.
- **FR-011b**: The difficulty mode (adaptive or fixed), the **adaptive rank**, and the **manually selected
  fixed level** MUST be persisted independently and MUST survive session end and app restart. Selecting a
  fixed level MUST NOT overwrite the adaptive rank: returning to adaptive mode resumes at the rank adaptive
  mode last held. Fixed mode MUST allow selecting any of the 7 levels; levels are not gated behind prior
  progress.
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
- **FR-019**: System MUST keep captured microphone audio — both raw audio and derived pitch frames — on
  the device and MUST NOT transmit it off-device. Any remote telemetry MUST be limited to **anonymized
  attempt metadata** (overall verdict, per-note outcome, difficulty level, timestamps, and an anonymous
  per-install device id), MUST contain no personally identifying information, and MUST require no user
  account. Remote logging is best-effort and non-blocking; the core loop functions fully offline (see the
  offline-core-loop assumption).

### Key Entities *(include if feature involves data)*

- **Melody (Phrase)**: An ordered sequence of notes that the learner must reproduce; carries its
  difficulty level and the scale/key and range it was drawn from.
- **Note**: A single pitch within a melody or an attempt, with its position in the sequence; the unit of
  comparison for grading.
- **Attempt**: One captured performance of a melody by the learner, with the derived note sequence, the
  per-note comparison outcome, the overall verdict, and a timestamp.
- **Session**: A continuous practice run containing multiple attempts, the difficulty settings in effect,
  and summary statistics.
- **Difficulty Settings**: The learner's persisted difficulty state — the **mode** (adaptive or fixed), the
  **adaptive rank**, the **fixed level selection**, and the current **consecutive-streak counter**. The two
  level values are independent and both survive app restart (FR-011b).
- **Progress Profile**: Aggregated results across sessions for the single learner, including accuracy
  trends, difficulty reached, practice volume, and weak areas.
- **Difficulty Level**: One of 7 ranked configurations that differ **only** in melody length
  (`noteCount` = rank + 1, so 2–8 notes). Pitch pool and tempo are the same constants at every rank.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can complete one full listen → play → feedback cycle in under 15 seconds when
  ready to play.
- **SC-002**: Under normal conditions (reasonably quiet room, in-tune guitar), the app's correct/incorrect
  verdict agrees with a human evaluator on at least 95% of attempts.
- **SC-003**: Feedback for an attempt appears within 2 seconds of the learner finishing playing.
- **SC-004**: A first-time learner can start a session, complete an attempt, and understand the feedback
  within 2 minutes without external instructions.
- **SC-005**: The app offers exactly 7 difficulty ranks whose melodies run from **2 notes at rank 1 to
  8 notes at rank 7**, one note added per rank.
- **SC-006**: After two weeks of regular practice (e.g., 4+ sessions per week), a returning learner shows
  a measurable improvement in recognition accuracy of at least 25% over their first-session baseline.
- **SC-007**: At least 90% of learners report the feedback clearly tells them which notes they got wrong.
- **SC-008**: No microphone audio or PII is ever transmitted off-device; inspection of all outbound
  network traffic shows only the anonymized attempt-metadata payload defined in FR-019, and the full
  listen → play → feedback loop completes with networking disabled.
- **SC-009**: The UI meets a **WCAG 2.1 AA, mobile-adapted** baseline — every interactive control exposes
  an accessible label/role, text contrast is ≥ 4.5:1, all core flows are operable end-to-end with
  VoiceOver and TalkBack, touch targets are ≥ 44pt (iOS) / 48dp (Android), and layouts remain usable at
  the OS's largest standard font-scaling setting.

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
