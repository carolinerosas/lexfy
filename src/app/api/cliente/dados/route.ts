import { NextResponse } from "next/server";
import { acessoAtual, dadosDoAcesso, registrar } from "@/lib/portal/servidor";

export const runtime = "nodejs";

// Tudo que o acesso logado pode ver (e nada além disso).
export async function GET() {
  const acesso = await acessoAtual();
  if (!acesso) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const dados = await dadosDoAcesso(acesso);
  await registrar(acesso.id, "viu_painel");
  return NextResponse.json({ nome: acesso.nome, ...dados }, { headers: { "cache-control": "no-store" } });
}
