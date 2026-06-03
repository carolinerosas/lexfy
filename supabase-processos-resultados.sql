alter table public.processos
  add column if not exists resultado_tipo text,
  add column if not exists resultado_descricao text,
  add column if not exists pena text,
  add column if not exists processo_principal_id text;

-- Classificações agora aceitam valores personalizados (opção "Outro" cadastrável).
-- Por isso removemos as restrições fixas de tipo/resultado_tipo (passam a ser texto livre).
alter table public.processos
  drop constraint if exists processos_tipo_check;

alter table public.processos
  drop constraint if exists processos_resultado_tipo_check;

alter table public.processos
  drop constraint if exists processos_processo_principal_id_fkey;

alter table public.processos
  add constraint processos_processo_principal_id_fkey
  foreign key (processo_principal_id)
  references public.processos(id)
  on delete set null;

create index if not exists processos_processo_principal_id_idx
  on public.processos(processo_principal_id);
