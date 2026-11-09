# Implementation Plan: Fretboard Draft Mode

**Branch**: `008-fretboard-draft-mode` (not created — work lands on `master`) | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-fretboard-draft-mode/spec.md`

## Summary

A "Draft" toggle on the phrase answer screen. While it is on, a fret tap goes to a new `playFret` in the practice
loop — it sounds the note and stops a replay, but never touches the answer — and the board shows a short fading
flash on the tapped cell. Everything that grades, stores or syncs reads only the answer, so draft taps cannot leak
into scoring by construction. The per-visit draft state and the "was draft used on this phrase" flag live in a pure
reducer (`src/lib/draft.ts`, unit-tested); analytics gets one new event `draft_on` and a `draft` flag on
`answer_check`.

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native app); server TypeScript on Node (Fastify)

**Primary Dependencies**: React Native `Animated` (no new dependency); zod on the server event route

**Storage**: none — draft state is in-memory for one visit to the practice screen

**Testing**: Jest (ts-jest, node) for pure `.ts` in `tests/unit/`; `tsx --test` for `server/src/routes/events.test.ts`.
Hooks and `.tsx` are not unit-testable here (see memory: pure-logic runner) — they stay thin and are checked on the
emulator.

**Target Platform**: Android (beta) / iOS, via OTA for the app part

**Project Type**: mobile app + small Node backend

**Performance Goals**: draft tap sounds within the 200 ms interaction budget, same path as an answer tap (preloaded
samples, `playReferenceTone`)

**Constraints**: offline-capable (no network on a draft tap); server deploy must precede the OTA that sends
`draft_on` (unknown event names are rejected)

**Scale/Scope**: 1 screen (`app/practice.tsx`), 4 components touched, 1 new pure module, 1 server allowlist entry

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | One new pure module; components get small props; no new dependency; matches existing naming (`tapFret` → `playFret`, `hint` → `flash`) | ✅ |
| II. Test-first | Reducer, a11y wording and event allowlist get failing tests first; UI wiring is thin and checked on the emulator (documented limitation of the runner) | ✅ |
| III. UX consistency | Toggle built from existing Nocturne tokens/components; draft marked by text, not colour alone; a11y label/state/announcement | ✅ |
| IV. Performance | Draft tap uses the same preloaded tone path; the flash is a native-driver opacity animation | ✅ |

Post-design re-check: ✅ no violations, Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-fretboard-draft-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ui-answer-screen.md
│   └── analytics-events.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/lib/draft.ts                              # NEW pure reducer: on/off, used-on-phrase, what to track
src/lib/fretboardA11y.ts                      # + draftTapAnnouncement, draftToggleAnnouncement
src/features/practice/usePracticeLoop.ts      # + playFret(position): sound + stop replay, answer untouched
src/components/fretboard/Fretboard.tsx        # + flash?: { position, id } → fading ring on that cell
src/components/practice/FretboardAnswer.tsx   # + draft, onToggleDraft, flash; draft title/caption, dimmed slots
src/services/logging/eventLog.ts              # + 'draft_on' in AppEventName
app/practice.tsx                              # wires draft state, routes taps, sends draft_on / draft flag
server/src/routes/events.ts                   # + 'draft_on' in EVENT_NAMES

tests/unit/lib/draft.test.ts                  # NEW
tests/unit/lib/fretboardA11y.test.ts          # + draft wording
server/src/routes/events.test.ts              # + accepts draft_on
```

**Structure Decision**: existing single mobile app (`app/`, `src/`, `tests/unit/`) plus `server/`. Logic that can be
pure goes into `src/lib/` per project convention so it is unit-tested; React pieces only wire it.

## Complexity Tracking

None.
