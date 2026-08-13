-- Venue-hunt rate limiting: one row per hunt; service-role only (no user access).
create table if not exists public.hunt_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'basic',
  created_at timestamptz not null default now()
);
alter table public.hunt_log enable row level security;
-- no policies: only the service role (edge function) reads/writes
