# Feature Specification: Guitar Ear Training — Melody Recall & Playback Feedback

**Feature Branch**: `001-guitar-ear-training`

**Created**: 2026-07-22

**Status**: MVP built (fretboard input, curated melodies); SC-009 accessibility open. **Last updated**: 2026-10-27

**Input**: User description: "Build an application that can help me improve my ears in terms of playing music. I want to build an ability to quickly recognise musical phrases and be able to reproduce it on a guitar. The main idea is to play right after the short generated melody and app should check for the correctness through the feedback."

## Clarifications

### Session 2026-07-22

> **History.** The answers below that concern microphone capture — segmentation, low-confidence gating, end-of-attempt silence, the out-of-tune advisory, audio staying on the device — and the 7-level ladder were **superseded on 2026-10-27** (FR-004, FR-014, FR-015, FR-017 withdrawn; FR-010 is nine levels). They are kept as the decision record, not as current requirements.

- Q: Does the `mic` input mode return? → A: **No (owner, 2026-10-27): the microphone and all sound recognition were removed.** `react-native-pitchy`, the pitch detector, capture window, segmenter, noise-floor calibration, tuning check, microphone permission and the `EXPO_PUBLIC_INPUT_MODE` flag are deleted; the app declares no microphone permission on either platform. The requirements that described that pipeline (FR-004, FR-014, FR-015, FR-017, SC-002, SC-002a) are **withdrawn**, not deferred. `InputMode` keeps the value `mic` only so attempts recorded earlier still read back correctly (FR-020, R14).
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
- Q: Which difficulty dimensions vary across levels (FR-010)? → A: **Melody length only.** The ladder is exactly **7 levels (rank 1–7) whose `noteCount` runs 2→8**; the pitch pool (scale + range) and tempo are **identical at every level** and do not vary. Range/scale/tempo variation is explicitly deferred to a later phase. *(Superseded 2026-09-23: 9 multi-dimensional levels — see FR-010, R11.)*
- Q: What is the single fixed pitch pool and tempo shared by all levels? → A: **C major (diatonic), C4–C5 (MIDI 60–72), 60 BPM.** That window yields 8 distinct pitches (C D E F G A B C), enough for an 8-note melody under the no-consecutive-repeats rule. Confining the pool to **one octave** means a correct note name is never available in a wrong octave, so the default octave-sensitive matching cannot produce octave-mismatch failures in this phase. *(Superseded 2026-09-23: per-melody key in E3–G5 — see FR-001.)*
- Q: What thresholds raise or lower difficulty in adaptive mode (FR-011)? → A: **Streak-based and asymmetric — 3 consecutive correct attempts raise the level by one rank; 2 consecutive incorrect attempts lower it by one rank.** Steps are always ±1 rank, the streak counter resets to zero on any level change, and the level clamps at rank 1 and the top rank (a learner already at the boundary simply stays there). *(Top rank is 9 since 2026-09-23 — see FR-010, R11.)*
- Q: How do the difficulty mode and level behave across mode switches and app restarts? → A: **Separate persisted state.** The adaptive rank and the manually selected fixed level are **two independent values**; switching adaptive → fixed → adaptive resumes adaptive at the rank it held, unaffected by the fixed selection. The mode and both level values persist across sessions and app restarts. Fixed mode may select **any** of the 9 levels — there is no unlock gating.
- Q: Which attempt outcomes feed the adaptation streak? → A: **Only the first graded attempt on each newly presented melody.** Retries of the same melody (FR-008) are **excluded entirely** — they neither extend nor break the streak, leaving it unchanged. Rationale: the streak measures first-hearing recall, and retries are unlimited and would otherwise let a learner grind one melody into a promotion. *(The microphone-era exclusions — low-confidence captures and no-input timeouts — went away with the microphone, 2026-10-27.)*

### Session 2026-10-11 — MVP scope simplification

