-- Closed-beta main question: do testers come back? Run against the production Postgres (psql $DATABASE_URL -f ...).
-- Events are client-clock (occurred_at); days are UTC.

-- 1. Per device: first day, active days, sessions in the last 7 days, returned on day 2.
with opens as (
  select device_id, (occurred_at at time zone 'utc')::date as day from app_events where name = 'app_open'
  group by 1, 2
),
first_day as (select device_id, min(day) as d0 from opens group by 1),
sessions7 as (
  select device_id, count(*) as n from app_events
  where name = 'session_start' and occurred_at > now() - interval '7 days' group by 1
)
select f.device_id, f.d0 as first_day,
       (select count(*) from opens o where o.device_id = f.device_id) as active_days,
       coalesce(s.n, 0) as sessions_7d,
       exists (select 1 from opens o where o.device_id = f.device_id and o.day = f.d0 + 1) as returned_day2
from first_day f left join sessions7 s using (device_id)
order by f.d0, f.device_id;

-- 2. Headline numbers: share of devices with >= 3 sessions in the last 7 days; day-2 return among devices old enough.
with opens as (
  select device_id, (occurred_at at time zone 'utc')::date as day from app_events where name = 'app_open' group by 1, 2
),
first_day as (select device_id, min(day) as d0 from opens group by 1),
sessions7 as (
  select device_id, count(*) as n from app_events
  where name = 'session_start' and occurred_at > now() - interval '7 days' group by 1
)
select count(*) as devices,
       round(100.0 * count(*) filter (where coalesce(s.n, 0) >= 3) / nullif(count(*), 0), 1) as pct_3plus_sessions_7d,
       round(100.0 * count(*) filter (where f.d0 < (now() at time zone 'utc')::date and exists
         (select 1 from opens o where o.device_id = f.device_id and o.day = f.d0 + 1))
         / nullif(count(*) filter (where f.d0 < (now() at time zone 'utc')::date), 0), 1) as pct_returned_day2
from first_day f left join sessions7 s using (device_id);
