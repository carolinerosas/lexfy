import { NextRequest, NextResponse } from "next/server";
import { criarTokenRedefinicao } from "@/lib/acesso";
import { enviarMensagem } from "@/lib/telegram/api";

// "Esqueci minha senha": manda um link de redefinição (30 min) para o Telegram da Carol.
// A resposta é sempre a mesma, para não revelar nada a quem não é ela.

const RESPOSTA = { ok: true, mensagem: "Se estiver tudo certo, o link chega no seu Telegram em instantes." };

function origemDoLink(req: NextRequest): string {
  // Em produção o link sempre aponta para o domínio oficial (não confiar no Host da requisição).
  return process.env.VERCEL_ENV === "production" ? "https://www.justio.com.br" : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const chatId = Number(process.env.TELEGRAM_CHAT_ID);
  if (!chatId) return NextResponse.json({ error: "Telegram não configurado" }, { status: 500 });

  const token = await criarTokenRedefinicao();
  if (token) {
    const link = `${origemDoLink(req)}/login/redefinir?token=${encodeURIComponent(token)}`;
    await enviarMensagem(
      chatId,
      `Pedido para redefinir a senha do Justio.\n\nAbra este link em até 30 minutos:\n${link}\n\nSe não foi você, ignore esta mensagem: a senha atual continua valendo.`
    );
  }
  return NextResponse.json(RESPOSTA);
}
