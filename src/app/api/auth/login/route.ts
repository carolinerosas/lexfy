import { NextRequest, NextResponse } from "next/server";
import { conferirLogin } from "@/lib/acesso";
import { COOKIE_SESSAO, DURACAO_SESSAO_CURTA_S, DURACAO_SESSAO_S, OPCOES_COOKIE, criarSessao } from "@/lib/sessao";

export async function POST(req: NextRequest) {
  const { username, password, lembrar } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    lembrar?: boolean;
  };
  if (!username || !password) {
    return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
  }

  let resultado;
  try {
    resultado = await conferirLogin(username, password);
  } catch {
    return NextResponse.json({ error: "Configuração inválida" }, { status: 500 });
  }

  if (!resultado.ok) {
    return resultado.motivo === "bloqueado"
      ? NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos ou redefina a senha." }, { status: 429 })
      : NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // "Permanecer conectado": 30 dias. Sem marcar: cookie de sessão (some ao fechar o navegador) e no máximo 12 h.
  if (lembrar) {
    res.cookies.set(COOKIE_SESSAO, await criarSessao(resultado.versao, DURACAO_SESSAO_S), { ...OPCOES_COOKIE, maxAge: DURACAO_SESSAO_S });
  } else {
    res.cookies.set(COOKIE_SESSAO, await criarSessao(resultado.versao, DURACAO_SESSAO_CURTA_S), OPCOES_COOKIE);
  }
  return res;
}
