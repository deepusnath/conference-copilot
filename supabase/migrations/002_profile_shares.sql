-- Sprint 4: per-user researcher profile + revocable read-only share links.

alter table public.user_pipelines add column if not exists profile jsonb;

create table if not exists public.shares (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;
create policy "own shares" on public.shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anonymous read of a shared pipeline via token only (no user id, no email).
create or replace function public.get_shared_pipeline(share_token uuid)
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object('data', p.data, 'profile', p.profile)
  from shares s join user_pipelines p on p.user_id = s.user_id
  where s.token = share_token and not s.revoked
$$;
revoke all on function public.get_shared_pipeline(uuid) from public;
grant execute on function public.get_shared_pipeline(uuid) to anon, authenticated;
