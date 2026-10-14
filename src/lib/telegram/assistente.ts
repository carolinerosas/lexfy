// Cérebro do bot do Telegram: entende o que a Carol mandou (texto ou áudio transcrito),
// consulta o Justio e, quando é para registrar algo, PROPÕE o registro — quem grava é o
// botão "Salvar" no Telegram, nunca o modelo direto.
import { envLimpo } from "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { createAnotacao, createHonorario, createMovimentacao, registrarRecebimento } from "@/lib/store";

const MODEL = process.env.TELEGRAM_MODEL || "claude-opus-5-5";
const MAX_VOLTAS = 6;

export interface PropostaRegistro {
  destino: "processo" | "cliente";
  id: string;
  rotulo: string;
  tipo: "andamento" | "anotacao";
  titulo?: string;
  texto: string;
  data: string; // AAAA-MM-DD
}

export interface RespostaAssistente {
  texto: string;
  proposta?: PropostaRegistro;
  /** Texto a mandar para a Triagem quando o cliente/processo ainda não está no Justio. */
  triagem?: string;
  honorarios?: PropostaHonorarios;
}

export interface PropostaHonorarios {
  processo_id: string;
  rotulo: string;
  descricao: string;
  tipo: "contratual" | "sucumbencial" | "exito" | "outro";
  valor_cobrado: number;
  data_lancamento: string; // AAAA-MM-DD
  vencimento?: string; // AAAA-MM-DD
  valor_pago?: number;
  data_pagamento?: string; // AAAA-MM-DD
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
    name: "propor_registro",
    description:
      "Propõe gravar um andamento ou anotação no Justio. NÃO grava: a Carol confirma num botão. Use quando ela relatar um fato a registrar (ex.: decisão em audiência). Só chame com um processo/cliente identificado sem ambiguidade pelo 'buscar'.",
    input_schema: {
      type: "object",
      properties: {
        destino: { type: "string", enum: ["processo", "cliente"] },
        id: { type: "string", description: "id do processo ou do cliente, vindo do 'buscar'" },
        rotulo: {
          type: "string",
          description: "Como mostrar o destino à Carol, ex.: 'Raphael Souza — Execução Penal 0001234-56.2024.8.19.0001'",
        },
        tipo: {
          type: "string",
          enum: ["andamento", "anotacao"],
          description: "andamento = fato do processo (decisão, audiência, despacho); anotacao = observação interna",
        },
        titulo: { type: "string", description: "Título curto (só para anotação)" },
        texto: { type: "string", description: "Texto a gravar, objetivo e em linguagem jurídica correta" },
        data: { type: "string", description: "Data do fato, AAAA-MM-DD" },
      },
      required: ["destino", "id", "rotulo", "tipo", "texto", "data"],
      additionalProperties: false,
    },
  },
  {
    name: "propor_honorarios",
    description:
      "Propõe lançar honorários no financeiro do processo: a cobrança (valor cobrado) e, se ela disser, o pagamento recebido (valor e data) — o saldo fica em aberto automaticamente. NÃO grava: a Carol confirma num botão. Use sempre que ela falar de honorários, valor cobrado/combinado ou pagamento do cliente — nunca registre honorários como anotação.",
    input_schema: {
      type: "object",
      properties: {
        processo_id: { type: "string", description: "id do processo, vindo do 'buscar'" },
        rotulo: { type: "string", description: "Cliente e processo, como em propor_registro" },
        descricao: { type: "string", description: "Ex.: 'Honorários contratuais — defesa criminal'" },
        tipo: { type: "string", enum: ["contratual", "sucumbencial", "exito", "outro"] },
        valor_cobrado: { type: "number", description: "Valor total cobrado, em reais" },
        data_lancamento: { type: "string", description: "Data da cobrança, AAAA-MM-DD" },
        vencimento: { type: "string", description: "Vencimento do saldo, AAAA-MM-DD, se ela disser" },
        valor_pago: { type: "number", description: "Valor já pago, em reais, se ela disser" },
        data_pagamento: { type: "string", description: "Data do pagamento, AAAA-MM-DD" },
      },
      required: ["processo_id", "rotulo", "descricao", "tipo", "valor_cobrado", "data_lancamento"],
      additionalProperties: false,
    },
  },
  {
    name: "propor_triagem",
    description:
      "Propõe mandar a informação para a Triagem do Justio (onde a Carol aprova e cadastra clientes/processos novos). NÃO envia: a Carol confirma num botão. Use quando o 'buscar' não achar o cliente ou o processo.",
    input_schema: {
      type: "object",
      properties: {
        texto: {
          type: "string",
          description:
            "Tudo que a Carol informou, organizado: nome do cliente, número do processo se houver, o fato/andamento e a data. Não invente nada.",
        },
      },
      required: ["texto"],
      additionalProperties: false,
    },
  },
];

