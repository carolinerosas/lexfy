alter table public.processos
  add column if not exists unidade_prisional text;

create index if not exists processos_unidade_prisional_idx on public.processos(unidade_prisional);
