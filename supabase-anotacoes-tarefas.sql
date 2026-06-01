create table if not exists public.anotacoes (
  id text primary key,
  processo_id text not null references public.processos(id) on delete cascade,
  titulo text,
  conteudo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists anotacoes_processo_id_idx on public.anotacoes(processo_id);
create index if not exists anotacoes_updated_at_idx on public.anotacoes(updated_at desc);

alter table public.anotacoes enable row level security;

drop policy if exists "justio_anotacoes_all" on public.anotacoes;
create policy "justio_anotacoes_all"
on public.anotacoes
for all
using (true)
with check (true);

create table if not exists public.tarefas (
  id text primary key,
  processo_id text not null references public.processos(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_limite date,
  concluida boolean not null default false,
  prioridade text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null
);

create index if not exists tarefas_processo_id_idx on public.tarefas(processo_id);
create index if not exists tarefas_data_limite_idx on public.tarefas(data_limite);
create index if not exists tarefas_concluida_idx on public.tarefas(concluida);

alter table public.tarefas enable row level security;

drop policy if exists "justio_tarefas_all" on public.tarefas;
create policy "justio_tarefas_all"
on public.tarefas
for all
using (true)
with check (true);
