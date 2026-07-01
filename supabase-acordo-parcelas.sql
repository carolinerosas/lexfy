create table if not exists public.acordo_parcelas (
  id text primary key,
  grupo_id text not null,
  processo_id text not null,
  cliente_nome text,
  direcao text not null default 'receber' check (direcao in ('receber', 'pagar')),
  titulo text,
  numero integer not null default 1,
  total_parcelas integer not null default 1,
  valor numeric not null default 0,
  data_vencimento date,
  pago boolean not null default false,
  data_pagamento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists acordo_parcelas_grupo_idx on public.acordo_parcelas(grupo_id);
create index if not exists acordo_parcelas_processo_idx on public.acordo_parcelas(processo_id);
create index if not exists acordo_parcelas_vencimento_idx on public.acordo_parcelas(data_vencimento);

alter table public.acordo_parcelas enable row level security;

drop policy if exists "justio_acordo_parcelas_all" on public.acordo_parcelas;
create policy "justio_acordo_parcelas_all"
on public.acordo_parcelas
for all
using (true)
with check (true);
