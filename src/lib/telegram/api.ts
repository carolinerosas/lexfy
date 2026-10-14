// Chamadas à API de bots do Telegram (https://core.telegram.org/bots/api).

const BASE = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return t;
}

async function chamar<T>(metodo: string, corpo: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/bot${token()}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${metodo}: ${json.description ?? res.status}`);
  return json.result;
}

export interface BotaoInline {
  text: string;
  callback_data: string;
}

/** Telegram limita mensagens a 4096 caracteres; quebra em partes se precisar. */
export async function enviarMensagem(chatId: number, texto: string, botoes?: BotaoInline[][]): Promise<void> {
  const partes = texto.match(/[\s\S]{1,4000}/g) ?? [""];
  for (let i = 0; i < partes.length; i++) {
    const ultima = i === partes.length - 1;
    await chamar("sendMessage", {
      chat_id: chatId,
      text: partes[i],
      ...(ultima && botoes ? { reply_markup: { inline_keyboard: botoes } } : {}),
    });
  }
}

export async function editarMensagem(chatId: number, messageId: number, texto: string): Promise<void> {
  await chamar("editMessageText", { chat_id: chatId, message_id: messageId, text: texto });
}

export async function responderBotao(callbackId: string, texto?: string): Promise<void> {
  await chamar("answerCallbackQuery", { callback_query_id: callbackId, ...(texto ? { text: texto } : {}) });
}

export async function digitando(chatId: number): Promise<void> {
  await chamar("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

/** Baixa um arquivo (áudio/voz) enviado ao bot. */
export async function baixarArquivo(fileId: string): Promise<{ dados: ArrayBuffer; caminho: string }> {
  const info = await chamar<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`${BASE}/file/bot${token()}/${info.file_path}`);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo do Telegram (${res.status})`);
  return { dados: await res.arrayBuffer(), caminho: info.file_path };
}
