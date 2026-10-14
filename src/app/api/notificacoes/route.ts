import { NextRequest, NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { enviarPush, removerInscricao, salvarInscricao, vapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";

// Inscrição dos aparelhos da Carol nas notificações (rota protegida pelo login, no middleware).

export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

// POST { acao: "inscrever", subscription } | { acao: "cancelar", endpoint } | { acao: "testar" }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { acao?: string; subscription?: PushSubscription; endpoint?: string };
  if (body.acao === "inscrever") {
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return NextResponse.json({ error: "inscrição inválida" }, { status: 400 });
    await salvarInscricao(sub, req.headers.get("user-agent") ?? undefined);
    return NextResponse.json({ ok: true });
  }
  if (body.acao === "cancelar" && body.endpoint) {
    await removerInscricao(body.endpoint);
    return NextResponse.json({ ok: true });
  }
  if (body.acao === "testar") {
    const n = await enviarPush({ title: "Justio ⚖️", body: "As notificações estão funcionando neste aparelho!", url: "/dashboard" });
    return NextResponse.json({ ok: true, enviados: n });
  }
  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
