alter table public.processos
  add column if not exists numero_inquerito text,
  add column if not exists delegacia text,
  add column if not exists autoridade_policial text,
  add column if not exists data_instauracao date,
  add column if not exists situacao_inquerito text,
  add column if not exists relatorio_final text,
  add column if not exists processo_principal_id text;

create index if not exists processos_processo_principal_id_idx on public.processos(processo_principal_id);
create index if not exists processos_numero_inquerito_idx on public.processos(numero_inquerito);
create index if not exists processos_situacao_inquerito_idx on public.processos(situacao_inquerito);
