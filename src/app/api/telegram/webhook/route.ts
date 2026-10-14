import { NextRequest, NextResponse, after } from "next/server";
import { baixarArquivo, digitando, editarMensagem, enviarMensagem, responderBotao } from "@/lib/telegram/api";
import { TranscricaoIndisponivel, transcreverAudio } from "@/lib/telegram/transcricao";
import { conversar } from "@/lib/telegram/assistente";
import { decidirProposta, guardarProposta, textoProposta } from "@/lib/telegram/propostas";

export const runtime = "nodejs";
export const maxDuration = 120;

// Webhook do bot @CarolineFragaBot. Só responde ao chat da Carol (TELEGRAM_CHAT_ID).
// Registros no Justio só acontecem quando ela aperta "Salvar" na proposta.

interface TgMensagem {
  message_id: number;
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; mime_type?: string; duration: number };
  audio?: { file_id: string; mime_type?: string; duration: number };
}

interface TgUpdate {
  message?: TgMensagem;
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number }; text?: string } };
}


async function tratarMensagem(msg: TgMensagem) {
  const chatId = msg.chat.id;
  let texto = msg.text?.trim() ?? "";

  if (texto === "/start") {
    await enviarMensagem(
      chatId,
      "Oi, Carol! Pode me mandar texto ou áudio. Ex.: \"juiz deferiu o extramuros do Raphael\" (eu proponho o registro e você confirma) ou \"qual o próximo prazo do Carlinhos?\"."
    );
    return;
  }

  const arquivo = msg.voice ?? msg.audio;
  if (arquivo) {
    await digitando(chatId);
    try {
      const { dados } = await baixarArquivo(arquivo.file_id);
      texto = await transcreverAudio(dados, arquivo.mime_type ?? "audio/ogg");
    } catch (e) {
      if (e instanceof TranscricaoIndisponivel) {
        await enviarMensagem(chatId, "A transcrição de áudio ainda não está ativada (falta a chave do Deepgram). Por enquanto, me manda por texto?");
        return;
      }
      throw e;
    }
    if (!texto) {
      await enviarMensagem(chatId, "Não consegui entender o áudio. Pode gravar de novo?");
      return;
    }
    await enviarMensagem(chatId, `🎙️ Entendi: "${texto}"`);
  }

  if (!texto) return;
  await digitando(chatId);
  const resposta = await conversar(texto);

  if (resposta.texto) await enviarMensagem(chatId, resposta.texto);
  // Uma mensagem com botões para cada coisa proposta; nada é gravado sem o "Salvar".
  for (const p of resposta.propostas) {
    const id = await guardarProposta(p.tipo, p.dados);
    await enviarMensagem(chatId, textoProposta(p.tipo, p.dados), [
      [
        { text: "✅ Salvar", callback_data: `ok|${id}` },
        { text: "❌ Cancelar", callback_data: `no|${id}` },
      ],
    ]);
  }
}

async function tratarBotao(cb: NonNullable<TgUpdate["callback_query"]>) {
  const msg = cb.message;
  const [acao, id] = (cb.data ?? "").split("|");
  if (!msg?.text || !id || (acao !== "ok" && acao !== "no")) {
    await responderBotao(cb.id, "Proposta antiga: manda de novo, por favor.");
    return;
  }
  const salvar = acao === "ok";
  try {
    const { jaDecidida } = await decidirProposta(id, salvar);
    if (jaDecidida) {
      await responderBotao(cb.id, "Essa já tinha sido decidida.");
      return;
    }
    await responderBotao(cb.id, salvar ? "Salvo!" : "Cancelado");
    await editarMensagem(msg.chat.id, msg.message_id, `${msg.text}

${salvar ? "✅ Salvo no Justio." : "❌ Cancelado — nada foi gravado."}`);
  } catch (e) {
    await responderBotao(cb.id, "Erro ao salvar");
    await enviarMensagem(msg.chat.id, `Não consegui gravar no Justio: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function POST(req: NextRequest) {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!segredo || req.headers.get("x-telegram-bot-api-secret-token") !== segredo) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json()) as TgUpdate;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  const dona = Number(process.env.TELEGRAM_CHAT_ID);

  // Responde já ao Telegram (senão ele reenvia) e processa em seguida.
  after(async () => {
    if (!chatId) return;
    if (!dona) {
      await enviarMensagem(chatId, `Bot ainda não configurado. ID desta conversa: ${chatId}`);
      return;
    }
    if (chatId !== dona) return;
    try {
      if (update.callback_query) await tratarBotao(update.callback_query);
      else if (update.message) await tratarMensagem(update.message);
    } catch (e) {
      console.error("[telegram]", e);
      await enviarMensagem(chatId, "Deu um erro aqui do meu lado. Tenta de novo daqui a pouco?").catch(() => {});
    }
  });

  return NextResponse.json({ ok: true });
}
