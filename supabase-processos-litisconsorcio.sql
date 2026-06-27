alter table public.processos
  add column if not exists clientes_partes jsonb not null default '[]'::jsonb;

alter table public.processos
  add column if not exists tipos_penais text[] not null default '{}'::text[];

create index if not exists processos_clientes_partes_gin_idx
  on public.processos using gin (clientes_partes);

create index if not exists processos_tipos_penais_gin_idx
  on public.processos using gin (tipos_penais);
