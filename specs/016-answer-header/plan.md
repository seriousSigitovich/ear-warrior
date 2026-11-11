# Implementation Plan: A Lighter Answer Screen

**Branch**: `016-answer-header` (not created — work lands on `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Summary

`SLOT_MAX`/`SLOT_MIN` in `src/lib/fretboardLayout.ts` halve (their tests are updated first). The Draft pill moves out
of `FretboardAnswer` into its own `DraftSwitch` component, which the practice screen puts in the navigation bar with
`Stack.Screen` options (`headerRight`) only while answering.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | The switch gets its own file; `FretboardAnswer` loses its toggle prop | ✅ |
| II. Test-first | Layout tests are changed before the constants | ✅ |
| III. UX consistency | Same pill, role and wording; the bar is where screen-level controls live | ✅ |
| IV. Performance | None | ✅ |

## Source Code

```text
src/lib/fretboardLayout.ts                  # SLOT_MAX 20, SLOT_MIN 16
src/components/practice/DraftSwitch.tsx     # NEW (moved out of FretboardAnswer)
src/components/practice/FretboardAnswer.tsx # − the switch and onToggleDraft; smaller slot text
app/practice.tsx                            # headerRight while answering
tests/unit/lib/fretboardLayout.test.ts      # updated for the new sizes
```