- Q: How does the learner give an answer in the MVP? → A: **On an on-screen fretboard, not the microphone.** The learner taps the notes on a 6-string × 13-position neck (open + frets 1–12, standard tuning, E2–E5), hears each tapped note, and presses **Check**. This is the only input mode. Introduced as **FR-020**; recorded as **R14**. *(Simplifies the "play it on a guitar" input of the original feature description; the training goal — reproduce a heard melody by ear — is unchanged. The microphone pipeline that this answer first kept behind `EXPO_PUBLIC_INPUT_MODE=mic` was deleted on 2026-10-27.)*
- Q: What is graded when the answer is tapped? → A: **Pitch and order only, by the same grader.** A tap is a (string, fret) position, but it is graded by its **MIDI pitch**, so the same sound on another string is the same answer — the exercise tests the ear, not knowledge of one fingering. Taps are converted to detected notes (exact pitch, 0 cents offset, clarity 1), so FR-005's alignment and four categories, FR-011/011a adaptation, FR-012/013 persistence and the octave rule (FR-016) apply with no change.
- Q: Which microphone-era behaviours does the fretboard make unnecessary? → A: Segmentation, the no-input timeout and end-of-attempt silence, low-confidence gating, the out-of-tune advisory and microphone permission / noise-floor calibration. None can occur — a tap has no pitch uncertainty, there is no capture window and the answer is submitted explicitly — and all of it was removed on 2026-10-27. An attempt is therefore never `lowConfidence` or `timedOut`, and every submitted attempt is graded.
- Q: How is an attempt's input mode recorded? → A: **Every attempt records `inputMode`** and telemetry carries `input_mode`; attempts recorded before fretboard input existed read back as `mic`, and progress counts only `fretboard` attempts (FR-020).
- Q: What are the answer-entry rules? → A: An answer holds **at most as many notes as the melody** (extra taps are sounded but not added); **Undo** removes the last note, **Clear** empties the answer, **Replay** replays the melody; **Check** is enabled with **≥ 1** note — a shorter answer is graded and its unplayed targets are `missed`. **Retry** (FR-008) clears the board and re-answers the same melody.
- Q: Where do melodies come from, now that the answer is a fretboard? → A: **From a curated library, not a generator** (owner, 2026-10-11). On 2026-10-27 the owner removed the generator from the codebase altogether and will assemble the library himself; the shipped tunes are a starter set. Introduced as **FR-021**. The 12-fret neck reaches only E5 (MIDI 76), so every melody is written to fit E2–E5.
- Q: How long is the neck? → A: **12 frets** (open + 1–12, 13 positions per string, E2–E5), chosen by the owner for a simpler neck with taller cells; it replaces the 16-position first draft. **Implemented 2026-10-11 (T087)**, ahead of the curated set (T088/T089) at the owner's instruction. Melodies are written to fit the neck (FR-021).

- Q: May a curated melody repeat a pitch back-to-back? → A: **Yes** (owner, 2026-10-11) — a repeated note is simply a second tap on the fretboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listen, Play Back, Get Feedback (Priority: P1)

As a guitar learner, I want the app to play a short melody and then let me find it on an on-screen
fretboard so that the app can tell me immediately whether I reproduced it correctly. This is the core
practice loop: hear → recall → answer → get graded.

**Why this priority**: This is the heart of the product and the minimum that delivers value. Without
this single loop working end-to-end, the app has no reason to exist. It is a complete, usable MVP on
its own: a learner can practice ear-to-instrument recall and improve, even with nothing else built.

**Independent Test**: Start a session, let the app play one melody, answer it on the fretboard, and
confirm the app reports a correct/incorrect result identifying which notes matched. Fully
testable in isolation with no difficulty settings or history features present.

**Acceptance Scenarios**:

1. **Given** a session has started, **When** the app plays a short melody, **Then** the
   app clearly signals when it is the learner's turn to play.
2. **Given** the melody has finished and it is the learner's turn, **When** the learner taps the same
   notes in the same order on the fretboard, **Then** the app reports the attempt as correct.
3. **Given** it is the learner's turn, **When** the learner taps one or more wrong notes, **Then** the
   app reports the attempt as incorrect and indicates which notes were wrong, missed, or extra.
