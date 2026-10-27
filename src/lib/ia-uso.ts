import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";

// Controle de gasto com a API da Anthropic: cada chamada grava uma linha em uso_ia
// (custo estimado) e as rotas de IA recusam novas chamadas quando o mês passa do limite.
// Limite em dólares pela variável LIMITE_IA_USD_MES (padrão 15). Se a tabela não responder,
// não bloqueia: a audiência não pode parar por falha do contador.

// Dólares por milhão de tokens (estimativa; cache é contado como entrada cheia, o que superestima).
const PRECO: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-sonnet-5-5": { entrada: 3, saida: 15 },
};
const PRECO_PADRAO = { entrada: 4, saida: 20 };

export const LIMITE_IA_USD_MES = Number(envLimpo("LIMITE_IA_USD_MES")) || 15;

interface Uso {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export async function gastoDoMes(): Promise<number | null> {
  const agora = new Date();
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
  const { data, error } = await supabase.from("uso_ia").select("custo_usd").gte("created_at", inicio);
  if (error || !data) return null;
  return data.reduce((soma, l) => soma + Number(l.custo_usd), 0);
}

/** Mensagem de erro se o limite do mês já foi atingido; null se pode seguir. */
export async function bloqueioPorLimite(): Promise<string | null> {
  const gasto = await gastoDoMes();
  if (gasto === null || gasto < LIMITE_IA_USD_MES) return null;
  return `Limite mensal de IA do Justio atingido (US$ ${gasto.toFixed(2)} de US$ ${LIMITE_IA_USD_MES.toFixed(2)}). Aumente LIMITE_IA_USD_MES no Vercel para continuar.`;
}

export async function registrarUso(rota: string, modelo: string, uso: Uso | undefined): Promise<void> {
  if (!uso) return;
  const entrada = (uso.input_tokens ?? 0) + (uso.cache_creation_input_tokens ?? 0) + (uso.cache_read_input_tokens ?? 0);
  const saida = uso.output_tokens ?? 0;
  const preco = PRECO[modelo] ?? PRECO_PADRAO;
  const custo = (entrada * preco.entrada + saida * preco.saida) / 1_000_000;
  const { error } = await supabase
    .from("uso_ia")
    .insert({ rota, modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: Number(custo.toFixed(4)) });
  if (error) console.error("uso_ia:", error.message);
}
