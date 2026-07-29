-- Landing "Get notified" waitlist signups.
-- Insert-only with the anon key, same posture as attempt_log (0001).
-- Email is the only PII stored: no IP, no tracking, one row per address (case-insensitive).

create table if not exists signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (position('@' in email) > 1 and char_length(email) <= 320),
  created_at  timestamptz not null default now(),
  source      text,                              -- e.g. 'landing'
  user_agent  text                               -- coarse client hint for debugging; not PII
);

-- One signup per email, case-insensitive. A repeat submit hits this and is treated as success.
create unique index if not exists signups_email_lower_idx on signups (lower(email));

-- Anonymous, insert-only access with the anon key (the /api/subscribe function uses this key).
alter table signups enable row level security;

create policy "anon insert only" on signups
  for insert to anon with check (true);
-- No select/update/delete policy -> anon can neither read nor modify existing rows.
-- Read the list from the Supabase dashboard / service role only.
