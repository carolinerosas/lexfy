-- Login do Justio (aplicado em 14/10/2026). Só a chave secreta acessa (RLS sem policies).
create table if not exists public.justio_acesso (
  id smallint primary key default 1 check (id = 1),
  senha_hash text,
  sessao_versao integer not null default 1,
  reset_token_hash text,
  reset_expira timestamptz,
  reset_pedido_em timestamptz,
  falhas integer not null default 0,
  bloqueado_ate timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.justio_acesso enable row level security;
revoke all on public.justio_acesso from anon, authenticated;
insert into public.justio_acesso (id) values (1) on conflict do nothing;
