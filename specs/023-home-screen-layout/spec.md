# Feature Specification: Home Screen Layout and Continue

**Feature Branch**: `023-home-screen-layout`

**Created**: 2026-11-15

**Status**: Implemented 2026-11-15, not released. Checked on the emulator (the last-result block with a real
attempt); a half-answered phrase still to be seen there (T024). Needs an OTA.

**Input** (third round, 2026-11-15): "Home looks boring and like a pile of stuff — propose improvements." Of twelve
pictured directions the owner chose no. 11, the sounding strings, and added: the strings are animated as endless
waves, and touching them plays the open strings. Seen on the emulator it looked odd (strings waving like weed, bare
and floating); the owner asked for it to look organic and on theme and chose the neck with notes (variant A): strings
pinned at a nut, frets to scale, the notes lit. Then: "everything on Home is fine except the neck; it looks silly,
off-theme and solves nothing — propose something else". Of four useful options (hear the phrase, last attempt, the
path of levels, the week in notes) the owner chose *Last attempt*. The strings and the neck were removed.

**Input** (first round): Owner (2026-11-15): "the home screen does not fit small screens and scrolls — optimise it, show several
layouts as a picture first." Of three layouts the owner chose B, the bottom bar, and then asked for it on every screen
size, not only the short ones. After seeing it: "it looks empty — suggest what to fill it with; I also want a Continue
button to carry on from the last phrase I practised" and picked the card with the week strip. Then: "the cards in one
container, pinned to the bottom", "Continue must appear even if I finished no phrase, only opened the melody", "a small
gap between the cards", "Continue's text colour differs" (it is the same outlined style as Start practice now),
"hide daily challenges for now, we will finish and bring them back".

## Context

Home (spec 001 T035, then 013 and 015) held, top to bottom: a kicker, a three-line title, a three-line blurb, a
waveform (tall phones), a rank card, a streak tile and a daily-challenges tile, Start practice and three outlined
buttons. On a short phone that is about 560 dp, which does not fit once the system bars and a large font are counted;
Home had a compact mode below 700 dp that dropped the waveform and shrank the padding, and still scrolled on the
smallest windows. Spec 017 left "a Continue card on Home" for later; this is that step.

## The screen

