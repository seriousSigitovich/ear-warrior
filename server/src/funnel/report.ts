// The one read behind /admin/funnel: app_events folded into one row per device. Only devices on a
// build that sends screen_view are included, so older installs do not read as "stopped at step 1".
import { sql } from '../db/client.js';
import type { DeviceRun } from './page.js';

/** A timestamp as the driver hands it over (text with drizzle's shared client, see auth/usage.ts). */
type Stamp = Date | string;

interface Row {
  device_id: string;
  email: string | null;
  first_at: Stamp;
  last_at: Stamp;
  days: number;
  onboarding_step: number;
  onboarding_done: boolean;
  onboarding_skipped: boolean;
  signin_seen: boolean;
  code_requested: boolean;
  signed_in: boolean;
  signin_errors: string[] | null;
  practice_opened: boolean;
  melody_played: boolean;
  answer_started: boolean;
  answers: number;
  correct: number;
  left_screen: string | null;
  left_phase: string | null;
}

export async function loadFunnel(): Promise<DeviceRun[]> {
  const rows = await sql<Row[]>`
    with d as (
      select device_id,
             min(occurred_at) as first_at, max(occurred_at) as last_at,
             count(distinct (occurred_at at time zone 'UTC')::date)::int as days,
             coalesce(max((props->>'step')::int) filter (where name = 'onboarding_step'), 0)::int as onboarding_step,
             bool_or(name = 'onboarding_done') as onboarding_done,
             bool_or(name = 'onboarding_done' and props->>'skipped' = 'true') as onboarding_skipped,
             bool_or(name = 'screen_view' and props->>'screen' = 'sign_in') as signin_seen,
             bool_or(name = 'signin_code_request') as code_requested,
             bool_or(name = 'signin_done') as signed_in,
             array_agg(distinct props->>'error') filter (where name = 'signin_error') as signin_errors,
             bool_or(name = 'session_start') as practice_opened,
             bool_or(name = 'melody_play') as melody_played,
             bool_or(name = 'answer_start') as answer_started,
             (count(*) filter (where name = 'answer_check'))::int as answers,
             (count(*) filter (where name = 'answer_check' and props->>'verdict' = 'correct'))::int as correct,
             (array_agg(props->>'screen' order by occurred_at desc) filter (where name = 'app_background'))[1] as left_screen,
             (array_agg(props->>'phase' order by occurred_at desc) filter (where name = 'app_background'))[1] as left_phase
      from app_events
      group by device_id
      having bool_or(name = 'screen_view')
    )
    select d.*,
           (select u.email from device_links l join users u on u.id = l.user_id
            where l.device_id = d.device_id order by l.linked_at desc limit 1) as email
    from d
    order by d.first_at desc`;
  return rows.map((r) => ({
    deviceId: r.device_id,
    email: r.email,
    firstAt: new Date(r.first_at),
    lastAt: new Date(r.last_at),
    days: r.days,
    onboardingStep: r.onboarding_step,
    onboardingDone: r.onboarding_done,
    onboardingSkipped: r.onboarding_skipped,
    signinSeen: r.signin_seen,
    codeRequested: r.code_requested,
    signedIn: r.signed_in,
    signinErrors: r.signin_errors ?? [],
    practiceOpened: r.practice_opened,
    melodyPlayed: r.melody_played,
    answerStarted: r.answer_started,
    answers: r.answers,
    correct: r.correct,
    leftScreen: r.left_screen || null,
    leftPhase: r.left_phase || null,
  }));
}
