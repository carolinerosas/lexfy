-- Tabela do novo Justio: guarda o que o Justio antigo não tem
-- (equipe, ponto, etapas da captação, ficha por área, fase do caso, documentos gerados, configurações).
-- Rode uma vez no Supabase: SQL Editor > New query > colar > Run.
--
-- Não cria policy: com RLS ligado e sem policy, só a chave secreta do servidor lê e grava,
-- igual às demais tabelas do Justio.

create table if not exists public.justio_novo (
  id text primary key,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.justio_novo enable row level security;
