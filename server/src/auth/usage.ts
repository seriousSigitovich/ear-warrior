// The one read behind /admin/users: attempts grouped by the account they are attributed to
// (view attempt_log_attributed, db/ddl.ts). Counts only — no attempt content leaves the query.
import { sql } from '../db/client.js';
import type { AccountUsage, UsageReport, UsageRow } from './usagePage.js';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  devices: number;
  attempts: number;
  attempts7d: number;
  correct: number;
  last_at: Date | null;
}

const usageRow = (r: Row): UsageRow => ({ devices: r.devices, attempts: r.attempts, attempts7d: r.attempts7d, correct: r.correct, lastAt: r.last_at });

export async function loadUsageReport(now: Date): Promise<UsageReport> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const accounts = await sql<(Row & { email: string; created_at: Date })[]>`
    select u.email, u.created_at,
           coalesce(a.devices, 0)::int as devices, coalesce(a.attempts, 0)::int as attempts,
           coalesce(a.attempts7d, 0)::int as attempts7d, coalesce(a.correct, 0)::int as correct, a.last_at
    from users u
    left join (
      select user_id,
             count(distinct device_id) as devices,
             count(*) as attempts,
             count(*) filter (where created_at >= ${since}) as attempts7d,
             count(*) filter (where verdict = 'correct') as correct,
             max(created_at) as last_at
      from attempt_log_attributed
      where user_id is not null
      group by user_id
    ) a on a.user_id = u.id
    order by a.last_at desc nulls last, u.created_at desc`;
  const [anonymous] = await sql<Row[]>`
    select count(distinct device_id)::int as devices, count(*)::int as attempts,
           (count(*) filter (where created_at >= ${since}))::int as attempts7d,
           (count(*) filter (where verdict = 'correct'))::int as correct, max(created_at) as last_at
    from attempt_log_attributed
    where user_id is null`;
  return {
    accounts: accounts.map((r): AccountUsage => ({ email: r.email, createdAt: r.created_at, ...usageRow(r) })),
    anonymous: usageRow(anonymous),
  };
}
