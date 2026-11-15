# Feature Specification: Home Screen Layout and Continue

**Feature Branch**: `023-home-screen-layout`

**Created**: 2026-11-15

**Status**: Implemented 2026-11-15, not released. Seen by the owner on the emulator (the week card, the rank row, the
bottom bar); the Continue card, "Last opened" and the 8 dp gap still to be seen there (T010). Needs an OTA.

**Input** (second round, 2026-11-15): a product-design brief from the owner — turn Home from a dashboard into a hub:
a compact header instead of the marketing headline, one primary action (Continue or Start practice, never both), a
weekly goal, a rank card that says how far the next rank is, a reusable Daily challenge card that never shows made-up
data, subtle motion. This revised the layout below; the earlier decisions about the bottom bar, Continue for an
opened melody and hiding the challenges stand.

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

Top to bottom: a compact header (EAR WARRIOR and one line that depends on the streak) · **one primary card**: *Where
you stopped* with Continue, or the Start practice card, never both · *Daily challenge* (only while the challenges are
on) · *Weekly activity* (streak, seven day circles, the weekly goal as a bar) · *Your rank* (name, "40 / 100 XP", a bar,
what is still missing) · a bottom bar with Melodies, Progress, Settings. The cards are 8 dp apart; the primary card
takes the free height of a tall phone. The same on every phone; no compact mode.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everything fits without scrolling (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a 360×640 dp phone, **When** Home opens, **Then** every control is visible without scrolling.
2. **Given** a tall phone, **When** Home opens, **Then** the title is larger (as before) and the cards stay pinned
   above Start practice; the free space is above them.
3. **Given** a window too short even for this, **When** Home opens, **Then** it scrolls and no control is cut off.

### User Story 2 - Continue where I was (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a melody is half-answered (a place is saved, spec 017), **When** Home opens, **Then** the Continue card
   says "Where you stopped", the tune's name, "Phrase 3 of 8", a segment bar with the answered phrases filled, and a
   Continue button that opens the melody at phrase 3 with the saved first tries.
2. **Given** a melody was opened and nothing was answered in it, **When** Home opens, **Then** the card says "Last
   opened", "Phrase 1 of N", an empty bar, and Continue opens the melody at phrase 1.
3. **Given** a place is saved for tune A and tune B was opened after it, **When** Home opens, **Then** the card is
   for B; if B was opened before the place was saved, or the place is for B itself, the saved place is used.
4. **Given** the melody was finished (or there is nothing to continue), **When** Home opens, **Then** there is no
   Continue card.

### User Story 3 - The week and the rank at a glance (Priority: P2)

**Acceptance Scenarios**:

1. **Given** days of practice, **When** Home opens, **Then** the week strip shows them as on Progress and the streak
   ("3 days") sits at the card's right.
2. **Given** the daily challenges are hidden, **When** it is today, **Then** today is a filled tick once practised and
   an empty ring before, never a challenge count.
3. **Given** the rank row is tapped, **Then** the ranks screen (Journey) opens.

### User Story 5 - The rank and the weekly goal say what is next (Priority: P2)

**Acceptance Scenarios**:

1. **Given** 40 XP and no level mastered, **Then** the rank card reads "40 / 100 XP" and "60 XP and mastery of Level
   1 to reach Apprentice"; at the top rank it reads the total XP and "Top rank reached".
2. **Given** 3 practice days this week, **Then** the weekly activity reads "3 / 5 days" with the bar at 60%.
3. **Given** XP rises while Home is shown or after a practice, **Then** "+N XP" appears beside the XP and fades.

### User Story 4 - Navigation as a bottom bar (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Home, **When** the bar shows, **Then** Melodies, Progress and Settings each have an outline icon (notes,
   bars, gear) above their label, and open their screens.

### Edge Cases

