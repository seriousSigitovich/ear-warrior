// The reads behind /admin/analytics: app_events and attempt_log folded into one row per device, the account
// each device belongs to, and the server's own XP and phrase-check counts per account. Counts only — no audio,
// no attempt content. No query takes a parameter (a Date cannot be one behind the production pooler, DB_PREPARE=false).
import { sql } from '../db/client.js';
import type { AccountFacts, AnalyticsData, DeviceFacts, ServerTotals, TuneFacts } from './model.js';

/** A timestamp as the driver hands it over: text with drizzle's shared client. */
type Stamp = Date | string;

interface DeviceRow {
  device_id: string;
  user_id: string | null;
  app_version: string | null;
  tracked: boolean | null;
  first_at: Stamp | null;
  last_at: Stamp | null;
  days: number | null;
  onboarding_step: number | null;
  onboarding_done: boolean | null;
  onboarding_skipped: boolean | null;
  onboarded_at: Stamp | null;
  signin_seen: boolean | null;
  code_requested: boolean | null;
  signed_in: boolean | null;
  signed_in_at: Stamp | null;
  signin_errors: string[] | null;
  practice_opened: boolean | null;
  melody_played: boolean | null;
  first_melody_at: Stamp | null;
  answer_started: boolean | null;
  answers: number | null;
  correct: number | null;
  first_answer_at: Stamp | null;
  left_screen: string | null;
  left_phase: string | null;
  sessions: number | null;
  session_seconds: number | null;
  max_rank: number | null;
  drafts: number | null;
  streak: number | null;
  rank_ups: number | null;
  challenges_done: number | null;
  attempts: number | null;
  attempts_correct: number | null;
  octave_mismatches: number | null;
  fretboard_attempts: number | null;
  last_attempt_at: Stamp | null;
}

const date = (v: Stamp | null): Date | null => (v === null ? null : new Date(v));

export function deviceFacts(r: DeviceRow): DeviceFacts {
  return {
    deviceId: r.device_id,
    userId: r.user_id,
    appVersion: r.app_version,
    tracked: !!r.tracked,
    firstAt: date(r.first_at),
    lastAt: date(r.last_at),
    days: r.days ?? 0,
    onboardingStep: r.onboarding_step ?? 0,
    onboardingDone: !!r.onboarding_done,
    onboardingSkipped: !!r.onboarding_skipped,
    onboardedAt: date(r.onboarded_at),
    signinSeen: !!r.signin_seen,
    codeRequested: !!r.code_requested,
    signedIn: !!r.signed_in,
    signedInAt: date(r.signed_in_at),
    signinErrors: r.signin_errors ?? [],
    practiceOpened: !!r.practice_opened,
    melodyPlayed: !!r.melody_played,
    firstMelodyAt: date(r.first_melody_at),
    answerStarted: !!r.answer_started,
    answers: r.answers ?? 0,
    correct: r.correct ?? 0,
    firstAnswerAt: date(r.first_answer_at),
    leftScreen: r.left_screen || null,
    leftPhase: r.left_phase || null,
    sessions: r.sessions ?? 0,
    sessionSeconds: r.session_seconds ?? 0,
    maxRank: r.max_rank,
    drafts: r.drafts ?? 0,
    streak: r.streak ?? 0,
    rankUps: r.rank_ups ?? 0,
    challengesDone: r.challenges_done ?? 0,
    attempts: r.attempts ?? 0,
    attemptsCorrect: r.attempts_correct ?? 0,
    octaveMismatches: r.octave_mismatches ?? 0,
    fretboardAttempts: r.fretboard_attempts ?? 0,
    lastAttemptAt: date(r.last_attempt_at),
  };
}

