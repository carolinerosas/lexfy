import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { envLimpo } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// OCR das páginas escaneadas dos autos (sem texto no PDF): o navegador manda a imagem da
// página e o Claude devolve o texto transcrito. Rota protegida pelo login (middleware).

const MODEL = process.env.OCR_MODEL || "claude-haiku-5-5";

export async function POST(req: NextRequest) {
  const { imagem } = (await req.json().catch(() => ({}))) as { imagem?: string };
  const dados = imagem?.replace(/^data:image\/jpeg;base64,/, "");
  if (!dados || dados.length > 6_000_000) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });

  const client = new Anthropic({ apiKey: envLimpo("ANTHROPIC_API_KEY") });
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dados } },
            {
              type: "text",
              text: "Esta é uma página escaneada de um processo judicial brasileiro. Transcreva TODO o texto da página, na ordem de leitura, mantendo nomes, números, datas e números de folhas exatamente como aparecem. Não resuma, não comente, não traduza. Trechos ilegíveis: [ilegível]. Página sem texto (em branco ou só imagem): responda apenas [sem texto].",
            },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ texto: texto === "[sem texto]" ? "" : texto });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
