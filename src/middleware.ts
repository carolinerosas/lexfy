import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

export async function middleware(req: NextRequest) {
  // Confere assinatura e validade do cookie. A versão (senha trocada) é conferida no /api/supabase.
  const sessao = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value);

  if (!sessao) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /triagem e /api/triagem: chat de triagem fechado ao público (só com login).
  // /api/supabase: acesso do navegador ao banco (a rota confere o login de novo).
  // Demais /api daqui: usadas só pelas telas do dashboard.
  matcher: [
    "/dashboard/:path*",
    "/triagem",
    "/api/triagem",
    "/api/audiencia/:path*",
    "/api/pecas/:path*",
    "/api/notificacoes",
    "/api/autos/:path*",
    "/api/supabase/:path*",
    "/api/publicacoes/status",
    "/api/datajud",
    "/api/eproc",
    "/api/pje",
    "/api/pje-rj",
    "/api/tjrj",
  ],
};
