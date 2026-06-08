create table if not exists public.incidentes_execucao (
  id text primary key,
  processo_id text not null references public.processos(id) on delete cascade,
  tipo text not null default 'outro',
  titulo text not null,
  descricao text,
  status text not null default 'em_preparacao',
  data_pedido date,
  data_decisao date,
  resultado text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists incidentes_execucao_processo_id_idx on public.incidentes_execucao(processo_id);
create index if not exists incidentes_execucao_tipo_idx on public.incidentes_execucao(tipo);
create index if not exists incidentes_execucao_status_idx on public.incidentes_execucao(status);
create index if not exists incidentes_execucao_updated_at_idx on public.incidentes_execucao(updated_at desc);

alter table public.incidentes_execucao enable row level security;

drop policy if exists "justio_incidentes_execucao_all" on public.incidentes_execucao;
create policy "justio_incidentes_execucao_all"
on public.incidentes_execucao
for all
using (true)
with check (true);

create table if not exists public.calculos_pena (
  id text primary key,
  processo_id text not null references public.processos(id) on delete cascade,
  titulo text not null,
  pena_anos integer,
  pena_meses integer,
  pena_dias integer,
  data_inicio date,
  dias_detracao integer not null default 0,
  dias_remicao integer not null default 0,
  regime_atual text,
  marco_base text,
  resumo text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists calculos_pena_processo_id_idx on public.calculos_pena(processo_id);
create index if not exists calculos_pena_updated_at_idx on public.calculos_pena(updated_at desc);

alter table public.calculos_pena enable row level security;

drop policy if exists "justio_calculos_pena_all" on public.calculos_pena;
create policy "justio_calculos_pena_all"
on public.calculos_pena
for all
using (true)
with check (true);

create table if not exists public.beneficios_penais (
  id text primary key,
  processo_id text not null references public.processos(id) on delete cascade,
  tipo text not null default 'comutacao' check (tipo in ('comutacao', 'indulto')),
  decreto text,
  titulo text not null,
  status text not null default 'em_estudo',
  data_requerimento date,
  data_decisao date,
  requisitos text,
  resultado text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists beneficios_penais_processo_id_idx on public.beneficios_penais(processo_id);
create index if not exists beneficios_penais_tipo_idx on public.beneficios_penais(tipo);
create index if not exists beneficios_penais_status_idx on public.beneficios_penais(status);
create index if not exists beneficios_penais_updated_at_idx on public.beneficios_penais(updated_at desc);

alter table public.beneficios_penais enable row level security;

drop policy if exists "justio_beneficios_penais_all" on public.beneficios_penais;
create policy "justio_beneficios_penais_all"
on public.beneficios_penais
for all
using (true)
with check (true);
