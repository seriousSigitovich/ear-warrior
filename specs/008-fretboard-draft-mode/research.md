# Research: Fretboard Draft Mode

## R1. Where draft taps are routed

- **Decision**: a separate loop action `playFret(position)` (sound + stop replay); the screen calls it instead of
  `tapFret` while draft is on.
- **Rationale**: grading, persistence, sync, `answer_start` and the help logic all read `answer`. If draft taps never
  enter `answer`, FR-003/005/010 hold by construction — no filter to forget later.
- **Alternatives**: a `draft` flag inside `tapFret` (mixes two behaviours in one handler, the loop would need to know
  UI state); a second taps array in the loop (state nobody reads).

## R2. Where the draft state lives

- **Decision**: in `app/practice.tsx` (one visit), driven by a pure reducer in `src/lib/draft.ts`.
- **Rationale**: FR-007 — survives phrases and retries, resets on a new visit; the loop is unmounted with the screen,
  so screen state gives exactly that. A reducer keeps "used on this phrase" and "send draft_on now" testable.
- **Alternatives**: persisting in key-value storage (rejected in spec: a learner must never open practice with taps
  silently not answering).

## R3. Visual for a draft tap

- **Decision**: `flash` prop on `Fretboard` — `{ position, id }`; the cell renders a ring that fades from full to 0 in
  ~700 ms (native-driver opacity). `id` changes per tap so the same cell can flash again. Reduced motion: shown at
  fixed opacity and removed after the same time.
- **Rationale**: one ring, no trail (spec assumption); same pattern as the existing `HintRing`/`NudgeFrame`.

## R4. How draft is shown on screen (FR-006)

- **Decision**: header gets a toggle pill "Draft" (on: filled accent + "On" text); while on the title reads "Draft"
  and the caption "Try frets freely — nothing is placed or scored. Turn Draft off to answer."; answer slots are
  dimmed. Text carries the state, colour only reinforces it.
- **Alternatives**: toggle in the control row (Replay · Undo · Clear · Check is already full on a 360 dp phone).

## R5. Analytics

- **Decision**: new event `draft_on` {rank, phrase, phrases}; `answer_check` gets `draft: boolean`. `answer_check`
  then has 9 props (server limit 10). Server allowlist updated and deployed before the OTA (memory: funnel-analytics).
- **Alternatives**: per-tap events (rejected: spec forbids, and noise).

## R6. Onboarding screen

- **Decision**: `app/first-melody.tsx` untouched; `FretboardAnswer`'s new props are optional and default to off.
