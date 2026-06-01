create table if not exists public.perfil_advogado (
  id text primary key,
  user_id text not null unique,
  nome text not null default '',
  oab_numero text not null default '',
  oab_uf text not null default 'RJ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfil_advogado_user_id_idx on public.perfil_advogado(user_id);

alter table public.perfil_advogado enable row level security;

drop policy if exists "justio_perfil_advogado_all" on public.perfil_advogado;
create policy "justio_perfil_advogado_all"
on public.perfil_advogado
for all
using (true)
with check (true);