- The saved place no longer fits its tune (phrase count changed) or the tune left the library: it is not offered.
- A place saved on another device arrives by sync (spec 019): it counts like a local one. "Last opened" is local only.
- The Continue card needs the melody progress store; while it loads there is no card, never a flash of a wrong one.
- Before the standing loads, the week and rank cards are absent (no placeholders).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Home MUST use one layout for every window height; the compact mode and the waveform are removed.
- **FR-002**: Home MUST fit a 360×640 dp window without scrolling and MUST fall back to scrolling, never to clipping.
- **FR-003**: The cards MUST sit in one column under the header, 8 dp apart, in the order: primary card, Daily
  challenge (when on), Weekly activity, Rank; the primary card takes the free height.
- **FR-004**: The bottom bar MUST hold Melodies, Progress and Settings, each at least 56 dp tall, with icon and label
  and a screen-reader label; the icons are bundled PNGs (Tabler outline, MIT), no new dependency.
- **FR-005**: Continue MUST be offered for the most recently changed saved place that still fits its tune, unless a
  different melody was opened after it (then that melody). A finished melody is never offered.
- **FR-006**: The practice screen MUST record the melody on screen as the last opened (device only) and forget it
  when that melody is finished.
- **FR-007**: Continue MUST open `/practice?tune=<id>&resume=1` for a saved place and `/practice?tune=<id>` for a
  melody only opened.
- **FR-008**: Daily challenges MUST be hidden behind one flag (`SHOW_DAILY_CHALLENGES`); with it off, the challenges
  tile, its attention dot (spec 015) and the count in today's ring are absent; turning it on brings the ring count back.
- **FR-010**: The header MUST be the brand and one line: "Keep your N-day streak going." while a streak is open
  and today is not yet practised, "Your ear is getting stronger." once today is practised, else "Ready to train?".
- **FR-011**: The primary card MUST show either Continue (FR-005) or Start practice, never both buttons. Under
  Continue there is a quiet text link, "Start something new", because "last opened" (FR-006) makes Continue present
  almost always and the adaptive Start practice would otherwise be unreachable from Home.
- **FR-012**: Weekly activity MUST show the streak, the seven days and "N / 5 days" against a bar; N is the days
  practised this week from the same set of practice days as the streak and the circles (so they cannot disagree);
  the goal (5) is the constant `WEEKLY_GOAL_DAYS`. Practice days, not sessions, are what the app records.
- **FR-013**: The rank card MUST show "N / threshold XP" against the next rank, a bar, and one line of what is missing
  (XP, a level to master, or both; "Top rank reached" at the top), from the existing `rankProgress`.
- **FR-014**: The Daily challenge card MUST show one of the day's real challenges (title, reward, progress) and
  never a made-up one; it is shown only when `SHOW_DAILY_CHALLENGES` is on and one is not done.
- **FR-015**: Bars MUST ease to a new value; "+N XP" MUST rise and fade when XP went up since the last reading;
  the primary card MUST fade when it switches state; all of it still under reduced motion.
- **FR-009**: The week strip MUST be the one used on Progress (spec 011); its `showCount` prop only hides the count.

### Key Entities

- **Weekly goal**: `WEEKLY_GOAL_DAYS` (5), a product constant; no setting and no server value yet.
- **Continue target**: tune, phrase count, phrase to open at, answered count, and whether the saved first tries apply.
- **Last opened**: tune id and time, one value in the local key-value store.

## Success Criteria *(mandatory)*

- **SC-001**: On a 360×640 dp emulator, Home shows every control without a scroll.
- **SC-002**: Open a melody, answer nothing, leave: Home shows "Last opened" with that tune within one visit.
- **SC-003**: Answer two phrases, leave: Continue opens at phrase 3 with the first two marked answered.
- **SC-004**: Finish the melody: Continue is gone (or points at another).

## Assumptions

- The owner decides when the daily challenges return; this spec only hides them. The Daily challenge card is built on
  the existing three challenges (count and accuracy kinds, with XP rewards); a "no mistakes" or "within N attempts"
  kind would need a new rule in `challengeStates` and, for server challenges, a new type in the backend (spec 018).
- Specs 013 FR-009 and 015 FR-001 are amended by FR-008 while the flag is off; spec 017's "a Continue card on Home is a
  later step" is done here.
