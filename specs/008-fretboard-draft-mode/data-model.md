# Data Model: Fretboard Draft Mode

Nothing is stored or synced. One in-memory state per visit to the practice screen.

## DraftState (`src/lib/draft.ts`)

| Field | Type | Meaning |
|-------|------|---------|
| `on` | boolean | Draft mode is on; taps only sound |
| `usedOnPhrase` | boolean | Draft was on at some point while answering the current phrase |

Initial: `{ on: false, usedOnPhrase: false }` (each visit).

## Events (reducer input)

| Event | Result |
|-------|--------|
| `toggle` | `on = !on`; when turning on: `usedOnPhrase = true`, and the caller must send `draft_on` |
| `phraseChecked` | returns `draft = usedOnPhrase` for `answer_check`; then `usedOnPhrase = on` (a retry or the next phrase starts "used" only if draft is still on) |
| `phraseStarted` | `usedOnPhrase = on` |

Validation: toggling is allowed only while answering (screen enforces: the toggle is shown only on the answer view).
