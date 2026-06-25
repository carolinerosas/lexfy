import { NextRequest, NextResponse } from "next/server";
import { createBriefing } from "@/lib/store";

export const runtime = "nodejs";

function getAgentToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-justio-agent-token")?.trim() ?? "";
}

// POST /api/briefing
// Recebe o briefing jurídico diário do agente e guarda na seção Briefing do Justio.
// Body: { "data": "2026-06-25", "conteudo": "<texto>", "origem": "claude-agent" }
export async function POST(req: NextRequest) {
  const expected = process.env.JUSTIO_AGENT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "JUSTIO_AGENT_TOKEN não configurado no servidor." },
      { status: 503 }
    );
  }
  if (getAgentToken(req) !== expected) {
    return NextResponse.json({ error: "Token do agente inválido." }, { status: 401 });
  }

  try {
    const { data, conteudo, origem } = (await req.json()) as {
      data?: string;
      conteudo?: string;
      origem?: string;
    };
    const texto = conteudo?.trim();
    if (!texto) {
      return NextResponse.json({ error: "conteudo vazio." }, { status: 400 });
    }
    const briefing = await createBriefing({
      data: data?.trim() || undefined,
      conteudo: texto,
      origem: origem?.trim() || "claude-agent",
    });
    return NextResponse.json({ ok: true, briefing });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao salvar o briefing." },
      { status: 500 }
    );
  }
}
