-- Adiciona data de vencimento aos honorários (para recebíveis e parcelas).
alter table public.honorarios
  add column if not exists data_vencimento text;
