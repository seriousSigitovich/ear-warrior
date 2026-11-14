# Feature Specification: A Player on the Answer Screen (pause, resume, navigate, edit)

**Feature Branch**: `021-pause-resume-playback`

**Created**: 2026-11-14

**Status**: Implemented, checked on the emulator at 360×640 dp; not yet heard on a phone, not released

**Input**: Beta tester (level 9, 2026-11-14): "When listening to the audio to identify the notes, you have to listen to the
entire melody before returning to the challenge. [...] having the option to pause the audio, return to the challenge,
and then resume playback from where you left off would be a really useful addition." Owner (2026-11-14), after seeing
several layouts: the answer screen keeps only navigation, the phrase, the fretboard and a trigger; a row of note
circles is the controller for the melody (navigate, fix any note, undo the last), everything else is hidden; Check shows
up only when the phrase is full; the row sits at the bottom; the trigger for the rest is a settings icon at the top
right of the navigation bar.

## Context

Since 2026-11-11 (commit `6133415`, in Play builds 4 and 5) the answer screen opens at once and the phrase sounds over
it; a tap on a fret or Check cuts the sound, and a Stop button does the same. What the learner cannot do is come back to
the same place in the phrase (Stop forgets it; Replay starts over), jump to a note, or fix a note in the middle without
clearing everything. On a long phrase (higher levels) that is exactly the tester's complaint.

What exists to build on: the clip player starts `fromMs` into a clip, `MediaClock` knows how far a clip has played at any
speed, and the service now has `position()`, `pause()` and `playMelody(..., offsetMs)` (done, contract-tested).

## The screen

Top to bottom: navigation bar (back arrow, "Phrase N of M" over its progress segments, settings icon) · fretboard, full
width and as tall as the room allows · a row of note circles, with ▶/⏸ at its left and a backspace key at its right · Check, a pill
over the bottom of the board, only when the phrase is full. Nothing else is on the screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate the melody with the circle row (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a phrase is on the answer screen, **When** it shows, **Then** a row at the bottom has one circle per note
   of the phrase, all visible at once, ▶ at its left; a circle shows the name of the note placed there.
2. **Given** a phrase is sounding, **When** it plays, **Then** the circles already sounded are filled, the one sounding
   is bright, and ▶ is ⏸.
3. **Given** ⏸ is pressed, **When** the sound stops, **Then** the circles stay where they are and the button is ▶;
   pressing it continues from where it stopped, at the speed in effect now.
4. **Given** a circle is tapped (also while the phrase sounds), **When** the finger lifts, **Then** the phrase plays
   from that note.
5. **Given** the finger is dragged along the row (also while it sounds), **When** it moves, **Then** the sound stops and
   stays silent; on release the phrase plays from the nearest note.
6. **Given** nothing sounds and the phrase has played out (or has not yet played), **When** ▶ is pressed, **Then** the
   phrase plays from its first note.
7. **Given** a phrase is sounding, **When** the learner taps a fret, **Then** the tapped note sounds, the phrase is
   paused where it was and ▶ continues it.

### User Story 2 - Fix any note (Priority: P1)

**Acceptance Scenarios**:

1. **Given** note 3 is placed, **When** its circle is tapped, **Then** the phrase plays from note 3 and note 3 is
   selected (a ring on its circle and on its marker on the board; the title says "Tap the right fret for note 3").
2. **Given** a note is selected, **When** a fret is tapped, **Then** it replaces that note only, the notes before and
   after stay, and the selection is cleared (the next tap goes to the first empty circle).
3. **Given** a note is selected, **When** a circle past the last placed note is tapped, the backspace key is pressed, or the answer is
   cleared, **Then** the selection is cleared.

### User Story 3 - Undo the last note (Priority: P1)

**Acceptance Scenarios**:

1. **Given** at least one note is placed, **When** the learner looks at the row, **Then** a backspace key is at its right end.
2. **Given** the backspace key is pressed, **When** it acts, **Then** the last note is removed, its circle empties and any selection is
   cleared.
3. **Given** no note is placed, **When** the row shows, **Then** there is no backspace key.

### User Story 4 - Check only when the phrase is full (Priority: P1)

**Acceptance Scenarios**:

1. **Given** fewer notes are placed than the phrase has, **When** the screen shows, **Then** there is no Check.
2. **Given** the last circle is filled, **When** the screen shows, **Then** a Check pill appears over the bottom of the
   board, above the row, without moving the board.
3. **Given** a note is removed again, **When** the phrase is no longer full, **Then** Check goes away.

### User Story 5 - The rest, behind the settings icon (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the answer screen, **When** the settings icon (top right of the navigation bar) is tapped, **Then** a panel
   opens under the bar with: Speed (50 / 75 / 100 %), Draft mode (a switch), Hear whole melody (first phrase of a longer
   tune), Skip to phrase N (when an earlier visit stopped there), and Clear answer.
2. **Given** the panel is open, **When** the icon is tapped again or anything outside the panel is touched, **Then** the
   panel closes.
3. **Given** Draft is on, **When** the screen shows, **Then** the settings icon is lit and the title says "Draft: nothing
   is scored", so the mode cannot be forgotten; Check is not offered in Draft (nothing is scored).
4. **Given** the coached first melody, **When** it shows, **Then** it keeps its own layout (no row, no panel).

### User Story 6 - The place does not outlive its phrase (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a phrase is paused, **When** Check is pressed, the next phrase opens, a new melody is served, or Skip is
   used, **Then** the place is dropped and the next sound starts from the beginning of what plays.
2. **Given** a phrase is paused, **When** the screen is left, **Then** nothing sounds and the place is dropped.
3. **Given** the speed is changed while paused, **When** ▶ is pressed, **Then** it continues from the same note at the new
   speed.

### Edge Cases

- Resume or navigation landing mid-note: the clip starts at that position, so the attack of the note may be missed.
  Navigation snaps to note starts; pause keeps the exact position. The note-sample fallback resumes at the next whole note.
- A pause in the last 300 ms of a phrase counts as finished: ▶ plays from the start.
- A replaced note keeps the time of the note it replaces, so the order and timing the grader sees are unchanged.
- 15–17 note phrases: the circles shrink to 14 dp and their names no longer fit; the name shows on the board's marker.
  The whole row stays one line, never scrolls.
- A phrase of one note has no row to navigate; ▶ and the backspace key are still offered.
- Backgrounding needs no rule: the audio stops with the screen as it does today, and a paused place is only in memory.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Playback position MUST be one number, ms into the melody at the tune's own tempo (`MediaClock`
  position); the service reports it (`position()`), stops at it (`pause()`) and starts from it (`playMelody` offset).
  Built and contract-tested.
