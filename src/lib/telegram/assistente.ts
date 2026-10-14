// Cérebro do bot do Telegram: entende o que a Carol mandou (texto ou áudio transcrito),
// consulta o Justio e, quando é para registrar algo, PROPÕE (ferramentas propor_*, em
// propostas.ts) — quem grava é o botão "Salvar" no Telegram, nunca o modelo direto.
import { envLimpo } from "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { TIPOS, TIPO_POR_FERRAMENTA } from "@/lib/telegram/propostas";

const MODEL = process.env.TELEGRAM_MODEL || "claude-opus-5-5";
const MAX_VOLTAS = 6;

export interface Proposta {
  tipo: string;
  dados: Record<string, unknown>;
}

export interface RespostaAssistente {
  texto: string;
  propostas: Proposta[];
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function hojeBrasil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar",
    description:
      "Procura clientes e processos no Justio por nome do cliente (ou parte dele), título ou número do processo. Use antes de consultar ou registrar qualquer coisa.",
    input_schema: {
      type: "object",
      properties: { termo: { type: "string", description: "Nome, parte do nome, título ou número do processo" } },
      required: ["termo"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "detalhes_processo",
    description:
      "Traz os dados de um processo: prazos em aberto, próximas audiências, últimas movimentações e anotações.",
    input_schema: {
      type: "object",
      properties: { processo_id: { type: "string" } },
      required: ["processo_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "buscar_contas",
    description: "Lista as contas do escritório (Financeiro) em aberto, filtrando por palavra da descrição se quiser. Use antes de marcar uma conta como paga.",
    input_schema: {
      type: "object",
      properties: { termo: { type: "string", description: "Palavra da descrição (vazio = todas em aberto)" } },
      required: ["termo"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "buscar_honorarios",
    description: "Lista cobranças de honorários em aberto, filtrando pelo nome do cliente. Use antes de dar baixa em honorários já lançados.",
    input_schema: {
      type: "object",
      properties: { termo: { type: "string", description: "Nome do cliente" } },
      required: ["termo"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "buscar_parcelas",
    description: "Lista parcelas de acordo em aberto, filtrando pelo nome do cliente ou título do acordo. Use antes de dar baixa em parcela.",
    input_schema: {
      type: "object",
      properties: { termo: { type: "string", description: "Nome do cliente ou título do acordo" } },
      required: ["termo"],
      additionalProperties: false,
    },
    strict: true,
  },
  ...Object.values(TIPOS).map((t) => t.ferramenta),
];

function sistema(): string {
  return `Você é o assistente da advogada Caroline Fraga (Carol), OAB/RJ 165955, falando com ela pelo Telegram. Hoje é ${hojeBrasil()} (horário de Brasília).

Você tem acesso ao Justio, o sistema do escritório dela, pelas ferramentas. Ela manda mensagens de texto ou áudios já transcritos (a transcrição pode errar nomes próprios — se o nome não bater exatamente, busque por partes do nome).

Duas situações:
1. Ela pede para registrar ou cadastrar algo: use "buscar" para achar o cliente/processo e chame a ferramenta propor_* certa:
   - fato do processo (decisão, despacho, audiência realizada) → propor_registro tipo andamento; observação interna → propor_registro tipo anotacao;
   - prazo → propor_prazo; tarefa / algo a fazer → propor_tarefa; audiência designada → propor_audiencia;
   - reunião/consulta com cliente → propor_atendimento; acordo com parcelas → propor_acordo; honorários (valor cobrado, pago) → propor_honorarios, nunca anotação;
   - sentença, pronúncia, pena, resultado → propor_resultado;
   - conta/despesa do escritório → propor_conta (paga=true se ela já pagou); pagar conta já lançada → buscar_contas e propor_pagar_conta;
   - cliente pagou honorários já lançados ("o Almir pagou 500 dos honorários") → buscar_honorarios e propor_receber_honorario (propor_honorarios é só para cobrança nova);
   - parcela de acordo paga/recebida ("paguei o acordo do Almir") → buscar_parcelas e propor_pagar_parcela;
   - cadastrar cliente → propor_cliente; cadastrar processo → propor_processo (com criar_cliente=true se o cliente não existir).
   Se ela falar de várias coisas na mesma mensagem, chame várias ferramentas propor_* de uma vez (uma para cada coisa).
   Se houver mais de um processo possível, pergunte qual antes de propor. Se o cliente ou o processo não estiver no Justio e ela não pediu para cadastrar, use propor_triagem.
   Datas relativas ("sexta", "daqui a 15 dias") viram datas reais a partir de hoje. Prazo em dias úteis: avise que conferiu ou peça a data se houver dúvida.
2. Ela pergunta algo (ex.: "qual o próximo prazo do Carlinhos?"): busque e responda com base só no que o Justio mostrar. Se o dado não estiver lá, diga que não está.

Estilo: português do Brasil, mensagens curtas, tom de colega próxima. Texto puro (sem markdown, sem asteriscos). Datas no formato dd/mm/aaaa. Nunca invente andamentos, prazos ou decisões.`;
}

async function buscar(termo: string) {
  const alvo = semAcento(termo).trim();
  const palavras = alvo.split(/\s+/).filter((p) => p.length >= 3);
  const [{ data: clientes }, { data: processos }] = await Promise.all([
    supabase.from("clientes").select("id,nome"),
    supabase.from("processos").select("id,numero,titulo,cliente_nome,cliente_id,status,tipo,vara,comarca"),
  ]);
  const casa = (texto?: string | null) => {
    const t = semAcento(texto ?? "");
    return t.includes(alvo) || (palavras.length > 0 && palavras.every((p) => t.includes(p)));
  };
  return {
    clientes: (clientes ?? []).filter((c) => casa(c.nome)).slice(0, 10),
    processos: (processos ?? []).filter((p) => casa(p.cliente_nome) || casa(p.titulo) || casa(p.numero)).slice(0, 15),
  };
}

async function buscarContas(termo: string) {
  const { data } = await supabase
    .from("contas_escritorio")
    .select("id,descricao,valor,categoria,data_vencimento,status")
    .neq("status", "paga")
    .order("data_vencimento");
  const alvo = semAcento(termo ?? "").trim();
  return (data ?? []).filter((c) => !alvo || semAcento(`${c.descricao} ${c.categoria}`).includes(alvo)).slice(0, 20);
}

async function buscarHonorarios(termo: string) {
  const [{ data: honorarios }, { data: processos }] = await Promise.all([
    supabase
      .from("honorarios")
      .select("id,processo_id,descricao,valor,data_vencimento,tipo")
      .eq("categoria", "cobranca")
      .eq("status", "pendente")
      .order("data_vencimento"),
    supabase.from("processos").select("id,cliente_nome,titulo"),
  ]);
  const proc = new Map((processos ?? []).map((p) => [p.id, p]));
  const alvo = semAcento(termo ?? "").trim();
  return (honorarios ?? [])
    .map((h) => ({ ...h, cliente: proc.get(h.processo_id)?.cliente_nome ?? "", processo: proc.get(h.processo_id)?.titulo ?? "" }))
    .filter((h) => !alvo || semAcento(`${h.cliente} ${h.descricao}`).includes(alvo))
    .slice(0, 20);
}

async function buscarParcelas(termo: string) {
  const [{ data: parcelas }, { data: processos }] = await Promise.all([
    supabase
      .from("acordo_parcelas")
      .select("id,processo_id,cliente_nome,titulo,direcao,numero,total_parcelas,valor,data_vencimento")
      .eq("pago", false)
      .order("data_vencimento"),
    supabase.from("processos").select("id,cliente_nome"),
  ]);
  const clienteDoProcesso = new Map((processos ?? []).map((p) => [p.id, p.cliente_nome]));
  const alvo = semAcento(termo ?? "").trim();
  return (parcelas ?? [])
    .map((p) => ({ ...p, cliente: p.cliente_nome || clienteDoProcesso.get(p.processo_id) || "" }))
    .filter((p) => !alvo || semAcento(`${p.cliente} ${p.titulo ?? ""}`).includes(alvo))
    .slice(0, 20);
}

async function detalhesProcesso(processoId: string) {
  const [proc, prazos, audiencias, movs, anots] = await Promise.all([
    supabase.from("processos").select("*").eq("id", processoId).maybeSingle(),
    supabase
      .from("prazos")
      .select("titulo,data_prazo,tipo,concluido")
      .eq("processo_id", processoId)
      .eq("concluido", false)
      .order("data_prazo"),
    supabase
      .from("audiencias")
      .select("titulo,data_hora,local,tipo,realizada")
      .eq("processo_id", processoId)
      .gte("data_hora", hojeBrasil())
      .order("data_hora"),
    supabase
      .from("movimentacoes")
      .select("descricao,data_movimentacao,fonte")
      .eq("processo_id", processoId)
      .order("data_movimentacao", { ascending: false })
      .limit(10),
    supabase
      .from("anotacoes")
      .select("titulo,conteudo,updated_at")
      .eq("processo_id", processoId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);
  if (!proc.data) return { erro: "Processo não encontrado" };
  return {
    processo: proc.data,
    prazos_em_aberto: prazos.data ?? [],
    proximas_audiencias: audiencias.data ?? [],
    ultimas_movimentacoes: movs.data ?? [],
    ultimas_anotacoes: anots.data ?? [],
  };
}

export async function conversar(mensagem: string): Promise<RespostaAssistente> {
  const client = new Anthropic({ apiKey: envLimpo("ANTHROPIC_API_KEY") });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: mensagem }];

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: sistema(),
      tools: TOOLS,
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") {
      return { texto: "Não consegui processar essa mensagem. Tenta reformular?", propostas: [] };
    }

    const usos = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const texto = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const propostas = usos
      .filter((u) => TIPO_POR_FERRAMENTA[u.name])
      .map((u) => ({ tipo: TIPO_POR_FERRAMENTA[u.name], dados: u.input as Record<string, unknown> }));
    if (propostas.length) return { texto, propostas };
    if (res.stop_reason !== "tool_use" || usos.length === 0) return { texto: texto || "Pronto.", propostas: [] };

    messages.push({ role: "assistant", content: res.content });
    const resultados = await Promise.all(
      usos.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const input = u.input as Record<string, string>;
          const saida =
            u.name === "buscar"
              ? await buscar(input.termo)
              : u.name === "buscar_contas"
                ? await buscarContas(input.termo)
                : u.name === "buscar_parcelas"
                  ? await buscarParcelas(input.termo)
                  : u.name === "buscar_honorarios"
                    ? await buscarHonorarios(input.termo)
                : await detalhesProcesso(input.processo_id);
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(saida) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, content: String(e), is_error: true };
        }
      })
    );
    messages.push({ role: "user", content: resultados });
  }
  return { texto: "Me perdi tentando achar isso no Justio. Pode mandar de novo com mais detalhes?", propostas: [] };
}
