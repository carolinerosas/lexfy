import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { ESTILO_CAROL, MODO_ORAL } from "@/lib/audiencia/estilo-carol";
import { PERFIL, areaDoProcesso, atoDaAudiencia, type Ato, type Area } from "@/lib/audiencia/perfis";
import { PADRAO_CUSTODIA } from "@/lib/audiencia/criminal";

export const runtime = "nodejs";
export const maxDuration = 300;

// Analisa a transcrição da audiência em andamento, com o processo e o roteiro da Carol
// como contexto, no perfil da área (criminal, família ou geral). Modos: dicas (curtas,
// a cada minuto), requerimentos finais e alegações finais orais. Resposta em stream.

type Modo = "dicas" | "requerimentos" | "alegacoes";

const MODEL = process.env.AUDIENCIA_MODEL || "claude-opus-5-5";

const ESFORCO: Record<Modo, "low" | "medium" | "high"> = { dicas: "low", requerimentos: "medium", alegacoes: "high" };
const MAX_TOKENS: Record<Modo, number> = { dicas: 1500, requerimentos: 6000, alegacoes: 16000 };

const INSTRUCOES_CUSTODIA: Record<Modo, string> = {
  dicas: `Siga o PADRÃO DA EQUIPE — AUDIÊNCIA DE CUSTÓDIA. Leia a transcrição e dê no MÁXIMO 4 alertas curtos sobre o que acabou de acontecer: vício do checklist que apareceu (e que precisa ir para a ata), pergunta de mérito indevida, o que o MP requereu (se ainda não está claro, lembrar de pedir que conste em ata), pergunta que o juiz deixou de fazer (circunstâncias da prisão, direitos, tratamento, art. 8º, X), e se a defesa deve ou não entrar no fato.
Se não houver nada novo relevante, responda só: Sem novidades relevantes.
Não cite número de julgado; cite artigo, súmula ou resolução.
Formato: um alerta por linha, começando com o emoji (⚠️ vício, 📝 consignar em ata, ❓ pedir ao juiz, ⚖️ tese). Frases curtas. Sem markdown.`,
  requerimentos: `Monte a lista de REQUERIMENTOS da defesa para ditar agora, conforme o padrão (formulário do item "Requerimentos da defesa em toda custódia" + os vícios arguidos nesta audiência, cada um com pedido de registro em ata, + o que o MP requereu, registrado). Redação pronta para ditar, curta. Texto puro, itens numerados.`,
  alegacoes: `Redija a SUSTENTAÇÃO ORAL da defesa para a custódia, 3 a 5 minutos, na estrutura do padrão (ratificação, vícios, flagrante não prende por si só, condições pessoais pelos documentos, ausência de periculum contemporâneo e provado, regime do art. 319 desenhado, pedidos nomeados corretamente).
Pela transcrição, identifique o que o MP requereu e use o ROTEIRO A (MP pediu preventiva) ou o ROTEIRO B (MP não pediu); se ainda não estiver claro, escreva o A e, depois, um parágrafo curto de adaptação para o B. Se o MP não pediu preventiva ou pediu só medidas diversas, invoque a Súmula 676 do STJ.
Onde faltar dado (Id. da petição, documentos, endereço), deixe [colchetes] para a Carol completar. Frase curta, para falar em pé. Texto puro, sem títulos.`,
};

