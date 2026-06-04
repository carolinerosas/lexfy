import { NextRequest, NextResponse } from "next/server";
import { createTriagemLead } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const ESCRITORIO = "Caroline Rosas Advocacia";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

const SYSTEM_PROMPT = `Você é o assistente virtual de triagem do escritório ${ESCRITORIO}. Atende um possível novo cliente que acabou de entrar em contato. Seu objetivo é COLETAR e ORGANIZAR as informações do caso para a advogada analisar depois — você NÃO é advogado(a).

Regras (siga à risca):
- NUNCA dê orientação ou parecer jurídico, não diga se a pessoa "tem direito", não cite leis como conselho, não prometa resultados.
- NÃO fale sobre honorários, valores ou prazos legais.
- Seja cordial, claro e objetivo. Faça UMA pergunta por vez. Mensagens curtas, estilo WhatsApp.
- Na PRIMEIRA mensagem: apresente-se, explique que vai coletar alguns dados para a Dra. Caroline analisar e peça permissão para continuar (consentimento LGPD).
- Colete ao longo da conversa: nome completo; melhor contato (telefone/WhatsApp ou e-mail); qual o assunto/área do problema; um resumo do que aconteceu; há quanto tempo; se já existe processo ou audiência marcada; cidade; e o nível de urgência.
- Quando tiver o ESSENCIAL (pelo menos nome, contato, área e um resumo do caso), chame a ferramenta "salvar_ficha" com os dados coletados e finalize agradecendo, dizendo que a Dra. Caroline vai analisar e retornar em breve.
- Se a pessoa pedir conselho ou fugir do tema, redirecione com gentileza: você só faz a triagem inicial.
- Responda sempre em português do Brasil.`;

const TOOL = {
  name: "salvar_ficha",
  description: "Registra a ficha de triagem quando houver informações suficientes para o advogado analisar o caso.",
  input_schema: {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome completo do possível cliente" },
      contato: { type: "string", description: "Melhor contato: telefone/WhatsApp ou e-mail" },
      area: { type: "string", description: "Área do direito / assunto (ex: Trabalhista, Família, Criminal, Cível)" },
      resumo: { type: "string", description: "Resumo objetivo do caso, no que foi relatado" },
      urgencia: { type: "string", enum: ["alta", "media", "baixa"], description: "Nível de urgência percebido" },
      detalhes: { type: "string", description: "Outros pontos relevantes: há quanto tempo, processo/audiência existente, documentos, cidade" },
    },
    required: ["area", "resumo"],
  },
};

type Msg = { role: "user" | "assistant"; content: string };

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function montarTranscricao(messages: Msg[], fechamento: string): string {
  const linhas = messages.map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${m.content}`);
  if (fechamento) linhas.push(`Assistente: ${fechamento}`);
  return linhas.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { messages, telefone, canal } = (await req.json()) as {
      messages?: Msg[];
      telefone?: string;
      canal?: string;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "O atendimento automático ainda não foi ativado (falta configurar a chave da IA). Por favor, deixe seu nome e telefone que retornaremos.",
        done: false,
        erroConfig: true,
      });
    }

    const histico = Array.isArray(messages) ? messages : [];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        messages: histico,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[triagem] Anthropic erro:", res.status, txt.slice(0, 300));
      return NextResponse.json({
        reply: "Tive um problema técnico agora. Pode tentar novamente em instantes?",
        done: false,
        erro: `HTTP ${res.status}`,
      });
    }

    const data = (await res.json()) as { content?: ContentBlock[]; stop_reason?: string };
    const blocks = data.content ?? [];
    const texto = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === "salvar_ficha");

    if (toolUse?.input) {
      const f = toolUse.input as Record<string, string>;
      const fechamento = texto || "Perfeito! Anotei tudo aqui. A Dra. Caroline vai analisar seu caso e retornar em breve. 🙏";
      try {
        await createTriagemLead({
          nome: f.nome || undefined,
          contato: f.contato || telefone || undefined,
          telefone: telefone || undefined,
          area: f.area || undefined,
          resumo: f.resumo || undefined,
          urgencia: f.urgencia || undefined,
          detalhes: f.detalhes || undefined,
          canal: canal || "link",
          transcricao: montarTranscricao(histico, fechamento),
        });
      } catch (err) {
        console.error("[triagem] erro ao salvar lead:", err);
      }
      return NextResponse.json({ reply: fechamento, done: true });
    }

    return NextResponse.json({
      reply: texto || "Pode me contar um pouco mais?",
      done: false,
    });
  } catch (err) {
    console.error("[triagem] erro:", err);
    return NextResponse.json(
      { reply: "Tive um problema técnico. Tente novamente em instantes.", done: false, erro: err instanceof Error ? err.message : "erro" },
      { status: 200 }
    );
  }
}
