# Implementation Plan: A Simpler Practice Flow

**Branch**: `014-practice-flow` (not created — work lands on `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Summary

In the practice loop a phrase is no longer a phase of its own: `playPhrase` sets `awaitingInput` first and plays the
phrase through the existing replay mechanism (`replaying`), so a tap or Check cuts it as any replay. `serve` goes
straight to phrase 1 (no whole-melody intro). A new `hearWhole` plays the whole melody the same way. The loop reports
`ready` once the learner's level is loaded, and the practice screen auto-starts on it. An option `listenFirst` keeps the
old listening phase for the coached first melody only. Pause/restart/skip, the playback service's pause/resume and the
Listening stage are deleted.

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native) · **Dependencies**: none new · **Storage**: none

**Testing**: Jest covers the playback contract (pause removed again) and the unchanged pure logic; the loop is a hook
and the screens are `.tsx`, which the pure-logic runner cannot run — they are checked on the emulator (documented
limitation, as for specs 008–013).

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Net deletion: one phase, three controls, pause/resume and a stage go; no flag where the default can change | ✅ |
| II. Test-first | Pure logic is untouched; the hook/screens cannot be unit-tested here → emulator checklist in tasks | ⚠️ noted |
| III. UX consistency | Same Nocturne components; the answer screen already had the "Listening…" caption | ✅ |
| IV. Performance | The first phrase starts without waiting for a screen change | ✅ |

## Source Code

```text
src/features/practice/usePracticeLoop.ts      # − listening phase, intro, pause/restart/skip; + autostart ready, hearWhole, listenFirst
src/services/audio/playback.ts                # pause/resume removed again (back to the pre-009 contract)
src/components/controls/TransportControls.tsx # − the listening buttons
src/components/practice/PracticeStage.tsx     # − the Listening stage and the idle text
src/components/practice/PhraseProgress.tsx    # − the whole-melody stage
src/components/practice/FretboardAnswer.tsx   # + "Hear whole melody"
app/practice.tsx                              # autostart, no listening state, hear-whole wiring
app/first-melody.tsx                          # listenFirst: true
tests/contract/playback.test.ts               # pause tests removed
```
