create table if not exists public.publicacoes_sync_status (
  id text primary key,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_found integer not null default 0,
  last_imported integer not null default 0,
  last_errors text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.publicacoes_sync_status enable row level security;

drop policy if exists "justio_publicacoes_sync_status_all" on public.publicacoes_sync_status;
create policy "justio_publicacoes_sync_status_all"
on public.publicacoes_sync_status
for all
using (true)
with check (true);
