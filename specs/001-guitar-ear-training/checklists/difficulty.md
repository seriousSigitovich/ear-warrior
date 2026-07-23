# Adaptive Difficulty Requirements Checklist: Guitar Ear Training — Melody Recall & Playback Feedback

**Purpose**: Validate the quality, clarity, completeness, and consistency of the **adjustable & adaptive
difficulty requirements** (US2 / FR-010 / FR-011) before planning and implementing them. This is a
requirements-quality gate ("unit tests for the spec"), not an implementation test.
**Created**: 2026-07-23
**Feature**: [spec.md](../spec.md)
**Audience / timing**: Author, before planning the US2 slice (T038–T041).

## Requirement Completeness — The Level Set

- [x] CHK001 Is the total number of difficulty levels specified, rather than left as "multiple"? [Clarity, Spec §FR-010]
- [x] CHK002 Are the concrete parameters (noteCount, low/high pitch bound, scale, tempo) defined for **every** level, not just the easiest? [Completeness, Spec §FR-010 / §Key Entities]
- [x] CHK003 Are the specific scales/modes that levels draw from named anywhere in the spec? The spec references "scale/key" abstractly but never enumerates a single concrete scale. [Gap, Spec §FR-001 / §FR-010]
- [x] CHK004 Is it specified whether the **key/root** varies across levels or stays fixed, given FR-001 names "scale/key" as part of the pitch pool? [Gap, Spec §FR-001]
- [x] CHK005 Is the rule defined for **which** difficulty dimensions change between adjacent ranks — do noteCount, range, scale, and tempo advance together or independently? [Gap, Spec §FR-010]
- [ ] CHK006 Is the default starting level for a **brand-new learner** with no history specified? [Gap, Spec §FR-011]
- [x] CHK007 Is it specified whether a **returning** learner resumes at their last reached level or restarts lower? [Gap, Spec §FR-011 / §Key Entities Session]
- [x] CHK008 Is a requirement stated that each level's range + scale must yield enough distinct pitches to satisfy the no-consecutive-repeats constraint? [Gap, Spec §FR-001]

## Requirement Clarity & Measurability — The Adaptation Rule

- [x] CHK009 Is "adapt difficulty based on **recent performance**" quantified with a specific evaluation window (last N attempts, current session, rolling average)? [Ambiguity, Spec §FR-011]
- [x] CHK010 Is "several melodies correctly in a row" replaced with a concrete streak count for raising difficulty? [Ambiguity, Spec §US2 AS-2]
- [x] CHK011 Is "fails several melodies in a row" quantified, and is it stated whether the raise and lower thresholds are symmetric? [Ambiguity, Spec §US2 AS-3]
- [x] CHK012 Is the **step size** of an adjustment defined — always one rank, or can difficulty jump multiple ranks? [Gap, Spec §FR-011]
- [x] CHK013 Can "the difficulty increases (**e.g.**, more notes, wider range, or faster tempo)" be objectively verified? The "e.g." leaves the actual changed dimension unspecified, so the acceptance scenario has no single pass condition. [Measurability, Spec §US2 AS-2]
- [x] CHK014 Can "decreases to a **more achievable** level" be objectively measured? [Measurability, Spec §US2 AS-3]
- [x] CHK015 Is there a requirement that rank order corresponds to monotonically increasing difficulty, and is "harder" defined in measurable terms? [Gap, Spec §Key Entities DifficultyLevel]
- [x] CHK016 Is adaptation defined as consuming the **binary** correct/incorrect verdict, or per-note accuracy? A 7-of-8 attempt and a 0-of-8 attempt are both "incorrect" under FR-005. [Clarity, Spec §FR-005 / §FR-011]

## Scenario Coverage — Which Attempts Count Toward Adaptation

