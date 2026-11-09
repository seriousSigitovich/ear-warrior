# Quickstart: validate Fretboard Draft Mode

## Automated

```bash
npm test -- tests/unit/lib/draft.test.ts tests/unit/lib/fretboardA11y.test.ts
npm run lint && npm run typecheck
cd server && npm test
```

Expected: all green; `events.test.ts` accepts `draft_on`.

## On the emulator (dev client)

1. Open Practice, let a phrase play, reach "Now play it back".
2. Tap **Draft** → title "Draft", caption says nothing is placed, slots dim, toggle shows "On".
3. Tap 10 frets → each sounds at once and flashes; slot row and Check stay unchanged.
4. Press Replay, tap a fret during it → replay stops, note sounds, slots unchanged.
5. Tap **Draft** off, tap a fret → first slot fills (story 1 / AS4).
6. Check → verdict for the placed notes only. Next phrase → Draft is still on.
7. Leave Practice and come back → Draft is off.
8. TalkBack: toggle reads "Draft mode, switch, on/off"; a draft tap reads "<note>, draft".

## Data (after one session)

- Local history: one attempt per checked phrase, none for a phrase only drafted.
- `/admin/funnel` / `app_events`: `draft_on` rows with rank/phrase/phrases; `answer_check` rows carry `draft`.
