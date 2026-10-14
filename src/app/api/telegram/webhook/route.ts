import { NextRequest, NextResponse, after } from "next/server";
import { baixarArquivo, digitando, editarMensagem, enviarMensagem, responderBotao } from "@/lib/telegram/api";
import { TranscricaoIndisponivel, transcreverAudio } from "@/lib/telegram/transcricao";
import { conversar, enviarParaTriagem, gravarRegistro, type PropostaRegistro } from "@/lib/telegram/assistente";

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

const TITULO_PROPOSTA = "📌 Registrar no Justio?";
const TITULO_TRIAGEM = "📥 Não achei no Justio. Mandar para a Triagem?";

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function dataISO(br: string): string {
  const [d, m, a] = br.split("/");
  return `${a}-${m}-${d}`;
}

/** A proposta viaja no próprio texto da mensagem; o botão leva destino, tipo e id. */
function textoProposta(p: PropostaRegistro): string {
  const cabecalho = [
    TITULO_PROPOSTA,
    `Onde: ${p.rotulo.replace(/\n+/g, " ")}`,
    `Tipo: ${p.tipo === "andamento" && p.destino === "processo" ? "Andamento" : "Anotação"}`,
    `Data: ${dataBR(p.data)}`,
    ...(p.tipo === "anotacao" && p.titulo ? [`Título: ${p.titulo.replace(/\n+/g, " ")}`] : []),
  ];
  return `${cabecalho.join("\n")}\n\n${p.texto}`;
}

function lerProposta(texto: string, dadosBotao: string) {
  const [, codigo, id] = dadosBotao.split("|");
  const [cabecalho, ...resto] = texto.split("\n\n");
  const data = cabecalho.match(/^Data: (\d{2}\/\d{2}\/\d{4})$/m)?.[1];
  if (!codigo || !id || !data) throw new Error("Proposta ilegível");
  return {
    destino: codigo[0] === "p" ? ("processo" as const) : ("cliente" as const),
    tipo: codigo[1] === "m" ? ("andamento" as const) : ("anotacao" as const),
    id,
    data: dataISO(data),
    titulo: cabecalho.match(/^Título: (.+)$/m)?.[1],
    texto: resto.join("\n\n").trim(),
  };
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

  if (resposta.proposta) {
    const p = resposta.proposta;
    const codigo = `${p.destino === "processo" ? "p" : "c"}${p.tipo === "andamento" && p.destino === "processo" ? "m" : "n"}`;
    if (resposta.texto) await enviarMensagem(chatId, resposta.texto);
    await enviarMensagem(chatId, textoProposta(p), [
      [
        { text: "✅ Salvar", callback_data: `s|${codigo}|${p.id}` },
        { text: "❌ Cancelar", callback_data: "x" },
      ],
    ]);
    return;
  }

  if (resposta.triagem) {
    if (resposta.texto) await enviarMensagem(chatId, resposta.texto);
    await enviarMensagem(chatId, `${TITULO_TRIAGEM}\n\n${resposta.triagem}`, [
      [
        { text: "📥 Mandar", callback_data: "t" },
        { text: "❌ Cancelar", callback_data: "x" },
      ],
    ]);
    return;
  }
  await enviarMensagem(chatId, resposta.texto);
}

async function tratarBotao(cb: NonNullable<TgUpdate["callback_query"]>) {
  const msg = cb.message;
  if (!msg?.text || !cb.data) return responderBotao(cb.id);

  if (cb.data === "x") {
    await responderBotao(cb.id, "Cancelado");
    await editarMensagem(msg.chat.id, msg.message_id, `${msg.text}\n\n❌ Cancelado — nada foi gravado.`);
    return;
  }
  if (msg.text.endsWith("gravado no Justio.") || msg.text.endsWith("está na Triagem.")) {
    return responderBotao(cb.id, "Já estava salvo");
  }

  if (cb.data === "t") {
    try {
      await enviarParaTriagem(msg.text.split("\n\n").slice(1).join("\n\n").trim());
      await responderBotao(cb.id, "Enviado!");
      await editarMensagem(msg.chat.id, msg.message_id, `${msg.text}\n\n✅ Enviado — está na Triagem.`);
    } catch (e) {
      await responderBotao(cb.id, "Erro ao enviar");
      await enviarMensagem(msg.chat.id, `Não consegui mandar para a Triagem: ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }

  try {
    await gravarRegistro(lerProposta(msg.text, cb.data));
    await responderBotao(cb.id, "Salvo!");
    await editarMensagem(msg.chat.id, msg.message_id, `${msg.text}\n\n✅ Salvo — gravado no Justio.`);
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