4. **Given** an attempt has been graded, **When** the learner chooses to replay the target melody,
   **Then** the app plays the same melody again unchanged.
5. **Given** an attempt has been graded, **When** the learner chooses to retry, **Then** the app lets
   the learner answer the same melody again and grades the new attempt.
6. **Given** an attempt has been graded, **When** the learner chooses to continue, **Then** the app
   presents a new melody.

---

### User Story 2 - Adjustable & Adaptive Difficulty (Priority: P2)

As a learner, I want the difficulty of the melodies to match my ability — and to increase as I
improve — so that practice stays challenging but achievable.

**Why this priority**: Turns a single-loop demo into a sustainable training tool. It multiplies the
value of US1 but is not required for the app to be usable.

**Independent Test**: Choose or reach a difficulty rank, then verify that the melody offered belongs to that
rank (a curated tune assigned to it), and that
3 consecutive correct first attempts raise the rank by one while 2 consecutive incorrect first attempts lower it
by one.

**Acceptance Scenarios**:

1. **Given** difficulty rank *r* is in effect, **When** a melody is chosen, **Then** it belongs to level *r*:
   a curated tune assigned to *r* inside E2–E5 (FR-021), played at 90 BPM.
2. **Given** the learner's first graded attempt is correct on **3 consecutive** new melodies, **When** the
   next melody is chosen, **Then** the rank has increased by exactly 1 and the melody belongs to level *r*+1.
3. **Given** the learner's first graded attempt is incorrect on **2 consecutive** new melodies, **When** the
   next melody is chosen, **Then** the rank has decreased by exactly 1 and the melody belongs to level *r*−1.
4. **Given** the learner prefers manual control, **When** they set a fixed difficulty, **Then** the app
   keeps that level and does not auto-adjust.
5. **Given** the learner is at adaptive rank 5, **When** they switch to fixed rank 2 and later switch back
   to adaptive, **Then** adaptive resumes at rank 5.
6. **Given** an attempt is a retry, **When** that
   attempt ends, **Then** the streak counter is unchanged and the rank does not move.
7. **Given** the learner is at rank 9, **When** they answer 3 more melodies correctly, **Then** the rank
   remains 9.

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

- **Wrong count**: The learner answers with fewer or more notes than the target → the app reports missed
  and/or extra notes rather than silently truncating.
- **Wrong octave**: The learner taps the correct note names in a different octave than intended → treated
  as incorrect (with a clear indication it was an octave mismatch).
- **Interrupted session**: The app is closed or loses focus mid-session → in-progress and completed
  attempt results are not lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** *(withdrawn 2026-10-27)*: The melody generator was removed. Melodies come from the curated library (FR-021).
- **FR-002**: System MUST play the melody audibly to the learner.
- **FR-003**: System MUST clearly signal the transition from "listening" to "your turn to play".
- **FR-004** *(withdrawn 2026-10-27)*: Microphone capture and note segmentation were removed with the microphone (FR-020).
- **FR-005**: System MUST compare the played sequence against the target melody using **best-fit sequence
  alignment** (edit-distance / longest-common-subsequence), so that a single inserted note is flagged
  `extra` and a single skipped note `missed` **without** cascading the surrounding correct notes to
  `wrong`. From that alignment it MUST determine per-note results using **exactly** the four categories
  `matched` / `wrong` / `missed` / `extra` (the same four names used wherever feedback is described, FR-006)
  and an overall correct/incorrect verdict. The overall verdict MUST be **correct** if and only if every
  target note is `matched` and there are **no** `extra` notes; any `wrong`, `missed`, or `extra` note makes
  it **incorrect**. Grading is **pitch-and-order only**: it evaluates the sequence of pitches and their
  relative order, never rhythm or absolute timing (timing is out of scope per Assumptions). Accordingly,
  "the same notes in the same order" (US1) is evaluated objectively as — each target note `matched` under
  the pitch rule (FR-016) at its aligned position (the alignment above), with no `extra`
  notes.
