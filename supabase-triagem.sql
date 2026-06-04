-- Leads de triagem (atendimento automático / WhatsApp)
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

alter table public.triagem_leads disable row level security;