- [x] CHK017 Is it specified whether a **retry** of the same melody counts toward the win/loss streak, given retries are unlimited under FR-008? [Gap, Spec §FR-008 / §FR-011]
- [x] CHK018 Is it specified whether a **low-confidence, ungraded** attempt counts toward, breaks, or is excluded from the streak? Counting these would demote a learner for room noise rather than for ability. [Gap, Spec §FR-017 / §FR-011]
- [x] CHK019 Is it specified whether a **timed-out / no-input** attempt affects difficulty? [Gap, Spec §FR-015 / §Edge Cases]
- [x] CHK020 Is it specified whether an attempt graded after the learner **dismissed the out-of-tune advisory** counts normally toward adaptation? [Gap, Spec §FR-014]
- [x] CHK021 Are requirements defined for whether streak state **persists across sessions** or resets at each session start? [Gap, Spec §FR-011 / §Key Entities Session]
- [x] CHK022 Are requirements defined for what happens to accumulated streak state **when the level changes** — does it reset on adjustment? [Gap, Spec §FR-011]
- [ ] CHK023 Is it specified whether and how the learner is **informed** that difficulty changed, given Constitution III requires predictable behavior? [Gap, Spec §US2, Constitution §III]

## Edge Case Coverage — Boundaries & Mode Switching

- [x] CHK024 Are requirements defined for continued success **at the maximum level** and continued failure **at the minimum level**? [Gap, Edge Case, Spec §FR-011]
- [x] CHK025 Are requirements defined to prevent **oscillation** (repeated raise/lower thrashing) — e.g. hysteresis, cooldown, or asymmetric thresholds? [Gap, Edge Case, Spec §FR-011]
- [x] CHK026 Are requirements defined for switching **from adaptive to fixed mid-session and back** — does adaptive resume from the manually chosen level or the previously adapted one? [Gap, Edge Case, Spec §FR-011 / §US2 AS-4]
- [x] CHK027 Is it specified whether manual fixed mode may select **any** level or only levels already reached? [Gap, Spec §US2 AS-4]
- [x] CHK028 Are requirements defined for persisting the **difficulty mode and chosen level across app restarts**, consistent with the interrupted-session edge case? [Gap, Spec §Edge Cases]
- [ ] CHK029 Are requirements defined for stored attempts referencing a **level id that a later release removes or renumbers**, given `Melody.difficultyId` and `Session.currentDifficultyId` are persisted foreign keys? [Gap, Edge Case, Spec §Key Entities]

## Requirement Consistency

- [x] CHK030 Do SC-005 ("at least 2 … up to **at least** 8 notes") and the data model ("2 at easiest … **up to** 8") agree on whether 8 is a cap or a floor for the top level? [Conflict, Spec §SC-005 / §data-model]
- [ ] CHK031 Is `difficultyReached` = "max rank with **sustained success**" defined with the same threshold as the adaptation rule, or is it a second, independent undefined threshold? [Consistency, Spec §data-model ProgressProfile / §FR-011]
- [ ] CHK032 US1's independent test claims it is testable "with no difficulty settings present" — is the level US1 operates at in that state explicitly specified? [Consistency, Spec §US1]

## Dependencies & Assumptions

- [x] CHK033 Is the assumption that **higher tempo increases difficulty** validated, given rhythm is explicitly not graded (pitch-first grading) and tempo therefore only affects playback speed? [Assumption, Spec §Assumptions / §FR-010]
- [x] CHK034 Is the interaction between **widening pitch range and default octave sensitivity** addressed — as levels span more than one octave, octave-mismatch failures become structurally more likely? [Assumption, Spec §Assumptions / §FR-010]
- [ ] CHK035 Are performance targets declared for the adaptation decision so it cannot delay the next melody beyond the 15-second cycle budget? [Gap, Spec §SC-001, Constitution §IV]

## Notes

- Check items off as completed: `[x]`
- Items marked `[Gap]` indicate the requirement is **absent** from spec.md and needs to be written, not merely clarified.
- CHK017–CHK022 are the highest-risk cluster: the adaptation rule consumes attempt outcomes, but the spec
  defines several attempt outcomes (retry, low-confidence, timeout, tuning-advisory-dismissed) without
  saying how any of them feed the streak.
- CHK003 is a hard blocker for T038 — the level ladder cannot be authored while the scale vocabulary is undefined at spec level.