- **FR-002**: The circle row MUST sit at the bottom of the answer screen, one line, with ▶/⏸ at the left and a backspace key at the
  right (only when a note is placed; drawn as a backspace key); its touch target MUST be at least 44 dp tall and its circles MUST need no scroll
  for any library phrase (4–17 notes).
- **FR-003**: A touch on the row MUST stop a sounding phrase at once (keeping its place); a drag follows the finger
  without sound; the release plays from the nearest note; a tap is a drag of zero length.
- **FR-004**: The row MUST be exposed to screen readers as an adjustable control ("Note 3 of 8"; increment and decrement
  move one note and play from there); ▶/⏸ and the backspace key are separate buttons with labels.
- **FR-005**: The answer MUST support a selected note (cursor): tapping a placed circle selects it, the next fret tap
  replaces that note (keeping its time) and clears the selection; the backspace key, Clear answer, a new phrase and Check clear it.
- **FR-006**: Check MUST be offered only when the number of placed notes equals the phrase's, and MUST NOT shift the
  board (it floats over its bottom edge). While Draft is on it is not offered.
- **FR-007**: The settings panel MUST hold Speed (50 / 75 / 100 %), Draft, Hear whole melody, Skip to phrase N and Clear
  answer, and nothing else; the screen has no other controls.
- **FR-008**: The navigation bar MUST carry "Phrase N of M" with its segments (replaced by the hint line while the
  learner has not tapped yet, while a note is selected and in Draft) and the settings icon at the right; the Draft switch
  moves into the panel and the icon shows its state.
- **FR-009**: A fret tap or Check during playback MUST pause rather than discard the position (the tap's own tone still
  cuts the audio as now).
- **FR-010**: The paused position MUST be dropped on a new phrase, a new melody, skip, Check and leaving the screen.
- **FR-011**: The row and its controls MUST be plain React Native (`PanResponder`), no native module, so they ship over
  the air; no new analytics event names (a new name needs the server deployed first); pause, resume and navigation are not
  counted in `melody_replay`.

### Key Entities

- **Playhead**: where the sounding or paused phrase (or tune) is, in ms at the tune's own tempo, plus which phrase (or
  the whole tune) it belongs to. In memory only.
- **Selected note**: the index of a placed note chosen for replacement, or none. In memory only.

## Success Criteria *(mandatory)*

- **SC-001**: On a phrase of 8+ notes, pause after the 3rd note, tap 3 frets, press ▶ — the 4th note sounds next.
- **SC-002**: A wrong 3rd note of 8 is fixed in two taps (its circle, the right fret) with the other 7 notes untouched.
- **SC-003**: Pause → ▶ adds no more than a short fade (~50 ms) of silence and no repeated note at the join.
- **SC-004**: Tapping a circle makes the phrase sound from that note within 150 ms.
- **SC-005**: The board is at least as tall as before this change on a 360×640 dp phone, with no vertical scroll.
- **SC-006**: Same tester asked again after the next build: "I can pause and continue" is answered yes.

## Assumptions

- Phrase-by-phrase answering stays; this does not bring back a separate listening screen.
- The screens after Check (feedback, complete) keep their own buttons, now Replay / Pause / Resume; they have no row.
- Whether the tester's pain was "no way back" or "no resume" is unknown; the row and its pause cover both.
- A selected note is replaced, never inserted or deleted in the middle; deleting is the backspace key (last) or Clear answer (all).
