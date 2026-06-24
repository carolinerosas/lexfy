-- Armazenamento privado de PDFs vinculados a clientes e processos do Justio.
create table if not exists public.documentos (
  id text primary key,
  contexto text not null check (contexto in ('clientes', 'processos')),
  registro_id text not null,
  nome text not null,
  referencia text not null,
  arquivo_nome text not null,
  caminho text not null unique,
  tamanho bigint not null default 0,
  user_id text not null default 'lexfy_shared',
  created_at timestamptz not null default now()
);

create index if not exists documentos_contexto_registro_idx
  on public.documentos(contexto, registro_id, created_at desc);

alter table public.documentos enable row level security;

drop policy if exists "justio_documentos_table_select" on public.documentos;
drop policy if exists "justio_documentos_table_insert" on public.documentos;
drop policy if exists "justio_documentos_table_delete" on public.documentos;

create policy "justio_documentos_table_select"
on public.documentos for select to anon, authenticated
using (user_id = 'lexfy_shared');

create policy "justio_documentos_table_insert"
on public.documentos for insert to anon, authenticated
with check (user_id = 'lexfy_shared');

create policy "justio_documentos_table_delete"
on public.documentos for delete to anon, authenticated
using (user_id = 'lexfy_shared');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "justio_documentos_select" on storage.objects;
drop policy if exists "justio_documentos_insert" on storage.objects;
drop policy if exists "justio_documentos_delete" on storage.objects;

create policy "justio_documentos_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'lexfy_shared');

create policy "justio_documentos_insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'lexfy_shared');

create policy "justio_documentos_delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'lexfy_shared');