- **FR-006**: System MUST present feedback immediately after the attempt, showing the overall verdict and
  which notes were matched, wrong, missed, or extra.
- **FR-007**: Learners MUST be able to replay the target melody, both before attempting and after
  receiving feedback, without altering the melody.
- **FR-008**: Learners MUST be able to retry the same melody and receive a fresh grading.
- **FR-009**: Learners MUST be able to advance to a new melody.
- **FR-010**: System MUST support exactly **9 difficulty levels (rank 1–9)**. Each level has a note count (3 → 10) and every melody is played at a constant **90 BPM** (rhythm is played, not graded). The curated tunes are assigned to levels (FR-021).
- **FR-011**: System MUST adapt difficulty from recent performance using an **asymmetric consecutive-streak
  rule**: **3 consecutive correct** attempts raise the level by **one rank**; **2 consecutive incorrect**
  attempts lower it by **one rank**. Adjustments are always ±1 rank — never a multi-rank jump. The streak
  counter MUST reset to zero whenever the level changes, so a fresh streak is required before the next
  adjustment. The level MUST clamp at rank 1 and rank 9: further success at rank 9 or failure at rank 1
  leaves the level unchanged. The system MUST also allow the learner to fix difficulty manually, in which
  case no automatic adjustment occurs.
- **FR-011a**: Only the **first graded attempt on each newly presented melody** MUST feed the adaptation
  streak. Retries of the same melody (FR-008) MUST be **excluded** — they neither extend nor break the
  streak and MUST leave the counter unchanged. Excluded attempts MUST still be recorded per FR-012 and
  still contribute to progress statistics (FR-013); the exclusion applies to difficulty adaptation only.
- **FR-011b**: The difficulty mode (adaptive or fixed), the **adaptive rank**, and the **manually selected
  fixed level** MUST be persisted independently and MUST survive session end and app restart. Selecting a
  fixed level MUST NOT overwrite the adaptive rank: returning to adaptive mode resumes at the rank adaptive
  mode last held. Fixed mode MUST allow selecting any of the 9 levels; levels are not gated behind prior
  progress.
- **FR-012**: System MUST record each attempt's result (verdict, per-note outcome, timestamp) within a
  session.
- **FR-013**: System MUST persist results across sessions and present accuracy trends, practice volume,
  and identified weak areas over time.
- **FR-014** *(withdrawn 2026-10-27)*: The out-of-tune advisory and tuning reference were removed with the microphone (FR-020).
- **FR-015** *(withdrawn 2026-10-27)*: The no-input timeout and end-of-attempt silence detection were removed with the microphone (FR-020).
- **FR-016**: System MUST count a tapped note as matched when its **MIDI note number equals the target's** —
  pitch class **and** octave together. A correct note name in the wrong octave is a different MIDI number,
  MUST NOT match, and is surfaced as an octave mismatch (consistent with the octave-sensitivity
  assumption). Concert pitch **A4 = 440 Hz** (equal temperament) is the reference for the synthesized tones.
- **FR-017** *(withdrawn 2026-10-27)*: Low-confidence gating was removed with the microphone (FR-020); an attempt is never low-confidence.
- **FR-018**: Learners MUST be able to start, pause, and end a practice session, and completed results
  MUST survive interruptions.
- **FR-019**: System MUST NOT capture or transmit any audio. Any remote telemetry MUST be limited to
  **anonymized attempt metadata** (overall verdict, per-note outcome, difficulty level, timestamps, and an
  anonymous per-install device id), MUST contain no personally identifying information, and MUST require no
  user account. Remote logging is best-effort and non-blocking; the core loop functions fully offline (see the
  offline-core-loop assumption). The metadata also carries the attempt's **input mode** (`fretboard`; `mic`
  only on attempts recorded before 2026-10-27) — one enum, no PII.