export async function loadAnalytics(): Promise<AnalyticsData> {
  const devices = await sql<DeviceRow[]>`
    with ev as (
      select device_id,
             (array_agg(app_version order by occurred_at desc))[1] as app_version,
             bool_or(name = 'screen_view') as tracked,
             min(occurred_at) as first_at, max(occurred_at) as last_at,
             count(distinct (occurred_at at time zone 'UTC')::date)::int as days,
             coalesce(max((props->>'step')::numeric) filter (where name = 'onboarding_step'), 0)::int as onboarding_step,
             bool_or(name = 'onboarding_done') as onboarding_done,
             bool_or(name = 'onboarding_done' and props->>'skipped' = 'true') as onboarding_skipped,
             min(occurred_at) filter (where name = 'onboarding_done') as onboarded_at,
             bool_or(name = 'screen_view' and props->>'screen' = 'sign_in') as signin_seen,
             bool_or(name = 'signin_code_request') as code_requested,
             bool_or(name = 'signin_done') as signed_in,
             min(occurred_at) filter (where name = 'signin_done') as signed_in_at,
             array_agg(distinct props->>'error') filter (where name = 'signin_error') as signin_errors,
             bool_or(name = 'session_start') as practice_opened,
             bool_or(name = 'melody_play') as melody_played,
             min(occurred_at) filter (where name = 'melody_play') as first_melody_at,
             bool_or(name = 'answer_start') as answer_started,
             (count(*) filter (where name = 'answer_check'))::int as answers,
             (count(*) filter (where name = 'answer_check' and props->>'verdict' = 'correct'))::int as correct,
             min(occurred_at) filter (where name = 'answer_check') as first_answer_at,
             (array_agg(props->>'screen' order by occurred_at desc) filter (where name = 'app_background'))[1] as left_screen,
             (array_agg(props->>'phase' order by occurred_at desc) filter (where name = 'app_background'))[1] as left_phase,
             (count(*) filter (where name = 'session_start'))::int as sessions,
             coalesce(sum((props->>'duration_s')::numeric) filter (where name = 'session_end'), 0)::int as session_seconds,
             (max((props->>'rank')::numeric) filter (where name = 'answer_check'))::int as max_rank,
             (count(*) filter (where name = 'draft_on'))::int as drafts,
             coalesce(max((props->>'streak_length')::numeric) filter (where name = 'streak_extended'), 0)::int as streak,
             (count(*) filter (where name = 'rank_up'))::int as rank_ups,
             (count(*) filter (where name = 'daily_challenge_completed'))::int as challenges_done
      from app_events
      group by device_id
    ),
    att as (
      select device_id,
             count(*)::int as attempts,
             (count(*) filter (where verdict = 'correct'))::int as attempts_correct,
             (count(*) filter (where octave_mismatch))::int as octave_mismatches,
             (count(*) filter (where input_mode <> 'mic'))::int as fretboard_attempts,
             max(created_at) as last_attempt_at
      from attempt_log
      group by device_id
    ),
    ids as (select device_id from ev union select device_id from att)
    select i.device_id,
           -- The account in force: an open sign-in link, else the device-only (anonymous) account its session made, else the last closed link.
           coalesce(
             (select l.user_id from device_links l where l.device_id = i.device_id and l.unlinked_at is null order by l.linked_at desc limit 1),
             (select s.user_id from auth_sessions s join users u on u.id = s.user_id and u.anonymous
              where s.device_id = i.device_id order by s.created_at desc limit 1),
             (select l.user_id from device_links l where l.device_id = i.device_id order by l.linked_at desc limit 1)
           ) as user_id,
           ev.app_version, ev.tracked, ev.first_at, ev.last_at, ev.days,
           ev.onboarding_step, ev.onboarding_done, ev.onboarding_skipped, ev.onboarded_at,
           ev.signin_seen, ev.code_requested, ev.signed_in, ev.signed_in_at, ev.signin_errors,
           ev.practice_opened, ev.melody_played, ev.first_melody_at, ev.answer_started,
           ev.answers, ev.correct, ev.first_answer_at, ev.left_screen, ev.left_phase,
           ev.sessions, ev.session_seconds, ev.max_rank, ev.drafts, ev.streak, ev.rank_ups, ev.challenges_done,
           att.attempts, att.attempts_correct, att.octave_mismatches, att.fretboard_attempts, att.last_attempt_at
    from ids i
    left join ev on ev.device_id = i.device_id
    left join att on att.device_id = i.device_id`;

  const accounts = await sql<{ user_id: string; email: string | null; anonymous: boolean; created_at: Stamp; xp: number; old_xp: number; phrase_checks: number; phrases_passed: number }[]>`
    select u.id as user_id, u.email, u.anonymous, u.created_at,
           coalesce((select sum(x.xp) from xp_ledger x where x.user_id = u.id), 0)::int as xp,
           coalesce((select sum((g.data->>'xp')::numeric) from progress_game_rows g where g.user_id = u.id and g.kind = 'award'), 0)::int as old_xp,
           coalesce((select count(*) from phrase_checks p where p.user_id = u.id), 0)::int as phrase_checks,
           coalesce((select count(*) from (select distinct tune_id, phrase from phrase_checks p where p.user_id = u.id and p.passed) q), 0)::int as phrases_passed
    from users u`;

  const tunes = await sql<{ user_id: string; tune_id: string; checks: number; passed: number }[]>`
    select user_id, tune_id, count(*)::int as checks, (count(distinct phrase) filter (where passed))::int as passed
    from phrase_checks
    group by user_id, tune_id`;

  const legacy = await sql<{ user_id: string; tune_id: string; phrase: number; phrases: number }[]>`
    select user_id, tune_id, phrase, phrases from progress_melodies where not deleted order by updated_at desc`;

  const [t] = await sql<{ xp_rows: number; phrase_checks: number; accounts: number; guest_accounts: number; guest_sessions: number }[]>`
    select (select count(*) from xp_ledger)::int as xp_rows,
           (select count(*) from phrase_checks)::int as phrase_checks,
           (select count(*) from users)::int as accounts,
           (select count(*) from users where anonymous)::int as guest_accounts,
           (select count(*) from auth_sessions s join users u on u.id = s.user_id and u.anonymous)::int as guest_sessions`;
  const totals: ServerTotals = { xpRows: t.xp_rows, phraseChecks: t.phrase_checks, accounts: t.accounts, guestAccounts: t.guest_accounts, guestSessions: t.guest_sessions };

  return {
    totals,
    devices: devices.map(deviceFacts),
    accounts: accounts.map(
      (r): AccountFacts => ({
        userId: r.user_id,
        email: r.email,
        anonymous: r.anonymous,
        createdAt: new Date(r.created_at),
        xp: r.xp,
        oldXp: r.old_xp,
        legacyTunes: legacy.filter((l) => l.user_id === r.user_id).map((l) => ({ tuneId: l.tune_id, phrase: l.phrase, phrases: l.phrases })),
        phraseChecks: r.phrase_checks,
        phrasesPassed: r.phrases_passed,
      }),
    ),
    tunes: tunes.map((r): TuneFacts => ({ userId: r.user_id, tuneId: r.tune_id, checks: r.checks, passed: r.passed })),
  };
}
