# UI contract: answer screen with Draft

## Header (FretboardAnswer)

| State | Title | Caption | Slots | Toggle |
|-------|-------|---------|-------|--------|
| draft off, no notes | "Now play it back" | as today | as today | "Draft" outline pill |
| draft off, notes placed | "Your turn" | as today | as today | "Draft" outline pill |
| draft on | "Draft" | "Try frets freely — nothing is placed or scored. Turn Draft off to answer." | dimmed (opacity ~0.4), contents kept | "Draft · On" filled accent pill |
| replaying (either) | unchanged | "Listening… tap a fret to stop." | unchanged | unchanged |

While draft is on the neck is drawn in the palette's lavender (`colors.draft` = accent2 lines, `colors.draftSurface` = accentRamp 900 board): board background and frame,
strings, frets, nut, inlays and the draft-tap flash (owner, 2026-11-09; gold and blueprint blue tried first, rejected as off-palette).

The pulsing nudge frame shows only with draft off and no notes placed (draft on already means the learner is
tapping).

## Toggle accessibility

- role `switch`, label "Draft mode", `accessibilityState.checked` = on, hit area ≥ 44 × 44 dp.
- On change it announces "Draft on. Taps are not answers." / "Draft off. Taps place notes."

## Tap routing

| Draft | Tap does | Spoken |
|-------|----------|--------|
| off | `tapFret` (unchanged) | "C4, 3 of 8 placed" (unchanged) |
| on | `playFret`: sound, stop replay, flash cell | "C4, draft" |

## Controls (FretboardControls)

Unchanged: Replay/Stop, Undo, Clear, Check act on the placed answer; enabled state depends only on placed count.

## Fretboard `flash` prop

`flash?: { position: FretPosition; id: number } | null` — a ring on that cell fading out over ~700 ms; a new `id`
restarts it. Purely visual: the cell's label and selected state do not change.