function sistema(): string {
  return `Você é o assistente da advogada Caroline Fraga (Carol), OAB/RJ 165955, falando com ela pelo Telegram. Hoje é ${hojeBrasil()} (horário de Brasília).

Você tem acesso ao Justio, o sistema do escritório dela, pelas ferramentas. Ela manda mensagens de texto ou áudios já transcritos (a transcrição pode errar nomes próprios — se o nome não bater exatamente, busque por partes do nome).

Duas situações:
1. Ela relata um fato para registrar (ex.: "juiz deferiu o extramuros do Raphael"): use "buscar" para achar o cliente/processo e chame "propor_registro". Se houver mais de um processo possível, pergunte qual antes de propor. Se o cliente ou o processo ainda não estiver no Justio, chame "propor_triagem" para mandar a informação à Triagem.
   Honorários (valor cobrado, combinado, pago) vão SEMPRE por "propor_honorarios", nunca como anotação. Se ela falar de honorários e também de um andamento na mesma mensagem, proponha os honorários e avise que o andamento pode ser mandado em seguida.
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
      return { texto: "Não consegui processar essa mensagem. Tenta reformular?" };
    }

    const usos = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const texto = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const proposta = usos.find((u) => u.name === "propor_registro");
    if (proposta) return { texto, proposta: proposta.input as PropostaRegistro };
    const honorarios = usos.find((u) => u.name === "propor_honorarios");
    if (honorarios) return { texto, honorarios: honorarios.input as PropostaHonorarios };
    const triagem = usos.find((u) => u.name === "propor_triagem");
    if (triagem) return { texto, triagem: (triagem.input as { texto: string }).texto };
    if (res.stop_reason !== "tool_use" || usos.length === 0) return { texto: texto || "Pronto." };

    messages.push({ role: "assistant", content: res.content });
    const resultados = await Promise.all(
      usos.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const input = u.input as Record<string, string>;
          const saida = u.name === "buscar" ? await buscar(input.termo) : await detalhesProcesso(input.processo_id);
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(saida) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, content: String(e), is_error: true };
        }
      })
    );
    messages.push({ role: "user", content: resultados });
  }
  return { texto: "Me perdi tentando achar isso no Justio. Pode mandar de novo com mais detalhes?" };
}

/** Manda para a Triagem pela mesma rota que a ponte do Cowork usa. */
export async function enviarParaTriagem(texto: string): Promise<void> {
  const base = process.env.JUSTIO_URL || "https://www.justio.com.br";
  const res = await fetch(`${base}/api/triagem/importar`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.JUSTIO_AGENT_TOKEN ?? ""}`,
    },
    body: JSON.stringify({ texto, persistir: true, origem: "telegram" }),
  });
  if (!res.ok) throw new Error(`Triagem respondeu ${res.status}`);
}

/** Grava o registro que a Carol confirmou no botão. */
export async function gravarRegistro(
  p: Pick<PropostaRegistro, "destino" | "id" | "tipo" | "texto" | "data" | "titulo">
): Promise<void> {
  if (p.destino === "processo" && p.tipo === "andamento") {
    const mov = await createMovimentacao({
      processo_id: p.id,
      descricao: p.texto,
      data_movimentacao: p.data,
      fonte: "Telegram",
      lida: true,
    });
    if (!mov) throw new Error("O Justio não aceitou o andamento");
    return;
  }
  await createAnotacao({
    processo_id: p.destino === "processo" ? p.id : undefined,
    cliente_id: p.destino === "cliente" ? p.id : undefined,
    titulo: p.titulo || "Registro via Telegram",
    conteudo: p.texto,
  });
}

/** Lança a cobrança e, se houver, o pagamento (o saldo vira cobrança pendente). */
export async function gravarHonorarios(h: Omit<PropostaHonorarios, "rotulo">): Promise<void> {
  const cobranca = await createHonorario({
    processo_id: h.processo_id,
    descricao: h.descricao,
    valor: h.valor_cobrado,
    tipo: h.tipo,
    categoria: "cobranca",
    status: "pendente",
    data_lancamento: h.data_lancamento,
    data_vencimento: h.vencimento,
  });
  if (!cobranca) throw new Error("O Justio não aceitou a cobrança");
  if (h.valor_pago && h.valor_pago > 0) {
    await registrarRecebimento(cobranca, {
      data: h.data_pagamento || h.data_lancamento,
      valorRecebido: h.valor_pago,
      vencimentoDiferenca: h.vencimento,
    });
  }
}
