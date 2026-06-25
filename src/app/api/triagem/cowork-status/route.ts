import { NextRequest, NextResponse } from "next/server";
import { listarCoworkImportados } from "@/lib/store";

export const runtime = "nodejs";

function getAgentToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-justio-agent-token")?.trim() ?? "";
}

// GET /api/triagem/cowork-status
// Protegido pelo token do agente. Retorna as conversas do Cowork já importadas,
// para o agente diário decidir o que ainda precisa mandar (dedup).
export async function GET(req: NextRequest) {
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
    const enviados = await listarCoworkImportados();
    return NextResponse.json({ enviados });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao consultar status." },
      { status: 500 }
    );
  }
}
