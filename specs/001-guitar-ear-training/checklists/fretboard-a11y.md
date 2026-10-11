# Checklist: Fretboard accessibility audit (SC-009, Constitution III)

**Date**: 2026-10-11 · **Scope**: fretboard answer view and result view (FR-020) · **Method**: code review of
`src/components/fretboard/Fretboard.tsx`, `src/components/practice/FretboardAnswer.tsx`,
`src/components/controls/FretboardControls.tsx`, contrast computed from `src/theme/nocturne.ts`, and cell size
measured from a screenshot on an iPhone 17 Pro simulator (402 × 874 pt). **Not done**: a VoiceOver/TalkBack
run and a largest-font-scale run — those need a device (quickstart F8).

## Result: NOT compliant with SC-009 as written — 1 failure, 3 partials

| ID | SC-009 requirement | Result | Evidence |
|----|--------------------|--------|----------|
| A1 | Touch targets ≥ 44 pt (iOS) / 48 dp (Android) | ❌ **Fail** (fret cells) · ✅ pass (controls) | A fret cell is ≈ **51 × 24 pt**: 16 rows share the board height (`rowFlex`, `minHeight: 22`), ≈ 54 px/row on the 920 px-wide screenshot. Width is fine; height is about half the target. Controls pass: `IconButton` 52 × 52, `Check` `minHeight: 52`. The result-view board is read-only (`rowHeight` 26) so it has no touch targets |
| A2 | Accessible label + role on every interactive control | ✅ Pass | Every fret cell: `accessibilityRole="button"`, label `"{E} string, fret N"` / `"open"`. Replay, Undo, Clear, Check carry labels; disabled state is exposed via `accessibilityState` (`Button`, `IconButton`) |
| A3 | Text contrast ≥ 4.5 : 1 | ⚠️ Partial | Body text on surface 12.6; string labels (`textAlpha[55]`) 4.8; accent text on bg 5.5; marker numbers 4.6–7.3 — pass. **Fret numbers (`textAlpha[45]`, 10 pt) = 3.7 — fail**. Non-text: string lines on the high strings ≈ 2.3 : 1 (< 3 : 1), decorative since strings are also labelled |
| A4 | Operable with VoiceOver/TalkBack, logical order | ⚠️ Partial | (a) **96 separate stops** (6 × 16; now 78 = 6 × 13) with no grouping or shortcut. (b) A placed note is **not announced**: the marker is `pointerEvents="none"` with no label, and the cell label does not change, so a screen-reader user cannot tell which cells hold notes. (c) The "N of M placed" caption and the verdict change without an announcement. (d) The result-view board cells are unlabelled `View`s — the status is exposed only by the note chips (which do carry labels) |
| A5 | Layout intact at the largest font scale | ❓ Not verified | Text scales (no `allowFontScaling={false}` anywhere), but the fret-number gutter is a fixed 28 pt, the slots are 40 pt circles, and the caption wraps above a flex board — needs a device run |
| A6 | Meaning not carried by colour alone | ⚠️ Partial | Result markers: matched = solid accent fill with dark number; wrong = tinted outline with warm number (the two fills differ by only 1.35 : 1, so the distinction leans on fill style and colour). The adjacent note chips state the status in text, which covers it |

> **Update 2026-10-11**: the owner shortened the neck to 12 frets (13 rows instead of 16, FR-020, T087). Re-measured
> in the simulator on the same screen: a cell is now ≈ **51 × 29 pt** (was ≈ 51 × 24). Still below 44 pt, so the
> A1 decision below stands; A4(a) is now 6 × 13 = 78 stops instead of 96.

## Why A1 is structural

16 frets must fit in the vertical space left under the header, slots and controls. At 44 pt the neck would
need 704 pt; the board gets ≈ 395 pt. Roughly 100 pt of blank space above the "PRACTICE" row is not used by
the answer view, which would lift the cell to ≈ 30 pt — still short. So this cannot be fixed by padding.

## Decision needed (owner)

- **Option 1 — amend the baseline**: record a documented exemption in SC-009 for fret cells (a dense
  instrument grid; width ≥ 48 pt, height ≈ 24–30 pt; a real fretboard is not larger), with the owner's
  hands-on acceptance. Consistent with how SC-010 was handled. Cheapest.
- **Option 2 — change the design**: show fewer frets at once (e.g. open + 0–7, then a toggle or scroll to
  8–15) so cells reach 44 pt. Costs the "whole neck at a glance" the design is built on.

## Cheap fixes regardless of the option (not applied — audit only)

1. Raise fret-number contrast (`textAlpha[45]` → `[60]`) — A3.
2. Give each cell a state: when a note sits there, label `"{E} string, fret N, note {k}"` and set
   `accessibilityState={{ selected: true }}` — A4(b).
3. Announce placement and the verdict (`AccessibilityInfo.announceForAccessibility`) — A4(c).
4. Label the result-view cells or mark the read-only board `accessible` as a single element with a summary
   label — A4(d).
