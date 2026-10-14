import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// Analisa a transcrição da audiência em andamento, com o processo como contexto.
// Modos: dicas (curtas, a cada minuto), requerimentos finais (art. 402 CPP) e
// alegações finais orais (art. 403 CPP). A resposta vem em texto corrido (stream).

type Modo = "dicas" | "requerimentos" | "alegacoes";

const MODEL = process.env.AUDIENCIA_MODEL || "claude-opus-5-5";

const ESFORCO: Record<Modo, "low" | "medium" | "high"> = { dicas: "low", requerimentos: "medium", alegacoes: "high" };
const MAX_TOKENS: Record<Modo, number> = { dicas: 1500, requerimentos: 6000, alegacoes: 16000 };

const INSTRUCOES: Record<Modo, string> = {
  dicas: `Leia a transcrição até agora e dê no MÁXIMO 4 dicas curtas e acionáveis para a defesa, focadas no que acabou de acontecer:
- contradições (com o inquérito, a denúncia, outros depoimentos ou o próprio depoente);
- perguntas que a defesa ainda deve fazer a quem está depondo;
- nulidades ou irregularidades para pedir que constem em ata (ex.: perguntas do juiz antes das partes — art. 212 CPP; reconhecimento fora do art. 226 CPP; testemunha que ouviu o depoimento de outra);
- pontos fortes para as alegações finais.
Se não houver nada novo relevante, responda só: Sem novidades relevantes.
Não cite número de julgado (a advogada confere depois); cite só o artigo de lei.
Formato: uma dica por linha, começando com o emoji da categoria (⚠️ contradição, ❓ pergunta, 📝 consignar em ata, ⚖️ tese). Frases curtas. Sem markdown.`,
  requerimentos: `A instrução está terminando. Liste os requerimentos de diligências cabíveis para a defesa (art. 402 CPP — diligências cuja necessidade se origine de circunstâncias ou fatos apurados na instrução), cada um com o fundamento em uma frase e a redação pronta para ditar à ata.
Depois, em seção separada, liste o que ainda convém pedir para constar em ata.
Se o processo não for criminal, adapte ao rito cabível. Texto puro, sem markdown, itens numerados.`,
  alegacoes: `Redija as alegações finais ORAIS da defesa (art. 403 CPP: 20 minutos, prorrogáveis por mais 10), prontas para a advogada ler em voz alta, em primeira pessoa.
Estilo: forense, elegante, persuasivo e erudito, mas com frases que soem bem faladas.
Estrutura: saudação ao juízo e às partes; síntese breve da acusação; preliminares e nulidades (se houver base na transcrição ou nos autos); mérito, analisando a prova oral colhida e citando o que cada depoente disse; teses subsidiárias (desclassificação, afastamento de qualificadoras/majorantes, dosimetria com pena-base no mínimo, atenuantes, minorantes, regime mais brando, substituição da pena, direito de recorrer em liberdade); pedidos finais.
Não invente fatos, depoimentos nem julgados com número. Se mencionar entendimento dos tribunais, faça de forma genérica.
Se o processo não for criminal, adapte para razões finais orais do rito cabível.
Tamanho: cerca de 2.500 a 3.000 palavras. Texto puro, em parágrafos, sem markdown.`,
};

async function contextoProcesso(processoId: string, audienciaId?: string): Promise<string> {
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
  return partes.join("\n\n");
}

export async function POST(req: NextRequest) {
  const { processo_id, audiencia_id, transcricao, modo } = (await req.json()) as {
    processo_id?: string;
    audiencia_id?: string;
    transcricao?: string;
    modo?: Modo;
  };
  if (!modo || !(modo in INSTRUCOES)) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  if (!transcricao?.trim()) {
    return NextResponse.json({ error: "Ainda não há transcrição." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: envLimpo("ANTHROPIC_API_KEY") });
  // Audiência livre (sem processo no Justio): só a transcrição.
  const contexto = processo_id
    ? await contextoProcesso(processo_id, audiencia_id)
    : "Audiência avulsa, sem processo cadastrado no Justio. Use só a transcrição.";

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS[modo],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: ESFORCO[modo] },
    system: [
      {
        type: "text",
        text: `Você assessora a advogada Caroline Fraga (OAB/RJ 165955), que atua na DEFESA, durante uma audiência que está acontecendo agora. A transcrição é automática: rótulos de falante podem estar trocados e nomes próprios podem vir errados — leve isso em conta e não trate erro de transcrição como contradição.\n\nDADOS DO JUSTIO:\n${contexto}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: `TRANSCRIÇÃO ATÉ AGORA:\n${transcricao}\n\n---\n${INSTRUCOES[modo]}` }],
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
