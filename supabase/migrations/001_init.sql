-- Conference CoPilot v2: per-user pipeline storage with RLS.
create table if not exists public.user_pipelines (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_pipelines enable row level security;

create policy "select own pipeline" on public.user_pipelines
  for select using (auth.uid() = user_id);
create policy "insert own pipeline" on public.user_pipelines
  for insert with check (auth.uid() = user_id);
create policy "update own pipeline" on public.user_pipelines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