> **Amendment 2026-10-21 (spec 005)**: an account may now exist — optional email sign-in. For a signed-out learner this requirement is unchanged. A signed-in learner's device is linked to the account server-side; `attempt_log` itself stays anonymous (the link is a read-time join). See `specs/005-user-auth/`.
- **FR-020**: The learner answers by tapping positions on an on-screen guitar neck — **6 strings in
  standard tuning E-A-D-G-B-E × 13 positions (open + frets 1–12)**, reaching E2–E5 (MIDI 40–76). It is the
  only answer input: **the app uses no microphone, declares no microphone permission and never requests
  one** (the microphone mode was removed on 2026-10-27). Every melody MUST lie inside that reach (FR-021).
  - Tapping a position MUST **sound that note** at once (it is how the learner compares it with the melody)
    and append it to the answer, up to the melody's note count; a tap on a full answer is sounded but not
    added. The learner MUST be able to **Undo** the last note, **Clear** the answer, **Replay** the melody,
    and **Check** the answer (enabled with ≥ 1 note). **Retry** (FR-008) clears the board for the same
    melody.
  - An answer is **graded by pitch (MIDI), not by position**: the same pitch on another string matches
    (FR-005, FR-016). Taps are converted to detected notes (exact pitch, 0 cents offset, clarity 1), so
    grading, adaptation (FR-011/011a), persistence (FR-012/013) and telemetry (FR-019) work on one note shape.
  - An attempt is never `lowConfidence` or `timedOut`.
  - After grading, the result view MUST show the answer on the fretboard with each tapped note marked by
    its `matched` / `wrong` / `extra` status (FR-006).
  - Each Attempt MUST record its `inputMode` (`fretboard`); attempts recorded before FR-020 read back as
    `mic`. Accuracy MUST NOT be pooled across modes.
- **FR-021**: Melodies MUST come from a **curated library** — a fixed, hand-written list that the owner assembles; there is no generator (removed 2026-10-27). Each curated melody MUST carry its notes (pitch and order), the rhythm needed to play it back, and the difficulty **level** (rank 1–9) it belongs to, and MUST lie entirely inside the neck's reach **E2–E5 (MIDI 40–76)** so that every note can be answered on 12 frets (FR-020). A curated melody **MAY repeat a pitch back-to-back** (owner, 2026-10-11). The adaptive/fixed difficulty behaviour (FR-011, FR-011a, FR-011b) selects melodies by level. A melody is picked **deterministically from the tunes of the current level by the loop's seed** (no memory of recent picks, so a repeat is possible). The library's size and content are **not yet decided** — see Open Questions. The shipped **starter set** — public-domain tunes drafted from memory, at least one per level 1–9 — is a placeholder that the owner replaces and extends.

### Key Entities *(include if feature involves data)*

- **Melody (Phrase)**: An ordered sequence of notes that the learner must reproduce; carries its
  difficulty level and the scale/key it is written in.
- **Note**: A single pitch within a melody or an attempt, with its position in the sequence; the unit of
  comparison for grading.
- **Attempt**: One answer to a melody by the learner, with the answered note sequence, the
  per-note comparison outcome, the overall verdict, a timestamp, and the **input mode** it was given in
  (`fretboard`; `mic` on attempts recorded before 2026-10-27, FR-020).
- **Session**: A continuous practice run containing multiple attempts, the difficulty settings in effect,
  and summary statistics.
- **Difficulty Settings**: The learner's persisted difficulty state — the **mode** (adaptive or fixed), the
  **adaptive rank**, the **fixed level selection**, and the current **consecutive-streak counter**. The two
  level values are independent and both survive app restart (FR-011b).
- **Progress Profile**: Aggregated results across sessions for the single learner, including accuracy
  trends, difficulty reached, practice volume, and weak areas.
- **Difficulty Level**: One of 9 ranked levels (FR-010) that differ in note count (3–10 notes). Tempo
  (90 BPM) is the same constant at every rank. The curated tunes are assigned to levels (FR-021).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can complete one full listen → play → feedback cycle in under 15 seconds when
  ready to play.
