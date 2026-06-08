create table if not exists public.triagem_importacoes (
  id text primary key,
  texto_original text not null,
  draft jsonb not null,
  origem text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'descartada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists triagem_importacoes_status_idx on public.triagem_importacoes(status);
create index if not exists triagem_importacoes_created_at_idx on public.triagem_importacoes(created_at desc);

alter table public.triagem_importacoes enable row level security;

drop policy if exists "justio_triagem_importacoes_all" on public.triagem_importacoes;
create policy "justio_triagem_importacoes_all"
on public.triagem_importacoes
for all
using (true)
with check (true);
