# Tasks: Fretboard Draft Mode

**Input**: Design documents from `/specs/008-fretboard-draft-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: required (constitution II, test-first) for the pure logic and the server allowlist; `.tsx`/hooks are
checked on the emulator (quickstart.md) because the Jest runner is pure-logic only.

## Phase 1: Setup

None — no new dependency or config.

## Phase 2: Foundational

- [X] T001 Write failing tests for the draft reducer (initial off; toggle on sets usedOnPhrase and asks to track; toggle off keeps usedOnPhrase; phraseChecked returns the flag and resets it to `on`; phraseStarted sets usedOnPhrase = on) in tests/unit/lib/draft.test.ts
- [X] T002 Implement `DraftState`, `initialDraft`, `toggleDraft`, `draftPhraseChecked`, `draftPhraseStarted` per data-model.md in src/lib/draft.ts

## Phase 3: User Story 1 — Search for notes without filling the answer (P1) 🎯 MVP

**Goal**: a Draft toggle on the answer screen; draft taps sound and flash, the answer is untouched.
**Independent Test**: quickstart.md steps 1–7.

- [X] T003 [P] [US1] Write failing tests for `draftTapAnnouncement(midi)` → "C4, draft" and `draftToggleAnnouncement(on)` in tests/unit/lib/fretboardA11y.test.ts
- [X] T004 [US1] Implement both helpers in src/lib/fretboardA11y.ts
- [X] T005 [US1] Add `playFret(position)` (sound the tone, end a replay without restarting, answer untouched; no-op outside awaitingInput) to the loop and its returned object in src/features/practice/usePracticeLoop.ts
- [X] T006 [P] [US1] Add optional `flash?: { position; id } | null` to Fretboard: a ring on that cell fading out over ~700 ms (native driver; reduced motion: fixed opacity, removed after the same time) in src/components/fretboard/Fretboard.tsx
- [X] T007 [US1] Add optional `draft`, `onToggleDraft`, `flash`, `lastDraftMidi` props to FretboardAnswer: toggle pill (role switch, label "Draft mode", checked state, ≥44 dp), draft title/caption, dimmed slots, no nudge frame while on, draft announcements per contracts/ui-answer-screen.md in src/components/practice/FretboardAnswer.tsx
- [X] T008 [US1] Wire draft in app/practice.tsx: `useState(initialDraft)`, route taps (draft → `playFret` + flash id++, else `tapFret`), pass props to FretboardAnswer, call `draftPhraseStarted` on each new phrase key

**Checkpoint**: US1 works on the emulator; first-melody screen unchanged.

## Phase 4: User Story 2 — Nothing played in draft counts (P1)

**Goal**: draft taps never become attempts, grades, history, progress or `answer_start`.
**Independent Test**: quickstart.md "Data" section.

- [X] T009 [US2] Verify by code review that every grading/persist/sync/`answer_start` path in app/practice.tsx and src/features/practice/usePracticeLoop.ts reads only `answer`, and that `playFret` touches no state besides the replay; note the result in specs/008-fretboard-draft-mode/quickstart.md if anything needed fixing

## Phase 5: User Story 3 — Know how much draft is used (P2)

**Goal**: `draft_on` event and `draft` flag on `answer_check`.
**Independent Test**: toggle on once, Check → one `draft_on` row and `answer_check.draft = true`.

- [X] T010 [P] [US3] Write a failing test that POST /api/events accepts `draft_on` in server/src/routes/events.test.ts
- [X] T011 [US3] Add `'draft_on'` to EVENT_NAMES in server/src/routes/events.ts
- [X] T012 [P] [US3] Add `'draft_on'` to AppEventName in src/services/logging/eventLog.ts
- [X] T013 [US3] In app/practice.tsx send `draft_on` {rank, phrase, phrases} when the reducer asks to, and add `draft` (from `draftPhraseChecked`) to the `answer_check` props

## Phase 6: Polish

- [X] T014 Run `npm test`, `npm run lint`, `npm run format`, `npm run typecheck` and `cd server && npm test`; fix what fails
- [X] T015 Check the feature on the Android emulator per quickstart.md (incl. TalkBack labels)
- [X] T016 Mark the draft item done in docs/beta-checklist.md with the date and what was built
- [ ] T017 Release order (owner's go-ahead): deploy server first, then OTA with EXPO_PUBLIC_* inline (memory: ota-publish-env)

## Dependencies

- T001 → T002 → T008, T013
- T003 → T004 → T007
- T005, T006 → T007 → T008
- US2 (T009) after US1
- T010 → T011; T012 → T013; T011 deployed before T017's OTA
- Polish after all stories

## Parallel examples

- After T002: T003, T005, T006, T010, T012 touch different files.

## Implementation strategy

MVP = Phases 2–4 (draft works and cannot leak). US3 is small and ships in the same OTA, but only after the server
allowlist is deployed.