- **SC-002** *(withdrawn 2026-10-27)*: The 95 % verdict-agreement target measured microphone recognition and went away with it; a fretboard answer has no pitch uncertainty.
- **SC-002a** *(withdrawn 2026-10-27)*: Per-category precision/recall on a labeled microphone corpus went away with it.
- **SC-003**: Feedback for an attempt appears within 2 seconds of the learner pressing Check.
- **SC-004**: A first-time learner can start a session, complete an attempt, and understand the feedback
  within 2 minutes without external instructions.
- **SC-005**: The app offers exactly 9 difficulty ranks, and every rank has at least one curated tune. The library's difficulty ordering within a rank is an Open Question.
- **SC-006**: After two weeks of regular practice (e.g., 4+ sessions per week), a returning learner shows
  a measurable improvement in recognition accuracy of at least 25% over their first-session baseline.
- **SC-007**: At least 90% of learners report the feedback clearly tells them which notes they got wrong.
- **SC-008** *(⚠ conflicts with `002-history-sync`: history sync sends full attempt documents, not just the FR-019 aggregate — decision pending, see that spec's Open Questions)*: The app captures no audio and no PII is ever transmitted off-device; inspection of all outbound
  network traffic shows only the anonymized attempt-metadata payload defined in FR-019, and the full
  listen → answer → feedback loop completes with networking disabled.
- **SC-009**: The UI meets a **WCAG 2.1 AA, mobile-adapted** baseline — every interactive control exposes
  an accessible label/role, text contrast is ≥ 4.5:1, all core flows are operable end-to-end with
  VoiceOver and TalkBack, touch targets are ≥ 44pt (iOS) / 48dp (Android), and layouts remain usable at
  the OS's largest standard font-scaling setting.
- **SC-010** *(FR-020)*: Tapping a fret sounds its note without perceptible lag on a physical device, including the first taps after the screen opens (the neck's pitches are pre-rendered once the screen settles). **Accepted on the owner's hands-on check, 2026-10-11 — no measured figure.** The original target was p95 < 200 ms from touch to audible onset (the constitution default); it was not instrumented, and is to be measured only if a tap ever feels late.

## Open Questions (melody library, FR-021 — owner to decide)

- **Content and size**: how many melodies, and who writes or approves them? (The famous-tune melodies of the video series in `docs/experiments.md` are one candidate source; their keys and range must be checked against E2–E5.)
- **Selection rule**: the starter set picks randomly within the level with no memory of recent picks. Is that acceptable, or should it avoid an immediate repeat / cycle in order? With few tunes per level a learner will see repeats.
- **Difficulty**: are the 9 levels still the right axis for a hand-picked set, or does the MVP need fewer levels? (With few melodies, 9 levels leaves some with one tune.)
- ~~**Repeated pitches**~~ — **decided 2026-10-11**: allowed in the curated library (FR-021).

## Assumptions

- **Single learner**: The app serves one learner at a time. No multi-user accounts are required for the
  initial version; progress is stored for that single learner.
- **Monophonic melodies**: Phrases are single-note sequences (no chords), matching typical ear-training
  and single-note guitar reproduction.
- **Pitch-first grading**: Correctness is judged on the sequence of pitches (right notes, right order).
  Rhythmic/timing accuracy is out of scope for the initial version and may be added later as a separate
  graded dimension.
- **Answer input**: The app answers on an on-screen fretboard (FR-020), so it needs **no microphone and no
  guitar in hand**; only audio *output* is required. The neck is standard-tuned by construction.
- **Guitar-playable range**: Melodies fall within the neck's reach **E2–E5 (MIDI 40–76)**, inside the
  standard guitar range, so every target note can be answered on the neck.
- **Reference tuning**: Tone frequencies are equal-tempered relative to **concert pitch A4 = 440 Hz**.
- **Octave sensitivity**: By default, a correct note name played in the wrong octave is treated as
  incorrect; octave-tolerant matching may become a later option.
- **Offline core loop**: Melody selection, playback, answering, and grading work without network
  connectivity; any progress data is stored on the learner's device.
- **Audible output available**: The device can play the melody through a speaker or headphones.
