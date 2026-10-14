import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { ESTILO_CAROL, MODO_ORAL } from "@/lib/audiencia/estilo-carol";
import { PERFIL, areaDoProcesso, type Area } from "@/lib/audiencia/perfis";

export const runtime = "nodejs";
export const maxDuration = 300;

// Analisa a transcrição da audiência em andamento, com o processo e o roteiro da Carol
// como contexto, no perfil da área (criminal, família ou geral). Modos: dicas (curtas,
// a cada minuto), requerimentos finais e alegações finais orais. Resposta em stream.

type Modo = "dicas" | "requerimentos" | "alegacoes";

const MODEL = process.env.AUDIENCIA_MODEL || "claude-opus-5-5";

const ESFORCO: Record<Modo, "low" | "medium" | "high"> = { dicas: "low", requerimentos: "medium", alegacoes: "high" };
const MAX_TOKENS: Record<Modo, number> = { dicas: 1500, requerimentos: 6000, alegacoes: 16000 };

function instrucoes(modo: Modo, area: Area, temRoteiro: boolean): string {
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
  return { texto: partes.join("\n\n"), tipo: (proc.data as { tipo?: string } | null)?.tipo };
}

export async function POST(req: NextRequest) {
  const { processo_id, audiencia_id, transcricao, modo, roteiro, notas, area: areaEscolhida } = (await req.json()) as {
    processo_id?: string;
    audiencia_id?: string;
    transcricao?: string;
    modo?: Modo;
    roteiro?: string;
    notas?: string;
    area?: Area;
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
    : { texto: "Audiência avulsa, sem processo cadastrado no Justio.", tipo: undefined };
  const area: Area = areaEscolhida && areaEscolhida in PERFIL ? areaEscolhida : areaDoProcesso(ctx.tipo);
  const temRoteiro = !!roteiro?.trim();

  const sistema = [
    PERFIL[area],
    "Você assessora a Carol (Caroline Fraga, OAB/RJ 165955) durante uma audiência que está acontecendo agora. A transcrição é automática: rótulos de falante podem estar trocados e nomes próprios podem vir errados; leve isso em conta e não trate erro de transcrição como contradição.",
    `DADOS DO JUSTIO:\n${ctx.texto}`,
    temRoteiro ? `ROTEIRO DE AUDIÊNCIA PREPARADO PELA CAROL (perguntas, teses e estratégia já decididas):\n${roteiro!.slice(0, 60000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey: envLimpo("ANTHROPIC_API_KEY") });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS[modo],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: ESFORCO[modo] },
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `TRANSCRIÇÃO ATÉ AGORA:\n${transcricao}\n\n${
          notas?.trim()
            ? `ANOTAÇÕES DA CAROL DURANTE A AUDIÊNCIA (impressões e decisões dela; têm prioridade sobre as suas sugestões):\n${notas.slice(0, 20000)}\n\n`
            : ""
        }---\n${instrucoes(modo, area, temRoteiro)}`,
      },
    ],
  } as Anthropic.Beta.MessageCreateParamsStreaming);

  const encoder = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n[O modelo recusou esta análise.]"));
        if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode("\n\n[Texto cortado pelo limite de tamanho.]"));
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[Erro na análise: ${e instanceof Error ? e.message : String(e)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(corpo, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