function instrucoes(modo: Modo, area: Area, temRoteiro: boolean, ato: Ato): string {
  if (ato === "custodia") return INSTRUCOES_CUSTODIA[modo];
  const roteiro = temRoteiro;
  if (modo === "dicas") {
    return `Leia a transcrição até agora e dê no MÁXIMO 4 dicas curtas e acionáveis, focadas no que acabou de acontecer:
- contradições (com os autos, outros depoimentos ou o próprio depoente);
- perguntas que a Carol ainda deve fazer a quem está depondo${roteiro ? ", em especial as do ROTEIRO que ainda não foram feitas" : ""};
- irregularidades para pedir que constem em ata${area === "criminal" ? " (ex.: juiz perguntando antes das partes, art. 212 CPP; reconhecimento fora do art. 226 CPP; testemunha que ouviu o depoimento de outra)" : ""};
${area === "familia" ? "- oportunidades de acordo e como conduzi-lo;\n" : ""}- pontos fortes para as alegações finais${roteiro ? ", sobretudo os que confirmam as teses do ROTEIRO" : ""}.
Se não houver nada novo relevante, responda só: Sem novidades relevantes.
Não cite número de julgado (a Carol confere depois); cite só o artigo de lei.
Formato: uma dica por linha, começando com o emoji da categoria (⚠️ contradição, ❓ pergunta, 📝 consignar em ata, ⚖️ tese${area === "familia" ? ", 🤝 acordo" : ""}). Frases curtas. Sem markdown.`;
  }
  if (modo === "requerimentos") {
    return `A instrução está terminando. Liste os requerimentos de diligências cabíveis para a parte da Carol (${area === "criminal" ? "art. 402 CPP, diligências cuja necessidade se origine de circunstâncias ou fatos apurados na instrução" : "diligências pertinentes ao que foi apurado"}), cada um com o fundamento em uma frase e a redação pronta para ditar à ata.${roteiro ? " Considere as diligências previstas no ROTEIRO, se a instrução confirmou a necessidade." : ""}
Depois, em seção separada, liste o que ainda convém pedir para constar em ata.
Texto puro, sem markdown, itens numerados.`;
  }
  return `Redija as ${area === "criminal" ? "alegações finais ORAIS da defesa (art. 403 CPP: 20 minutos, prorrogáveis por mais 10)" : "razões finais ORAIS (art. 364 CPC: 20 minutos, prorrogáveis por mais 10)"}, prontas para a Carol ler em voz alta, em primeira pessoa.
${roteiro ? "Parta das teses e do material que a Carol já decidiu no ROTEIRO, e use a prova oral colhida na transcrição para sustentá-las. Se a audiência enfraqueceu alguma tese do roteiro, não a force: ajuste ou deixe de lado.\n" : ""}Siga o ESTILO DA CAROL e o MODO SUSTENTAÇÃO ORAL abaixo: texto corrido, sem títulos, sem numeração, sem travessões, sem dois pontos explicativos; saudação ao juízo, narrativa em que cada argumento prepara o seguinte, análise do que cada depoente disse, ${area === "criminal" ? "teses subsidiárias (desclassificação, qualificadoras e majorantes, dosimetria, regime, substituição, recorrer em liberdade) e " : ""}pedido final claro e firme.
Não invente fatos, depoimentos nem julgados com número. Se mencionar entendimento dos tribunais, faça de forma genérica.
Tamanho: cerca de 2.500 a 3.000 palavras. Texto puro, em parágrafos.

ESTILO DA CAROL:
${ESTILO_CAROL}

MODO SUSTENTAÇÃO ORAL:
${MODO_ORAL}`;
}

