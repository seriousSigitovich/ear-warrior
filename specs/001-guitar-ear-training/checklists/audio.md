# Audio & Pitch Correctness Checklist: Guitar Ear Training — Melody Recall & Playback Feedback

**Purpose**: Validate the quality, clarity, completeness, and consistency of the **audio & pitch-detection
correctness requirements** (note matching, segmentation, tuning, octave, monophony) before implementation.
This is a requirements-quality gate ("unit tests for the spec"), not an implementation test.
**Created**: 2026-07-22
**Feature**: [spec.md](../spec.md)
**Audience / timing**: Reviewer, during spec/PR review before `/speckit.tasks`.

## Requirement Completeness

- [ ] CHK001 Is the reference tuning standard (e.g., concert pitch A=440 Hz) explicitly specified for interpreting detected frequencies as notes? [Gap]
- [ ] CHK002 Is the exact playable pitch range (concrete low/high note bounds) for generated melodies quantified rather than left as "standard guitar range"? [Clarity, Spec §FR-001 / §Assumptions]
- [ ] CHK003 Are requirements defined for how a continuous guitar performance is divided into discrete notes (onset / note-boundary detection)? [Gap, Spec §FR-004]
- [ ] CHK004 Is the minimum sustained duration or signal strength for a sound to count as a played note specified? [Gap]
- [ ] CHK005 Are requirements defined for detecting two consecutive same-pitch notes as separate notes rather than one sustained note? [Gap, Edge Case]
- [ ] CHK006 Is the capture window specified — when note capture opens after playback ends and how long it stays open? [Gap, Spec §FR-015]
- [ ] CHK007 Are the standard-tuning reference notes (E-A-D-G-B-E) that the tuning check compares against documented as requirements? [Gap, Spec §FR-014]

## Requirement Clarity & Measurability

- [ ] CHK008 Is the note-match tolerance quantified with a specific cents value instead of "normal tuning deviation"? [Ambiguity, Spec §FR-016]
- [ ] CHK009 Is the low-confidence threshold that triggers a retry defined with a measurable value? [Clarity, Spec §FR-017]
- [ ] CHK010 Is "consistently out of tune" quantified (offset magnitude and how many notes) for triggering the tuning warning? [Ambiguity, Spec §FR-014]
- [ ] CHK011 Is "reasonably quiet environment" defined with a measurable noise floor or signal-to-noise threshold? [Ambiguity, Spec §Assumptions / §SC-002]
- [ ] CHK012 Is the no-input timeout expressed as a concrete duration? [Clarity, Spec §FR-015]
- [ ] CHK013 Is the attempt-level confidence value's derivation from per-detection clarity specified measurably? [Clarity, Spec §FR-017]
- [ ] CHK014 Can "the same notes in the same order" be objectively evaluated given the defined tolerance and alignment rules? [Measurability, Spec §US1 / §FR-005]

## Requirement Consistency

- [ ] CHK015 Is the "wrong octave counts as incorrect" rule stated consistently between the Assumptions and the note-match / verdict requirements? [Consistency, Spec §Assumptions / §FR-005 / §FR-016]
- [ ] CHK016 Is the octave-sensitivity rule reconcilable with the "a different semitone never matches" rule, given an octave spans 12 semitones? [Consistency, Spec §FR-016]
- [ ] CHK017 Is the pitch-first-only grading scope (rhythm/timing excluded) stated consistently across every correctness requirement, with no requirement implying timing is graded? [Consistency, Spec §Assumptions / §FR-005]
- [ ] CHK018 Is the overall-verdict rule ("correct" only if all target notes matched and no extra notes) stated in the requirements themselves, not solely in downstream design docs? [Consistency, Spec §FR-005]
- [ ] CHK019 Are the note-result categories (matched / wrong / missed / extra) defined consistently everywhere grading feedback is described? [Consistency, Spec §FR-005 / §FR-006]
- [ ] CHK020 Do the generator's pitch-pool (scale/range) requirements align with the notes the detector/grader is required to recognize? [Consistency, Spec §FR-001 / §FR-004]

## Scenario & Edge Case Coverage

- [ ] CHK021 Are requirements defined for accidental polyphony (a chord or overlapping ringing strings) given the monophonic assumption? [Coverage, Gap, Spec §Assumptions]
- [ ] CHK022 Are requirements specified for pitch glides — bends, slides, vibrato — that move continuously between notes during a sustained sound? [Edge Case, Gap]
- [ ] CHK023 Is sequence-alignment behavior defined when the learner inserts an extra note mid-phrase (does one insertion cascade following notes to "wrong")? [Ambiguity, Spec §FR-005]
- [ ] CHK024 Are requirements defined to distinguish inter-note gaps (hesitant playing) from an end-of-attempt gap? [Coverage, Spec §Edge Cases]
- [ ] CHK025 Is the post-tuning-warning state defined — is grading blocked until retune, or may the learner proceed? [Gap, Spec §FR-014]
- [ ] CHK026 Are open-string ring-out and fret-buzz artifacts addressed in the input-handling / low-confidence requirements? [Edge Case, Gap, Spec §FR-017]

## Acceptance Criteria Quality

- [ ] CHK027 Does SC-002's "normal conditions" enumerate the measurable preconditions (tuning accuracy, noise level, tempo) under which the ≥95% agreement is claimed? [Measurability, Spec §SC-002]
- [ ] CHK028 Is a repeatable method defined for establishing the "human evaluator" ground truth that SC-002 is measured against? [Measurability, Spec §SC-002]
- [ ] CHK029 Are per-note correctness outcomes tied to measurable acceptance criteria, not just the overall pass/fail verdict? [Acceptance Criteria, Spec §FR-005 / §FR-006]

## Dependencies & Assumptions

- [ ] CHK030 Is the assumption that the microphone reliably captures the guitar (acoustic and amplified) bounded or validated (distance, input gain, device variance)? [Assumption, Spec §Assumptions]
- [ ] CHK031 Is the standard-6-string-tuning dependency stated as a validated precondition, including defined behavior if a non-standard tuning is used? [Assumption, Spec §Assumptions]

## Ambiguities & Traceability

- [ ] CHK032 Is a requirement/acceptance-criteria ID scheme sufficient to trace every audio/pitch correctness rule, including rules that currently live only in `research.md` and `contracts/` rather than the spec? [Traceability]

## Notes

- Check items off as completed: `[x]`; add findings inline.
- An unchecked item means the **requirement text** needs tightening (quantify, add, or reconcile) — it is not a code defect.
- Highest-priority gaps to resolve before implementation: **CHK008** (match tolerance in cents), **CHK003/CHK005** (note segmentation & repeated notes), **CHK023** (alignment on extra/missing notes), and **CHK027** (measurable conditions for SC-002). Several are strong candidates for `/speckit.clarify`.
