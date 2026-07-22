<!--
SYNC IMPACT REPORT
==================
Version change: (template / unratified) → 1.0.0
Rationale: Initial ratification of the project constitution. MINOR/PATCH not
applicable; first adoption is a 1.0.0 baseline.

Modified principles: N/A (initial authoring)
Added principles:
  - I. Code Quality & Maintainability
  - II. Test-First & Comprehensive Coverage (NON-NEGOTIABLE)
  - III. User Experience Consistency
  - IV. Performance by Design
Added sections:
  - Quality & Performance Standards (Section 2)
  - Development Workflow & Quality Gates (Section 3)
  - Governance

Removed sections: None

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate is derived
     dynamically from this file; no structural change required, verified aligned.
  ✅ .specify/templates/spec-template.md — Success Criteria / measurable outcomes
     already support performance & UX principles; verified aligned.
  ✅ .specify/templates/tasks-template.md — Testing note updated to reflect the
     NON-NEGOTIABLE test-first principle (tests are required, not optional).
  ✅ .claude/skills/speckit-*/SKILL.md — Reviewed; use generic/agent-correct
     command references (hyphen form). No outdated references found.

Follow-up TODOs: None. All placeholders resolved; ratification date set to the
initial adoption date.
-->

# Ear Warrior Constitution

## Core Principles

### I. Code Quality & Maintainability

Code MUST be readable, self-consistent, and maintainable before it is considered
complete. Non-negotiable rules:

- Every change MUST pass automated linting and formatting; style is enforced by
  tooling, not by reviewer opinion. A green linter is a merge prerequisite.
- Public functions, modules, and exported types MUST have a single clear
  responsibility and a descriptive name. No dead code, no commented-out blocks,
  and no `TODO` left without an associated tracked issue.
- New code MUST match the conventions, naming, and structure of the surrounding
  code. Cross-cutting deviations require an explicit, documented decision.
- Complexity MUST be justified. Prefer the simplest solution that satisfies the
  requirement (YAGNI); any added layer of indirection, abstraction, or dependency
  MUST be defensible against a simpler alternative in review.

**Rationale**: Most software cost is incurred after the first write, during
reading and modification. Enforcing quality by tooling and convention keeps that
cost low and keeps review focused on correctness rather than formatting.

### II. Test-First & Comprehensive Coverage (NON-NEGOTIABLE)

Tests MUST be authored before or alongside the implementation they cover, and the
suite MUST be green before merge. Non-negotiable rules:

- New behavior MUST have failing tests written first (Red), then implementation
  to pass them (Green), then cleanup (Refactor). Bug fixes MUST include a
  regression test that fails without the fix.
- Every user-facing contract, public API, and inter-component boundary MUST have
  integration or contract tests. Core logic MUST have unit tests.
- The test suite MUST be deterministic and runnable locally and in CI with a
  single command. Flaky tests MUST be fixed or quarantined immediately, never
  ignored.
- Coverage MUST NOT regress on a change. Merges that lower coverage of touched
  code require explicit justification in review.

**Rationale**: Tests written first define the contract, catch regressions cheaply,
and are the only durable protection against fear-driven code rot. This principle
takes precedence over delivery speed.

### III. User Experience Consistency

The product MUST present one coherent experience across every surface and
interaction. Non-negotiable rules:

- Interaction patterns, terminology, error messages, and visual/textual
  conventions MUST be consistent across the application. Shared UX elements MUST
  come from a common, reusable source rather than per-feature reinvention.
- Every user-facing error MUST be actionable: it MUST state what happened and what
  the user can do next, in plain language, without leaking internal detail.
- Features MUST behave predictably: equivalent actions produce equivalent results,
  and destructive or irreversible actions MUST require explicit confirmation.
- Accessibility is a requirement, not an enhancement. User-facing surfaces MUST
  meet the project's stated accessibility baseline (keyboard operability, sufficient
  contrast, and labeled controls at minimum).

**Rationale**: Consistency is what makes a product learnable and trustworthy. A
coherent experience reduces user error, support load, and cognitive cost, and it
compounds as the surface area grows.

### IV. Performance by Design

Performance MUST be treated as a feature with explicit, measurable targets, not an
afterthought. Non-negotiable rules:

- Every feature with user-facing latency or throughput implications MUST declare
  performance targets (e.g., p95 latency, memory ceiling, throughput) in its spec
  or plan before implementation.
- Performance-sensitive paths MUST be measured against those targets before
  release. Optimization MUST be evidence-driven — profile first, then optimize the
  proven bottleneck. Speculative optimization is not permitted.
- Changes MUST NOT introduce a performance regression beyond the agreed budget for
  the affected path. Regressions require either a fix or an explicit, documented
  budget amendment.
- Resource usage (memory, network, storage, battery where applicable) MUST be
  bounded and predictable under expected and peak load.

**Rationale**: Performance regressions are cheap to prevent and expensive to
diagnose later. Declaring targets up front makes performance testable and keeps
"fast enough" an objective, agreed standard rather than a subjective debate.

## Quality & Performance Standards

These concrete standards operationalize the principles above and MUST hold for any
change to be mergeable:

- **Automated gates**: Linting, formatting, and the full test suite MUST pass in CI
  on every change. A failing gate blocks merge; gates MUST NOT be bypassed without a
  recorded, approved exception.
- **Definition of Done**: A change is done only when it has passing tests for its new
  behavior, updated documentation for any changed contract, no new linter warnings,
  and no unresolved performance-budget violations.
- **Performance budgets**: Each feature's declared targets are its budget. The default
  expectations, when a feature does not specify otherwise, are p95 interaction latency
  under 200ms for local/interactive operations and bounded, documented memory use.
  Deviations MUST be declared in the feature's plan.
- **UX baseline**: Shared components, copy conventions, and the accessibility baseline
  are authoritative; new surfaces reuse them rather than diverging.

## Development Workflow & Quality Gates

- **Specification first**: Non-trivial work flows through the Spec Kit lifecycle —
  specify → plan → tasks → implement. The plan's Constitution Check MUST be evaluated
  before implementation begins and re-checked after design.
- **Code review**: Every change MUST be reviewed before merge. Reviewers MUST verify
  compliance with all four core principles; a principle violation is a blocking review
  comment unless recorded in the plan's Complexity Tracking with justification.
- **Traceability**: Tasks MUST trace to user stories and requirements. Test tasks are
  required for behavior that the constitution mandates covering (see Principle II).
- **Incremental delivery**: Work MUST be sliced so each increment is independently
  testable and leaves the suite green. Broken states are not merged to the main line.

## Governance

This constitution supersedes other development practices where they conflict. All
plans, reviews, and merges MUST verify compliance with its principles.

- **Amendments**: Any change to this constitution MUST be proposed with a written
  rationale, reviewed, and approved before taking effect. Approved amendments MUST
  update the version, the amendment date, and the Sync Impact Report, and MUST
  propagate to dependent templates (`plan`, `spec`, `tasks`) and agent command docs.
- **Versioning policy**: This document is versioned with semantic versioning.
  MAJOR — backward-incompatible governance or principle removals/redefinitions;
  MINOR — a new principle or section, or materially expanded guidance;
  PATCH — clarifications, wording, and non-semantic refinements.
- **Compliance review**: Constitution compliance is checked at plan time (Constitution
  Check gate) and at review time. Justified exceptions MUST be recorded in the
  affected plan's Complexity Tracking; unjustified violations block merge.
- **Runtime guidance**: Use the Spec Kit templates in `.specify/templates/` and the
  agent command docs in `.claude/skills/` for day-to-day development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-07-22 | **Last Amended**: 2026-07-22
