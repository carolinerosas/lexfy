import { NextRequest, NextResponse } from "next/server";
import { SENHA_MIN, trocarSenha } from "@/lib/acesso";
import { COOKIE_SESSAO, DURACAO_SESSAO_S, OPCOES_COOKIE, criarSessao, lerSessao } from "@/lib/sessao";

// Troca de senha dentro do JUSTIO (Configurações). Exige sessão aberta e a senha atual.
export async function POST(req: NextRequest) {
  if (!(await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value))) {
    return NextResponse.json({ error: "Entre de novo para trocar a senha." }, { status: 401 });
  }
  const { atual, nova } = (await req.json().catch(() => ({}))) as { atual?: string; nova?: string };
  const r = await trocarSenha(atual ?? "", nova ?? "");
  if (!r.ok) {
    const msg = r.motivo === "senha-curta" ? `A senha nova precisa ter pelo menos ${SENHA_MIN} caracteres.`
      : r.motivo === "bloqueado" ? "Muitas tentativas. Aguarde 15 minutos." : "A senha atual não confere.";
    return NextResponse.json({ error: msg }, { status: r.motivo === "senha-curta" ? 400 : r.motivo === "bloqueado" ? 429 : 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, await criarSessao(r.versao, DURACAO_SESSAO_S), { ...OPCOES_COOKIE, maxAge: DURACAO_SESSAO_S });
  return res;
}
