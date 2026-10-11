# Feature Specification: Readable & Accessible UI (Android release)

**Feature Branch**: `004-accessibility`

**Created**: 2026-10-11

**Status**: Draft — FR-009 decided and implemented (owner, 2026-10-11, exception to 44 pt accepted); to verify on an Android device

**Input**: User description: "Accessibility — increase the fonts" (owner's pre-Android-release plan, item 5). Scope
widened from "bigger fonts" to the readability and accessibility baseline the release needs, because a larger
default size alone neither respects the user's own device settings nor fixes the failures already audited.

**Relationship to spec 001**: this feature **owns** the accessibility baseline of spec 001 — SC-009, tasks T051 and
T076, and the audit in `specs/001-guitar-ear-training/checklists/fretboard-a11y.md`. When this spec is
implemented, T051/T076 are closed by reference to it. It adds the text-size requirements that SC-009 only mentions
in passing ("usable at the largest font scale").

## Clarifications

### Session 2026-10-11

- Q: Is the goal only "bigger fonts"? → A: No. The requirement is that text is comfortably readable by default **and** follows the user's device text-size setting without breaking the layout; larger default sizes alone do not satisfy that. (Owner's request was the shorthand; this spec states the requirement behind it.)
- Q: Fret cells are ≈ 51 × 29 pt against 44 pt (FR-009) — exempt them, or show fewer frets? → A: **Neither yet — first give the neck every free pixel** (owner: "I cut the neck to 12 frets and a lot of space is left over; let the fretboard fill it"). The dead band came from the top safe-area inset being applied twice (navigation header + screen); fixing it raised the cell from ≈ 29 to ≈ 34 pt on an iPhone 17 Pro (402 × 874 pt). The remaining gap to 44 pt is handled by FR-009 below.
- Q: Which platforms? → A: Both iOS and Android share one code base and one design; **Android is the release target** (Google Play), so verification happens on Android first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Text I can read without squinting (Priority: P1)

As a learner, I want every piece of text in the app — labels, captions, hints, numbers on the fretboard — to
be large enough to read comfortably at arm's length, so that I can use the app without straining or
zooming in on my phone.

**Why this priority**: This is the owner's explicit ask and the most visible defect: today a large share of the
text is set at 10–13 points, which is below what mobile guidelines consider comfortable. It affects every user, not
only those who use assistive technology.

**Independent Test**: Open each screen (home, practice, progress, settings) at the device's default text size;
confirm no text is below the minimum size, and that every text style comes from one shared size scale rather than a
per-screen number.

**Acceptance Scenarios**:

1. **Given** the device is at its default text size, **When** the learner opens any screen, **Then** no text is
   rendered smaller than the minimum text size (FR-001).
2. **Given** a developer wants to add text, **When** they style it, **Then** the size comes from the shared size
   scale; a hand-written size outside the scale is rejected by an automated check (FR-002).
3. **Given** the redesigned sizes, **When** the learner views a screen, **Then** the visual hierarchy (heading →
   body → caption) is still distinguishable — sizes grew, but the steps between them remain visible.

---

### User Story 2 - The app follows my device's text size (Priority: P1)

As a learner who has set my phone's text size to large or the largest, I want the app to honour it and still
lay out correctly, so that nothing is cut off, overlapping, or unreachable.

**Why this priority**: Honouring the system setting is the actual accessibility requirement (WCAG "resize text");
it matters most to the learners who need it, and it is a risk to every fixed-size element in the app (fretboard
gutter, note slots, banners). It is also the item the audit marked "not verified" (A5).

**Independent Test**: Set the device text size to its maximum and walk the core loop — listen, answer, see the
result, open progress, open settings — confirming every control stays visible and operable and no text is clipped
or overlapped.

**Acceptance Scenarios**:

1. **Given** the device text size is at its maximum, **When** the learner completes one practice round, **Then**
   every control remains on screen, reachable (scrolling allowed where the content is long), and no text is
   truncated without a way to read it.
2. **Given** the fretboard is on screen at a large text size, **When** the learner views it, **Then** the fret
   numbers and string labels stay legible and aligned with their frets/strings, and the board does not grow beyond
   its screen.
3. **Given** the device text size is at its maximum, **When** the verdict, rank-change banner or tuning advisory
   appears, **Then** its text is fully readable and does not overlap other elements.

---

### User Story 3 - Text and marks I can tell apart (Priority: P2)

As a learner with low vision or in bright light, I want text and the fretboard's marks to have enough
contrast against their background, and I want results to be distinguishable without relying on colour alone.

**Why this priority**: Contrast is the second half of "readable"; the audit found specific failures
(fret numbers, matched/wrong marker fills). Smaller in effect than size, but cheap to fix and a Constitution III
requirement.

