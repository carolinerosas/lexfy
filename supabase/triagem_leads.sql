-- Captação (contatos que ainda não são clientes) e triagem pública.
-- Faltou na cópia para o banco de São Paulo (10/11/2026). Colar no SQL Editor do Supabase e rodar.
-- Segue o banco fechado: RLS ligado e sem policy; o app grava pelo servidor, com a chave secreta.
create table if not exists public.triagem_leads (
  id text primary key,
  nome text,
  contato text,
  telefone text,
  area text,
  resumo text,
  urgencia text,
  detalhes text,
  transcricao text,
  canal text,
  status text not null default 'novo',
  created_at text not null,
  user_id text
);

alter table public.triagem_leads enable row level security;

-- avisa a API do Supabase que a tabela nova existe (sem isso o erro "schema cache" pode continuar por alguns minutos)
notify pgrst, 'reload schema';
