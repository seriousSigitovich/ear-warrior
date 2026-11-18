// SQL of /admin/analytics against a real Postgres (local only, like auth/pgStore.test.ts).
// Skipped, not failed, when no database is reachable.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { buildUsers } from './model.js';
import { loadAnalytics } from './report.js';

const url = process.env.DATABASE_URL ?? 'postgres://localhost';
let skip: string | undefined = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !url.includes('@') ? undefined : 'DATABASE_URL is not local';
if (!skip) {
  try {
    await applyDdl(sql);
  } catch (err) {
    skip = `no Postgres reachable (${(err as Error).message.slice(0, 60)})`;
  }
}

const event = (device: string, name: string, at: string, props: Record<string, unknown> = {}, version = '0.1.0') =>
  sql`insert into app_events (device_id, app_version, name, occurred_at, props) values (${device}, ${version}, ${name}, ${at}::timestamptz, ${JSON.stringify(props)}::jsonb)`;

before(async () => {
  if (skip) return;
  await sql.unsafe('truncate users, device_links, attempt_log, app_events, phrase_checks, xp_ledger restart identity cascade');
});
after(async () => {
  if (!skip) await sql.unsafe('truncate users, device_links, attempt_log, app_events, phrase_checks, xp_ledger restart identity cascade');
  await sql.end({ timeout: 2 });
});

test('folds events, attempts, the account link and server counts into people', { skip }, async () => {
  const [{ id }] = await sql`insert into users (email) values ('a@x.co') returning id`;
  await sql`insert into device_links (device_id, user_id, linked_at) values ('dev_a', ${id}, '2026-11-10T00:00:00Z')`;
  await event('dev_a', 'screen_view', '2026-11-10T10:00:00Z', { screen: 'home' });
  await event('dev_a', 'onboarding_step', '2026-11-10T10:01:00Z', { step: 2 });
  await event('dev_a', 'onboarding_done', '2026-11-10T10:02:00Z', { skipped: false });
  await event('dev_a', 'session_start', '2026-11-10T10:03:00Z');
  await event('dev_a', 'melody_play', '2026-11-10T10:04:00Z', { rank: 1 });
  await event('dev_a', 'answer_check', '2026-11-11T10:05:00Z', { verdict: 'correct', rank: 2 });
  await event('dev_a', 'answer_check', '2026-11-11T10:06:00Z', { verdict: 'incorrect', rank: 3 });
  await event('dev_a', 'session_end', '2026-11-11T10:07:00Z', { attempt_count: 2, duration_s: 120 });
  await event('dev_a', 'app_background', '2026-11-11T10:08:00Z', { screen: 'practice', phase: 'feedback' });
  await event('dev_a', 'streak_extended', '2026-11-11T10:09:00Z', { streak_length: 2 });
  await sql`insert into attempt_log (device_id, app_version, created_at, difficulty_id, difficulty_rank, note_count, verdict, matched_count, wrong_count, missed_count, extra_count, confidence, input_mode, octave_mismatch)
            values ('dev_a', '0.1.0', '2026-11-11T10:05:00Z', 'd1', 1, 3, 'correct', 3, 0, 0, 0, 1, 'fretboard', false),
                   ('dev_a', '0.1.0', '2026-11-11T10:06:00Z', 'd1', 1, 3, 'incorrect', 1, 2, 0, 0, 1, 'mic', true)`;
  // An old build: attempts only, no events; a guest.
  await sql`insert into attempt_log (device_id, app_version, created_at, difficulty_id, difficulty_rank, note_count, verdict, matched_count, wrong_count, missed_count, extra_count, confidence)
            values ('dev_old', '0.0.1', '2026-11-01T10:00:00Z', 'd1', 1, 3, 'correct', 3, 0, 0, 0, 1)`;
  await sql`insert into phrase_checks (user_id, check_id, tune_id, phrase, attempt_no, played, note_results, accuracy, passed, xp, local_day, checked_at)
            values (${id}, 'c1', 'canon', 0, 1, '{60}', '[]', 90, true, 10, '2026-11-11', '2026-11-11T10:05:00Z'),
                   (${id}, 'c2', 'canon', 1, 1, '{60}', '[]', 40, false, 0, '2026-11-11', '2026-11-11T10:06:00Z')`;
  await sql`insert into xp_ledger (user_id, key, kind, xp, local_day, at) values (${id}, 'k1', 'phrase', 10, '2026-11-11', '2026-11-11T10:05:00Z')`;

  const data = await loadAnalytics();
  const users = buildUsers(data);
  const anna = users.find((u) => u.email === 'a@x.co')!;
  assert.deepEqual(anna.deviceIds, ['dev_a']);
  assert.equal(anna.tracked, true);
  assert.equal(anna.onboardingStep, 2);
  assert.equal(anna.onboardingDone, true);
  assert.equal(anna.practiceOpened, true);
  assert.equal(anna.answers, 2);
  assert.equal(anna.correct, 1);
  assert.equal(anna.days, 2);
  assert.equal(anna.maxRank, 3);
  assert.equal(anna.sessions, 1);
  assert.equal(anna.sessionSeconds, 120);
  assert.equal(anna.streak, 2);
  assert.equal(anna.attempts, 2);
  assert.equal(anna.attemptsCorrect, 1);
  assert.equal(anna.fretboardAttempts, 1);
  assert.equal(anna.octaveMismatches, 1);
  assert.equal(anna.leftScreen, 'practice');
  assert.equal(anna.leftPhase, 'feedback');
  assert.equal(anna.firstMelodyAt?.toISOString(), '2026-11-10T10:04:00.000Z');
  assert.equal(anna.xp, 10);
  assert.equal(anna.phraseChecks, 2);
  assert.equal(anna.phrasesPassed, 1);
  assert.deepEqual(anna.tunes, [{ tuneId: 'canon', checks: 2, passed: 1 }]);
  const old = users.find((u) => u.deviceIds[0] === 'dev_old')!;
  assert.equal(old.tracked, false);
  assert.equal(old.attempts, 1);
  assert.equal(old.email, null);
});
