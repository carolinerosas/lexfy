import { NextRequest, NextResponse } from "next/server";
import { criarTokenRedefinicao } from "@/lib/acesso";
import { EMAIL_ACESSO, enviarEmail } from "@/lib/email";
import { envLimpo } from "@/lib/env";

// "Esqueci minha senha": manda um link de redefinição (30 min) para o e-mail da Carol.
// O link só abre a tela; a senha só muda ao salvar (robôs que abrem links de e-mail não gastam nada).

function origemDoLink(req: NextRequest): string {
  // Em produção o link sempre aponta para o domínio oficial (não confiar no Host da requisição).
  return process.env.VERCEL_ENV === "production" ? "https://www.justio.com.br" : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const token = await criarTokenRedefinicao();
  if (token) {
    const link = `${origemDoLink(req)}/login/redefinir?token=${encodeURIComponent(token)}`;
    const enviado = await enviarEmail(
      envLimpo("JUSTIO_EMAIL_ACESSO") ?? EMAIL_ACESSO,
      "Redefinir a senha do Justio",
      "Recebemos um pedido para redefinir a senha do Justio.\nO link vale por 30 minutos.\nSe não foi você, ignore este e-mail: a senha atual continua valendo.",
      link
    );
    if (!enviado) return NextResponse.json({ error: "Não consegui enviar o e-mail." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