async function contextoProcesso(processoId: string, audienciaId?: string) {
  const [proc, movs, anots, aud] = await Promise.all([
    supabase
      .from("processos")
      .select("numero,titulo,descricao,tipo,tipo_penal,fase,tribunal,vara,comarca,uf,cliente_nome,parte_contraria,unidade_prisional")
      .eq("id", processoId)
      .maybeSingle(),
    supabase
      .from("movimentacoes")
      .select("data_movimentacao,descricao")
      .eq("processo_id", processoId)
      .order("data_movimentacao", { ascending: false })
      .limit(40),
    supabase
      .from("anotacoes")
      .select("titulo,conteudo,updated_at")
      .eq("processo_id", processoId)
      .order("updated_at", { ascending: false })
      .limit(15),
    audienciaId
      ? supabase.from("audiencias").select("titulo,tipo,data_hora,local").eq("id", audienciaId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const partes = [`PROCESSO:\n${JSON.stringify(proc.data ?? {}, null, 1)}`];
  if (aud.data) partes.push(`AUDIÊNCIA:\n${JSON.stringify(aud.data, null, 1)}`);
  if (movs.data?.length) {
    partes.push(`ANDAMENTOS (mais recentes primeiro):\n${movs.data.map((m) => `- ${m.data_movimentacao}: ${m.descricao}`).join("\n")}`);
  }
  if (anots.data?.length) {
    partes.push(
      `ANOTAÇÕES DA ADVOGADA:\n${anots.data
        .map((a) => `## ${a.titulo ?? "Anotação"}\n${String(a.conteudo).slice(0, 4000)}`)
        .join("\n\n")}`
    );
  }
  return {
    texto: partes.join("\n\n"),
    tipo: (proc.data as { tipo?: string } | null)?.tipo,
    tituloAudiencia: (aud.data as { titulo?: string } | null)?.titulo,
  };
}

export async function POST(req: NextRequest) {
  const { processo_id, audiencia_id, transcricao, modo, roteiro, notas, area: areaEscolhida, ato: atoEscolhido } = (await req.json()) as {
    processo_id?: string;
    audiencia_id?: string;
    transcricao?: string;
    modo?: Modo;
    roteiro?: string;
    notas?: string;
    area?: Area;
    ato?: Ato;
  };
  if (!modo || !(modo in ESFORCO)) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  if (!transcricao?.trim()) {
    return NextResponse.json({ error: "Ainda não há transcrição." }, { status: 400 });
  }

  // Audiência livre (sem processo no Justio): só a transcrição e o roteiro.
  const ctx = processo_id
    ? await contextoProcesso(processo_id, audiencia_id)
    : { texto: "Audiência avulsa, sem processo cadastrado no Justio.", tipo: undefined, tituloAudiencia: undefined };
  const area: Area = areaEscolhida && areaEscolhida in PERFIL ? areaEscolhida : areaDoProcesso(ctx.tipo);
  const ato: Ato = atoEscolhido === "custodia" || atoEscolhido === "instrucao" ? atoEscolhido : atoDaAudiencia(ctx.tituloAudiencia);
  const temRoteiro = !!roteiro?.trim();

  const sistema = [
    PERFIL[area],
    "Você assessora a Carol (Caroline Fraga, OAB/RJ 165955) durante uma audiência que está acontecendo agora. A transcrição é automática: rótulos de falante podem estar trocados e nomes próprios podem vir errados; leve isso em conta e não trate erro de transcrição como contradição.",
    ato === "custodia" ? PADRAO_CUSTODIA : "",
    `DADOS DO JUSTIO:\n${ctx.texto}`,
    temRoteiro ? `ROTEIRO DE AUDIÊNCIA PREPARADO PELA CAROL (perguntas, teses e estratégia já decididas):\n${roteiro!.slice(0, 60000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Autos em PDF (aba "Autos"): o modelo pode pesquisar neles durante a análise.
  const { count: paginasAutos } = processo_id
    ? await supabase.from("autos_paginas").select("id", { count: "exact", head: true }).eq("processo_id", processo_id)
    : { count: 0 };
  const tools: Anthropic.Beta.BetaTool[] = paginasAutos
    ? [
        {
          name: "pesquisar_autos",
          description: `Pesquisa no texto dos autos do processo (${paginasAutos} páginas em PDF). Use para conferir o que um depoente disse antes (inquérito, depoimentos anteriores), laudos, reconhecimento, denúncia etc. Busca por palavras (sem acento, plurais tolerados); várias palavras = todas devem aparecer; use "or" para alternativas (ex.: "joao or silva"). Retorna as páginas mais relevantes. Cite como "autos, arquivo X, p. N".`,
          input_schema: {
            type: "object",
            properties: { termos: { type: "string", description: "Palavras-chave: nomes, termos técnicos, fatos" } },
            required: ["termos"],
            additionalProperties: false,
          },
          strict: true,
        },
      ]
    : [];

  const client = new Anthropic({ apiKey: envLimpo("ANTHROPIC_API_KEY") });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `TRANSCRIÇÃO ATÉ AGORA:\n${transcricao}\n\n${
        notas?.trim()
          ? `ANOTAÇÕES DA CAROL DURANTE A AUDIÊNCIA (impressões e decisões dela; têm prioridade sobre as suas sugestões):\n${notas.slice(0, 20000)}\n\n`
          : ""
      }---\n${instrucoes(modo, area, temRoteiro, ato)}${
        paginasAutos ? "\n\nOs autos estão disponíveis pela ferramenta pesquisar_autos: confira nos autos antes de apontar contradição com o que foi dito antes." : ""
      }`,
    },
  ];

  const encoder = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Até 4 rodadas de pesquisa nos autos; o texto de cada rodada vai sendo enviado.
        for (let rodada = 0; rodada < 5; rodada++) {
          const stream = client.beta.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS[modo],
            betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
            // Entre rodadas de pesquisa nos autos o bloco de raciocínio pode não casar com a conversa: descarta em vez de dar 400.
            thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
            fallbacks: "default",
            output_config: { effort: ESFORCO[modo] },
            system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
            ...(tools.length && rodada < 4 ? { tools } : {}),
            messages,
          } as Anthropic.Beta.MessageCreateParamsStreaming);

          for await (const ev of stream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(ev.delta.text));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n[O modelo recusou esta análise.]"));
          if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode("\n\n[Texto cortado pelo limite de tamanho.]"));
          if (final.stop_reason !== "tool_use" || !processo_id) break;

          const usos = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          messages.push({ role: "assistant", content: final.content });
          const resultados = await Promise.all(
            usos.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
              const termos = String((u.input as { termos?: string }).termos ?? "");
              const { data, error } = await supabase.rpc("buscar_autos", { p_processo: processo_id, p_q: termos, p_limite: 5 });
              if (error) return { type: "tool_result", tool_use_id: u.id, content: error.message, is_error: true };
              const achados = (data ?? []) as { arquivo: string; pagina: number; trecho: string }[];
              return {
                type: "tool_result",
                tool_use_id: u.id,
                content: achados.length
                  ? achados.map((r) => `[${r.arquivo}, p. ${r.pagina}]\n${r.trecho}`).join("\n\n---\n\n")
                  : "Nada encontrado com esses termos.",
              };
            })
          );
          messages.push({ role: "user", content: resultados });
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[Erro na análise: ${e instanceof Error ? e.message : String(e)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(corpo, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
