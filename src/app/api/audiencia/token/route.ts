import { NextResponse } from "next/server";
import { envLimpo } from "@/lib/env";

export const runtime = "nodejs";

// Senha temporária do Deepgram para o navegador abrir a transcrição ao vivo
// sem expor a chave de administrador (DEEPGRAM_ADMIN_KEY fica só no servidor).
export async function POST() {
  const chave = envLimpo("DEEPGRAM_ADMIN_KEY");
  if (!chave) {
    return NextResponse.json({ error: "Transcrição ao vivo não configurada (DEEPGRAM_ADMIN_KEY)." }, { status: 503 });
  }

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 60 }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Deepgram recusou a senha temporária (${res.status}).` }, { status: 502 });
  }
  const { access_token } = (await res.json()) as { access_token: string };
  return NextResponse.json({ token: access_token });
}
