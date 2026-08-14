-- Deadline nudges: one email per (user, venue, threshold), ever.
create table if not exists public.nudge_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id text not null,
  threshold int not null,
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, venue_id, threshold)
);
alter table public.nudge_log enable row level security;
-- no policies: service role only

-- Schedule the nudge function daily at 07:30 IST (02:00 UTC).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'daily-deadline-nudges',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://lqhlplbghttdaeoyeqmb.supabase.co/functions/v1/deadline-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxaGxwbGJnaHR0ZGFlb3llcW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njk1MzUsImV4cCI6MjEwMjA0NTUzNX0.DHVuLxD7CieXFNozAjWuL80UVNr9wEMuclzhl5CVpnE'
    ),
    body := '{}'::jsonb
  );
  $$
);
