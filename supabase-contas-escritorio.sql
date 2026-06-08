create table if not exists public.contas_escritorio (
  id text primary key,
  descricao text not null,
  valor numeric not null default 0,
  categoria text not null default 'outro',
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada')),
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento text,
  recorrente boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists contas_escritorio_status_idx on public.contas_escritorio(status);
create index if not exists contas_escritorio_vencimento_idx on public.contas_escritorio(data_vencimento);
create index if not exists contas_escritorio_categoria_idx on public.contas_escritorio(categoria);

alter table public.contas_escritorio enable row level security;

drop policy if exists "justio_contas_escritorio_all" on public.contas_escritorio;
create policy "justio_contas_escritorio_all"
on public.contas_escritorio
for all
using (true)
with check (true);
