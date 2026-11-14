# Feature Specification: Pause and Resume Playback

**Feature Branch**: `021-pause-resume-playback` (not created — work lands on `master`)

**Created**: 2026-11-14

**Status**: Draft

**Input**: Beta tester (level 9, 2026-11-14): "When listening to the audio to identify the notes, you have to listen to the
entire melody before returning to the challenge. [...] having the option to pause the audio, return to the challenge,
and then resume playback from where you left off would be a really useful addition."

## Context

Since 2026-11-11 (commit `6133415`, in Play builds 4 and 5) the answer screen opens at once and the phrase sounds over
it; a tap on a fret or Check cuts the sound, and a Stop button does the same. So the learner *can* go back to the
challenge early. What they cannot do is come back to the same place in the phrase: `stop()` forgets where it was, and
Replay starts the phrase over. On a long phrase (higher levels) the learner hears the first notes, taps to try them,
loses the rest, and has to sit through the phrase from the top to reach the notes they had not heard yet.

The tester also says "the entire melody", so some of the pain may be that Stop is not noticed as the way out; the
button's label and place are part of this work.

What exists to build on: the clip player already starts `fromMs` into a clip (`startClip(clipId, rate, fromMs)`), and
`MediaClock` (`src/lib/mediaClock.ts`) already knows how far a clip has played at any speed. Pausing needs only to read
that position, silence the clip, and start again from it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pause and come back to the same spot (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a phrase is sounding, **When** the learner presses Pause, **Then** the sound fades out and the button
   becomes Resume.
2. **Given** a phrase is paused, **When** Resume is pressed, **Then** the phrase continues from the note after where it
   stopped (not from the start), at the speed in effect now.
3. **Given** a phrase is paused, **When** Replay (from the start) is pressed, **Then** it plays from its first note, as
   today.
4. **Given** a phrase is sounding, **When** the learner taps a fret, **Then** the tapped note sounds and the phrase is
   paused where it was, so Resume still works.
5. **Given** the whole tune is sounding (hear whole / complete screen), **When** Pause and Resume are used, **Then** they
   behave the same on the tune.

### User Story 2 - The paused place does not outlive its phrase (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a phrase is paused, **When** Check is pressed, the next phrase opens, a new melody is served, or Skip is
   used, **Then** the paused place is dropped and the next sound starts from the beginning of what plays.
2. **Given** a phrase is paused, **When** the screen is left or the app goes to the background, **Then** nothing sounds
   and the place is dropped (no resume after a long absence).
3. **Given** the playback speed is changed while paused, **When** Resume is pressed, **Then** it continues from the same
   note at the new speed.

### Edge Cases

- Pause landing mid-note: Resume starts at the clip position, not on a note boundary; the note's attack may be missed.
  Acceptable for the clip path; the note-sample fallback resumes at the next whole note.
- Pause in the last 300 ms of a phrase counts as finished: Resume would replay nothing, so the button goes back to Replay.
- A phrase that plays out in full is not "paused": its button is Replay, as today.
- The note-sample fallback (tune without a bundled clip) pauses between notes: the note sounding is allowed to finish,
  then no further note starts.
- The coached first melody (`listenFirst`) is a listening-only phase; it has no Pause.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While a phrase or tune sounds, the player control MUST offer Pause in place of today's Stop; a paused one
  MUST offer Resume and a way to Replay from the start.
- **FR-002**: Pause MUST record the position reached in the tune's own time (`MediaClock.position`) and silence the
  audio with the usual short fade.
- **FR-003**: Resume MUST sound the rest of the phrase (or tune) from that position, through the clip's `fromMs`, at the
  current speed, and MUST end (resolve) like a normal playback so `replaying` clears.
- **FR-004**: A fret tap or Check during playback MUST pause rather than discard the position (the tap's own tone still
  cuts the audio as now).
- **FR-005**: The paused position MUST be dropped on a new phrase, a new melody, skip, Check, leaving the screen, and
  when the app is backgrounded.
- **FR-006**: The playback service MUST expose the position as data (`pause()` returns where it stopped, or null when
  nothing was sounding) so the orchestration stays testable with the injected native player; no new native module and
  no new clip files.
- **FR-007**: No new analytics event names (a new name needs the server deployed first, funnel analytics); pause/resume
  taps are not counted in `melody_replay`.

### Key Entities

- **Paused place**: where the sounding phrase or tune stopped, in the tune's own milliseconds, plus which phrase
  (or the whole tune) it belongs to. Held in memory only; never saved or synced.

## Success Criteria *(mandatory)*

- **SC-001**: On a phrase of 8+ notes, Pause after the 3rd note, tapping 3 frets, then Resume sounds the 4th note next.
- **SC-002**: Pause → Resume does not add more than a short fade (~50 ms) of silence or any repeated note at the join.
- **SC-003**: Same tester asked again after the next build: "I can pause and continue" is answered yes.

## Assumptions

- Phrase-by-phrase answering stays; this does not bring back a separate listening screen.
- Pause is not offered while nothing sounds; Replay remains the control for that state.
- Whether the tester's pain was "no way back" or "no resume" is unknown (they may not have found Stop). The button
  change (Pause visible while sounding) covers both; if reports continue, the next lever is a longer-phrase split, not
  more transport controls.
