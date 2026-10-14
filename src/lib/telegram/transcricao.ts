// Transcrição de áudio em português pelo Deepgram (modelo Nova-3).

export class TranscricaoIndisponivel extends Error {}

export async function transcreverAudio(dados: ArrayBuffer, mimeType: string): Promise<string> {
  const chave = process.env.DEEPGRAM_API_KEY;
  if (!chave) throw new TranscricaoIndisponivel("DEEPGRAM_API_KEY não configurada");

  const url = "https://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&smart_format=true&punctuate=true";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${chave}`, "Content-Type": mimeType },
    body: dados,
  });
  if (!res.ok) throw new Error(`Deepgram respondeu ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}