**Independent Test**: Compute the contrast ratio of every text/background pair in the theme and of the
fretboard's result markers; confirm each meets its threshold, and view a result with colour removed to confirm the
verdict is still understandable.

**Acceptance Scenarios**:

1. **Given** any text style in the theme, **When** its contrast against the background it appears on is
   measured, **Then** it is at least 4.5 : 1 (3 : 1 for text at or above the "large text" size).
2. **Given** a graded answer shown on the fretboard, **When** viewed in greyscale, **Then** matched, wrong and
   extra notes are still told apart (by shape, label or position, not hue alone).
3. **Given** the fret numbers on the fretboard, **When** measured, **Then** they meet the text contrast threshold
   (the audit measured 3.7 : 1, below 4.5).

---

### User Story 4 - Using the app with a screen reader (Priority: P2)

As a learner who uses VoiceOver or TalkBack, I want to hear what each control does and what has happened — notes
I placed, the verdict, a change of rank — so that I can operate the core loop without seeing the screen.

**Why this priority**: Required by Constitution III and SC-009. Lower than text size because the app is
inherently visual (a fretboard) and the affected audience is smaller, but unlabeled state changes are a defect
regardless.

**Independent Test**: With a screen reader on, complete one practice round on the fretboard: place notes, hear
which cells hold notes, submit, hear the verdict.

**Acceptance Scenarios**:

1. **Given** a note has been placed on a fret cell, **When** the screen reader focuses that cell, **Then** it
   announces the string, the fret and that a note (with its order number) is placed there.
2. **Given** the learner places a note, submits an answer, or the difficulty rank changes, **When** the change
   occurs, **Then** the screen reader announces it without the learner having to find it.
3. **Given** the read-only result board, **When** focused, **Then** it reads as one summary (what was matched,
   what was wrong) rather than as dozens of unlabeled cells.
4. **Given** the fretboard's 78 cells, **When** a screen-reader user wants to reach the controls beneath it,
   **Then** they are not forced to swipe through every cell.

---

### User Story 5 - Targets that are big enough to hit (Priority: P3)

As a learner with imprecise touch, I want controls and fret cells large enough to tap reliably.

**Why this priority**: Controls already pass. The one failure — fret cells ≈ 51 × 29 pt against a 44 pt minimum —
is **structural** on short phones: 13 frets need ≈ 570 pt of neck for 44 pt cells, more than a phone leaves under the header, slots and controls. First reclaim every free pixel (FR-009); whatever gap remains is a product decision, and the story is last because it may end as a documented exemption.

**Independent Test**: Measure each interactive element on a reference phone; confirm controls meet the minimum and
the fret-cell outcome matches the decision recorded in FR-009.

**Acceptance Scenarios**:

1. **Given** any interactive control other than a fret cell, **When** measured on a 360 × 640 dp phone, **Then**
   it is at least 48 × 48 dp (44 × 44 pt on iOS).
2. **Given** the answer view, **When** the fretboard is measured on the iPhone 17 Pro and on the 360 × 640 dp
   reference phone, **Then** no vertical space is unused, rows are ≥ 30 pt (the board scrolls below that), and the cell height is recorded against the 44 pt / 48 dp target as the accepted exception of FR-009.

---

### Edge Cases

