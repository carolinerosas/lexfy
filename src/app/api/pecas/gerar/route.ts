import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { ESTILO_CAROL } from "@/lib/audiencia/estilo-carol";
import { PERFIL, areaDoProcesso, type Area } from "@/lib/audiencia/perfis";
import { tipoPeca } from "@/lib/pecas/tipos";
import { bloqueioPorLimite, registrarUso } from "@/lib/ia-uso";

export const runtime = "nodejs";
export const maxDuration = 300;

// Gera uma peça escrita (alegações finais, resposta à acusação etc.) a partir do processo,
// das anotações escolhidas (inclusive a transcrição da audiência) e do texto dos autos
// (aba "Autos"), no perfil da advogada escolhido. Resposta em stream de texto puro.

const MODEL = process.env.PECAS_MODEL || process.env.AUDIENCIA_MODEL || "claude-opus-5-5";
const LIMITE_ANOTACAO = 150_000;
const LIMITE_TOTAL_ANOTACOES = 300_000;

interface Corpo {
  processo_id?: string;
  tipo?: string;
  area?: Area;
  projeto?: string;
  instrucoes?: string;
  anotacao_ids?: string[];
  usar_autos?: boolean;
  rascunho?: string;
  ajuste?: string;
}

export async function POST(req: NextRequest) {
  const c = (await req.json()) as Corpo;
  if (!c.processo_id) return NextResponse.json({ error: "Processo não informado." }, { status: 400 });
  const bloqueio = await bloqueioPorLimite();
  if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 429 });

  const [proc, movs] = await Promise.all([
    supabase
      .from("processos")
      .select("numero,titulo,descricao,tipo,tipo_penal,fase,tribunal,vara,comarca,uf,cliente_nome,parte_contraria,unidade_prisional")
      .eq("id", c.processo_id)
      .maybeSingle(),
    supabase
      .from("movimentacoes")
      .select("data_movimentacao,descricao")
      .eq("processo_id", c.processo_id)
      .order("data_movimentacao", { ascending: false })
      .limit(40),
  ]);
  if (!proc.data) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  let anotacoes: { titulo: string | null; conteudo: string; updated_at: string }[] = [];
  if (c.anotacao_ids?.length) {
    const { data } = await supabase
      .from("anotacoes")
      .select("titulo,conteudo,updated_at")
      .eq("processo_id", c.processo_id)
      .in("id", c.anotacao_ids)
      .order("created_at", { ascending: true });
    anotacoes = data ?? [];
  }

  let restante = LIMITE_TOTAL_ANOTACOES;
  const blocosAnotacoes = anotacoes.map((a) => {
    const texto = String(a.conteudo).slice(0, Math.min(LIMITE_ANOTACAO, restante));
    restante -= texto.length;
    return `## ${a.titulo ?? "Anotação"}\n${texto}`;
  });

  const { count: paginasAutos } = c.usar_autos
    ? await supabase.from("autos_paginas").select("id", { count: "exact", head: true }).eq("processo_id", c.processo_id)
    : { count: 0 };

  const area: Area = c.area && c.area in PERFIL ? c.area : areaDoProcesso((proc.data as { tipo?: string }).tipo);
  const tipo = tipoPeca(c.tipo);

  const sistema = [
    PERFIL[area],
    c.projeto?.trim() ? `INSTRUÇÕES DO PROJETO ESCOLHIDO PELA CAROL (valem sobre o perfil acima em caso de conflito):\n${c.projeto.slice(0, 40000)}` : "",
    "Você redige peças para a Carol (Caroline Fraga Rosas Marinho, OAB/RJ 165955). A transcrição da audiência é automática: rótulos de falante podem estar trocados e nomes próprios podem vir errados; leve isso em conta e não trate erro de transcrição como contradição entre depoimentos. Não invente fatos, depoimentos, páginas dos autos nem julgados com número; se citar entendimento dos tribunais, faça de forma genérica. Onde faltar dado, deixe [colchetes] para a Carol completar.",
    `ESTILO DA CAROL:\n${ESTILO_CAROL}`,
    `DADOS DO PROCESSO NO JUSTIO:\n${JSON.stringify(proc.data, null, 1)}`,
    movs.data?.length ? `ANDAMENTOS (mais recentes primeiro):\n${movs.data.map((m) => `- ${m.data_movimentacao}: ${m.descricao}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const partesPedido: string[] = [];
  if (blocosAnotacoes.length) partesPedido.push(`ANOTAÇÕES E TRANSCRIÇÕES ESCOLHIDAS:\n${blocosAnotacoes.join("\n\n")}`);
  if (c.rascunho?.trim()) {
    partesPedido.push(
      `RASCUNHO ATUAL DA PEÇA (já editado pela Carol; preserve o que ela escreveu e mude só o que o ajuste pedir):\n${c.rascunho.slice(0, 150000)}`
    );
    partesPedido.push(`AJUSTE PEDIDO: ${c.ajuste?.trim() || "revise e melhore a peça mantendo o estilo."}\nDevolva a peça inteira, já ajustada, em texto puro.`);
  } else {
    partesPedido.push(`${tipo.instrucao}${c.instrucoes?.trim() ? `\n\nINSTRUÇÕES ADICIONAIS DA CAROL (prioridade sobre o padrão acima):\n${c.instrucoes.slice(0, 20000)}` : ""}`);
    partesPedido.push("Entregue a peça completa em texto puro, em parágrafos, sem markdown.");
  }
  if (paginasAutos) partesPedido.push("Os autos estão disponíveis pela ferramenta pesquisar_autos: confira nos autos o que for citar antes de afirmar.");

  const tools: Anthropic.Beta.BetaTool[] = paginasAutos
    ? [
        {
          name: "pesquisar_autos",
          description: `Pesquisa no texto dos autos do processo (${paginasAutos} páginas em PDF). Use para conferir depoimentos do inquérito, laudos, reconhecimento, denúncia, decisões etc. Busca por palavras (sem acento, plurais tolerados); várias palavras = todas devem aparecer; use "or" para alternativas (ex.: "joao or silva"). Retorna as páginas mais relevantes. Cite como "autos, arquivo X, p. N".`,
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
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: partesPedido.join("\n\n---\n") }];
  const RODADAS = 9;

  const encoder = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let rodada = 0; rodada < RODADAS; rodada++) {
          const stream = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 24000,
            betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
            // Entre rodadas de pesquisa nos autos o bloco de raciocínio pode não casar com a conversa: descarta em vez de dar 400.
            thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
            fallbacks: "default",
            output_config: { effort: "high" },
            system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
            ...(tools.length && rodada < RODADAS - 1 ? { tools } : {}),
            messages,
          } as Anthropic.Beta.MessageCreateParamsStreaming);

          for await (const ev of stream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(ev.delta.text));
            }
          }
          const final = await stream.finalMessage();
          await registrarUso("pecas/gerar", MODEL, final.usage);
          if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n[O modelo recusou esta peça.]"));
          if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode("\n\n[Texto cortado pelo limite de tamanho.]"));
          if (final.stop_reason !== "tool_use") break;

          const usos = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          messages.push({ role: "assistant", content: final.content });
          const resultados = await Promise.all(
            usos.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
              const termos = String((u.input as { termos?: string }).termos ?? "");
              const { data, error } = await supabase.rpc("buscar_autos", { p_processo: c.processo_id, p_q: termos, p_limite: 5 });
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
        controller.enqueue(encoder.encode(`\n\n[Erro ao gerar a peça: ${e instanceof Error ? e.message : String(e)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(corpo, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
