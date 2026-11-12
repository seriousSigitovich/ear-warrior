# Feature Specification: Daily Challenges From the Admin

**Created**: 2026-11-12 | **Status**: Implemented (not deployed) | **Builds on**: [018-backend-challenges](../018-backend-challenges/spec.md)

**Input**: Owner (2026-11-12): "set daily challenges through the admin".

## Context

Spec 018 made the server decide the day's three challenges, but only through a generator in code. This adds a manual
override per calendar day, edited on an owner page. A day without an override keeps using the generator, so nothing
changes until the owner sets something, and the app is untouched (same answer shape, same validation).

## User Scenarios & Testing

### User Story 1 - Set a day's challenges (P1)

1. **Given** the owner opens `/admin/challenges`, **Then** they see the next 14 days, each marked manual or auto, with
   its three challenges and the all-done bonus.
2. **Given** a future day, **When** the owner saves three challenges and a bonus, **Then** `GET /api/challenges/today`
   for that date returns exactly them.
3. **Given** a day with a manual override, **When** the owner resets it, **Then** the day goes back to the generator.
4. **Given** the form is opened for a day with no override, **Then** it is prefilled with what the generator gives, so
   the owner edits instead of typing from scratch.

### User Story 2 - Bad input never reaches learners (P1)

1. **Given** a form the app would reject (wrong type, target out of range, too long text, bonus out of range), **When**
   saved, **Then** nothing is stored and the form is shown again with the reasons and the entered values.
2. **Given** two slots with the same type and target, **Then** ids stay unique within the day.

### Edge Cases

- Today and past days are read-only: a device keeps the day's challenges once it has fetched them, so a change would
  reach only part of the learners. The earliest editable day is tomorrow (UTC). A day east of UTC may already be
  "today" for some learners; the page says so.
- Days more than 90 days ahead are refused.
- If the store fails, the public route answers from the generator; the app never gets an error for it.
- The pages are behind the same Basic auth as the other admin pages (404 without `ADMIN_PASSWORD`). A cross-site form
  post (Origin differs from Host) is refused.

## Requirements

- **FR-001**: A table keeps one override per date: the three challenges and the all-done bonus.
- **FR-002**: `GET /api/challenges/today` MUST return the override when there is one, else the generator's answer;
  the answer shape and the date rules of spec 018 do not change.
- **FR-003**: An override MUST pass the same checks the app applies (id `[a-z0-9-]{1,40}`, type melodies|accuracy,
  melodies target 1–20, accuracy 50–100, XP 0–500, title 1–80, description 1–120, bonus 0–500, exactly 3, unique ids).
- **FR-004**: `GET /admin/challenges` lists days; `GET|POST /admin/challenges/:date` shows and saves; `POST
  /admin/challenges/:date/reset` removes the override.
- **FR-005**: Dates before tomorrow (UTC) and after +90 days MUST be refused on save and reset.
- **FR-006**: Every value on the pages is escaped.

## Success Criteria

- **SC-001**: The owner sets tomorrow's challenges in under a minute and a fresh device shows them, without a release.
- **SC-002**: With no override anywhere, behaviour is byte-for-byte what spec 018 shipped.

## Assumptions

- Same challenges for everyone on a date; the two existing types only; one language (the strings as typed).
- Rotation pools, weekly templates and per-level targets are later steps.