- **Device text size above the app's supported maximum**: the app must still work, capped at the supported maximum rather than breaking (see FR-004).
- **Very small screens** (e.g. 320 dp wide) at maximum text size: content scrolls instead of clipping; the fretboard keeps its fixed geometry.
- **Text that grows inside fixed-size shapes** (note slots, rank badges, buttons): the shape grows or the text wraps; it is never cut.
- **Dark/low-light use**: contrast is verified for the single supported theme; there is no light theme to check.
- **Localisation**: a longer translation behaves like larger text — the layout rules apply equally (the app is English-only today).
- **Reduced-motion and screen-reader focus order**: the order matches the visual reading order top-to-bottom.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: No text in the app MUST render below **12 sp** at the device's default text size; body text MUST be at least **16 sp**, captions and labels at least **12 sp**. (Today the smallest sizes are 10–11, used for fret numbers and labels.)
- **FR-002**: All text sizes MUST come from **one shared size scale** (heading / body / label / caption steps) defined in the theme; hand-written sizes in screens and components MUST NOT exist, and an automated check MUST fail the build if one is added.
- **FR-003**: Text MUST scale with the device's text-size setting on every screen.
- **FR-004**: The app MUST support text scaling up to **200 %** of the default and MUST keep working above that by capping, never by breaking. Elements whose geometry is fixed (the fretboard's fret numbers and string labels) MUST cap at a smaller scale (default **130 %**) so they stay aligned with the frets and strings.
- **FR-005**: At the maximum supported scale, every screen MUST keep every control visible and operable, with no clipped, overlapping or truncated-without-recourse text; long content scrolls.
- **FR-006**: Every text/background pair MUST meet contrast **≥ 4.5 : 1** (≥ 3 : 1 for large text), including the fretboard's fret numbers and the result markers' text.
- **FR-007**: Result meaning (matched / wrong / missed / extra) MUST NOT depend on colour alone; each status MUST also be distinguishable by shape, text or position.
- **FR-008**: Every interactive control MUST expose an accessible label and role (already true today — this MUST NOT regress), and state changes MUST be announced: a note placed or removed, a graded verdict, a difficulty-rank change, the "N of M placed" count.
- **FR-009**: The answer view MUST give the fretboard every free pixel: while it is on screen it shows no "PRACTICE" kicker or level badge, and a screen under a navigation header MUST NOT pad for the top safe-area inset a second time. The board MUST **adapt to the height the phone leaves it**, so the whole neck (nut to fret 12) is visible without scrolling on current phones, with the prompt, the "N of M placed" caption, the note slots and the controls fixed. Fret rows MUST NOT get shorter than **30 pt**; on a phone too short for 13 rows at that height the board scrolls instead of squeezing further. The 44 pt (iOS) / 48 dp (Android) touch-target minimum is **not met for fret cells**: this is an **owner-accepted exception** (2026-10-11 — a 44 pt floor needs ≈ 570 pt of neck and forced scrolling on every phone, which the owner rejected). Measured on an iPhone 17 Pro (402 × 874 pt): cells ≈ 37 pt, no scroll. Android 360 × 640 dp **not yet measured** (estimate ≈ 20 dp, so it would scroll).
- **FR-010**: Every interactive control other than a fret cell MUST be at least 48 × 48 dp (44 × 44 pt on iOS).
- **FR-011**: The read-only result board MUST present as a single accessible summary element, not as individually focusable cells; the answer board MUST let a screen-reader user bypass its cells to reach the controls beneath it.
- **FR-012**: The screen-reader and text-size behaviour MUST be verified on a **physical Android device** (TalkBack, largest text size) and recorded in the quickstart (F8), since neither can be exercised by the unit-test runner.

### Key Entities *(include if feature involves data)*

- **Text size scale**: the named set of sizes (heading, body, label, caption, …) each with a pixel size and a maximum scale factor; the single source for every text style.
- **Contrast pair**: a text colour and the background it sits on, with its measured ratio and the threshold it must meet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of text on all four screens renders at or above the minimum size (FR-001) at default text size; an automated check proves no text style lies outside the shared scale (FR-002).
- **SC-002**: At the device's maximum text size, a learner completes one full practice round (listen → answer → result → open progress → open settings) with no clipped or overlapping text and no unreachable control, on a 360 × 640 dp reference phone.
- **SC-003**: Every theme text/background pair measures ≥ 4.5 : 1 (≥ 3 : 1 for large text) — verified by an automated contrast check over the theme tokens.
- **SC-004**: With TalkBack on, a learner completes one fretboard round and hears every placed note, the verdict and any rank change announced, without sighted help (owner-observed on a physical device).
- **SC-005**: The audit in `specs/001-guitar-ear-training/checklists/fretboard-a11y.md` is re-run and shows **no failures**, with the A1 fret-cell outcome recorded per FR-009; SC-009 and tasks T051/T076 of spec 001 are closed against this spec.
- **SC-006**: The release's CRITICAL finding from the last `/speckit-analyze` pass (T085, "T076/SC-009 open") is cleared.

## Assumptions

- **Single theme**: the app has one (dark) theme, so contrast is verified once, not per theme.
- **System font**: the app keeps using the platform's system typeface; no custom font is introduced (consistent with `src/theme/nocturne.ts`).
- **Verification approach**: the unit-test runner is Node-only (no component rendering), so size-scale and contrast rules are enforced by tests over the pure theme data and by a source check for stray hand-written sizes; scaling and screen-reader behaviour are verified on a physical device (FR-012).
- **Reference device**: a 360 × 640 dp Android phone is the smallest layout the release must support.
- **Scope**: the four existing screens and the shared components; no new feature UI. New screens (e.g. sign-in, spec 005+) must be built on the same scale from the start, and are out of scope here.
- **Not in scope**: voice control, haptic or audio-only alternatives to the fretboard, a high-contrast theme, reduced-motion settings, and any change to how melodies are chosen or graded.
- **Dependency**: spec 001's `fretboard-a11y.md` audit is the baseline; its four "cheap fixes" are folded into FR-006/FR-008/FR-011.