Top to bottom: the brand · the melody to continue (*Where you stopped* / *Last opened*, its name, "Level 1 · Phrase 2
of 2"), or "Train your ear" when there is none · **the last result**: how the last phrase (or attempt) went, note by
note, in the free height · the main button (Continue, or Start practice) with a quiet "Start something new" link under
Continue · a strip of three numbers (streak, rank with "40 / 100 XP", days practised this week) · the bottom bar. No
cards. The melody and the last result are centred vertically, together, in the free height under the brand. The same
on every phone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everything fits without scrolling (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a 360×640 dp phone, **When** Home opens, **Then** every control is visible without scrolling.
2. **Given** a tall phone, **When** Home opens, **Then** the free height goes to the last result, which stays in the middle of it.
3. **Given** a window too short even for this, **When** Home opens, **Then** it scrolls and no control is cut off.

### User Story 2 - Continue where I was (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a melody is half-answered (a place is saved, spec 017), **When** Home opens, **Then** the melody block
   says "Where you stopped", the tune's name, "Phrase 3 of 8" and Continue opens it at phrase 3 with the saved first
   tries; the last-result block shows how its last answered phrase went.
2. **Given** the last melody played was finished, **When** Home opens, **Then** it says "Last played", the button
   reads "Try again", it opens the melody at phrase 1, and the last-result block shows how that attempt went.
3. **Given** a place is saved for tune A and tune B was finished, **Then** whichever happened later is shown.
4. **Given** a melody was only opened and nothing was answered in it, **Then** it is shown ("Last opened", "Phrase 1
   of N", Continue at phrase 1) only when nothing was played or saved; it never replaces a melody that was played.
5. **Given** there is nothing to continue, **Then** Home shows "Train your ear" and Start practice.

### User Story 3 - The standing in one line (Priority: P2)

**Acceptance Scenarios**:

1. **Given** the standing has loaded, **When** Home shows, **Then** a strip reads the streak, the rank with "40 / 100
   XP" (just the XP at the top rank) and the days practised this week; before it loads there is no strip.
2. **Given** the rank is tapped, **Then** the ranks screen (Journey) opens; the days open Progress.
3. **Given** the daily challenges are shown (flag on), **Then** the third item is "N / 3 challenges" with the
   attention dot and opens them.

### User Story 6 - See how the last go went (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a phrase of the melody on screen was answered, **Then** the block reads "Last phrase · yesterday",
   "6 of 8 notes", one chip per note named without its octave (landed: filled; wrong: warm outline; missed: quiet
   outline) and a line: "Clean. Try the next one." when all landed, "N to go. Beat it." when 1–2 were missed, else
   "Another go will lock it in."
2. **Given** the melody on screen was finished, **Then** it shows "Last attempt" for that melody, the same way. The
   block never shows another melody's result under this melody's name (two names on one screen read as a mistake).
3. **Given** the melody on screen has no result (it was only opened, or Home has nothing to continue), **Then** the
   block is a line saying how the app works instead.
4. **Given** a result of more than 16 notes, **Then** the first 16 are shown and "+N" counts the rest.
5. **Given** the result changes, **Then** the block fades in (not under reduced motion).

### User Story 4 - Navigation as a bottom bar (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Home, **When** the bar shows, **Then** Melodies, Progress and Settings each have an outline icon (notes,
   bars, gear) above their label, and open their screens.

### Edge Cases

- The saved place no longer fits its tune (phrase count changed) or the tune left the library: it is not offered.
- A place saved on another device arrives by sync (spec 019): it counts like a local one. "Last opened" is local only.
- The Continue card needs the melody progress store; while it loads there is no card, never a flash of a wrong one.
- Before the standing loads, the strip is absent (no placeholders).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Home MUST use one layout for every window height; the compact mode and the waveform are removed.
- **FR-002**: Home MUST fit a 360×640 dp window without scrolling and MUST fall back to scrolling, never to clipping.
- **FR-003**: Home MUST have no cards: the melody, the last result, the main button and the strip sit directly on the screen; the last result takes the free height.
- **FR-004**: The bottom bar MUST hold Melodies, Progress and Settings, each at least 56 dp tall, with icon and label
  and a screen-reader label; the icons are bundled PNGs (Tabler outline, MIT), no new dependency.
- **FR-005**: Continue MUST be offered for the melody last played: the most recently changed saved place that still fits its tune, or the latest finished attempt (offered to play again), whichever is later; failing both, the melody last opened. A melody only opened never replaces one that was played. A finished melody is not offered as "continue" in any other way.
- **FR-006**: The practice screen MUST record the melody on screen as the last opened (device only) and forget it
  when that melody is finished.
- **FR-007**: The button MUST open `/practice?tune=<id>&resume=1` for a saved place and `/practice?tune=<id>` otherwise; it reads "Continue", or "Try again" for a finished melody.
- **FR-008**: Daily challenges MUST be hidden behind one flag (`SHOW_DAILY_CHALLENGES`); with it off the strip shows the days practised this week and there is no challenges item or attention dot (spec 015); turning it on brings them back as the strip's third item.
- **FR-009**: Home MUST show the last result (US6) of the melody on screen only: its last answered phrase, or its finished attempt; note names come from the target notes (already answered, so nothing is given away); a result with no target notes is not shown.

### Key Entities

- **Continue target**: tune, phrase count, phrase to open at, answered count, and whether the saved first tries apply.
- **Last opened**: tune id and time, one value in the local key-value store.

## Success Criteria *(mandatory)*

- **SC-001**: On a 360×640 dp emulator, Home shows every control without a scroll.
- **SC-002**: Open a melody, answer nothing, leave: Home shows "Last opened" with that tune within one visit.
- **SC-003**: Answer two phrases, leave: Continue opens at phrase 3 with the first two marked answered.
- **SC-004**: Finish the melody: Continue is gone (or points at another).
- **SC-005**: Answer a phrase and leave: Home shows that phrase's result note by note; with none answered, the melody's last attempt or the latest attempt named.

## Assumptions

- The owner decides when the daily challenges return; this spec only hides them.
- The chips name notes that were already answered, never the ones still to find.
- Specs 013 FR-009 and 015 FR-001 are amended by FR-008 while the flag is off; spec 017's "a Continue card on Home is a
  later step" is done here.
