import { NextRequest, NextResponse } from "next/server";
import { createTriagemImportacao, registrarCoworkImportacao } from "@/lib/store";
import type { TriagemImportDraft } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

type ImportDraft = TriagemImportDraft;

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function cleanLine(value?: string): string | undefined {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function onlyDigits(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits || undefined;
}

function normalizeCep(value?: string): string | undefined {
  const digits = onlyDigits(value);
  if (!digits || digits.length !== 8) return cleanLine(value);
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeUf(value?: string): string | undefined {
  const raw = cleanLine(value);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const sigla = upper.match(/^[A-Z]{2}$/)?.[0];
  if (sigla) return sigla;

  const ascii = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const estados: Record<string, string> = {
    "RIO DE JANEIRO": "RJ",
    "SAO PAULO": "SP",
    "MINAS GERAIS": "MG",
    "ESPIRITO SANTO": "ES",
  };
  return Object.entries(estados).find(([nome]) => ascii.includes(nome))?.[1];
}

function inferTribunal(numero: string): { tribunal?: string; uf?: string } {
  if (numero.includes(".8.19.")) return { tribunal: "TJRJ", uf: "RJ" };
  if (numero.includes(".8.26.")) return { tribunal: "TJSP", uf: "SP" };
  if (numero.includes(".4.02.")) return { tribunal: "TRF2", uf: "RJ" };
  if (numero.includes(".5.01.")) return { tribunal: "TRT1", uf: "RJ" };
  return {};
}

function inferTipo(texto: string): string {
  const t = texto.toLowerCase();
  if (/(fam[ií]lia|guarda|alimentos|div[oó]rcio|interdi[cç][aã]o|curatela)/.test(t)) return "familia";
  if (/(execu[cç][aã]o penal|seeu|pena|livramento|regime aberto|regime semiaberto)/.test(t)) return "execucao_penal";
  if (/(j[uú]ri|tribunal do j[uú]ri)/.test(t)) return "juri";
  if (/(inqu[eé]rito|flagrante|den[uú]ncia|audi[eê]ncia de cust[oó]dia|criminal)/.test(t)) return "criminal";
  if (/(trabalhista|reclama[cç][aã]o trabalhista|verbas rescis[oó]rias)/.test(t)) return "trabalhista";
  return "civel";
}

function extractLabeled(texto: string, labels: string[]): string | undefined {
  const joined = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${joined})\\s*[:\\-]\\s*([^\\n]+)`, "i");
  return cleanLine(texto.match(re)?.[1]);
}

function fallbackImport(texto: string): ImportDraft {
  const numeros = uniq(texto.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g) ?? []);
  const email = cleanLine(texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
  const celular = cleanLine(texto.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/)?.[0]);
  const cpf = onlyDigits(texto.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)?.[0]);
  const rg = cleanLine(extractLabeled(texto, ["rg", "identidade", "documento de identidade"]) || texto.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b/)?.[0]);
  const cep = normalizeCep(extractLabeled(texto, ["cep"]) || texto.match(/\b\d{5}-?\d{3}\b/)?.[0]);
  const logradouro = extractLabeled(texto, ["endereço", "endereÃ§o", "endereco", "logradouro", "rua", "avenida", "av"]);
  const numeroEnd = extractLabeled(texto, ["número", "nÃºmero", "numero", "nº", "nÂº", "n"]);
  const complemento = extractLabeled(texto, ["complemento"]);
  const bairro = extractLabeled(texto, ["bairro"]);
  const cidade = extractLabeled(texto, ["cidade", "município", "municÃ­pio", "municipio"]);
  const uf = normalizeUf(extractLabeled(texto, ["uf", "estado"]));
  const nome = extractLabeled(texto, ["cliente", "nome", "requerente", "autor", "autora", "parte ativa"]);
  const parteContraria = extractLabeled(texto, ["parte contrária", "parte contraria", "réu", "reu", "ré", "re", "polo passivo"]);
  const comarca = extractLabeled(texto, ["comarca", "foro"]);
  const vara = extractLabeled(texto, ["vara", "cartório", "cartorio", "juízo", "juizo"]);
  const unidadePrisional = extractLabeled(texto, ["unidade prisional", "presidio", "presídio", "cadeia", "penitenciaria", "penitenciária"]);
  const tipo = inferTipo(texto);

  return {
    cliente: {
      nome,
      cpf,
      rg,
      email,
      celular,
      cep,
      logradouro,
      numero_end: numeroEnd,
      complemento,
      bairro,
      cidade,
      uf,
    },
    processos: numeros.map((numero) => ({
      numero,
      titulo: tipo === "familia" ? "Processo de família" : tipo === "juri" ? "Processo do júri" : tipo === "criminal" ? "Processo criminal" : "Processo importado",
      descricao: texto.slice(0, 4000),
      ...inferTribunal(numero),
      comarca,
      vara,
      tipo,
      parte_contraria: parteContraria,
      cliente_nome: nome,
      cliente_cpf_cnpj: cpf,
      unidade_prisional: unidadePrisional,
    })),
    movimentacoes: [],
    avisos: numeros.length === 0 ? ["Não encontrei número CNJ no texto. Confira os dados antes de salvar."] : [],
  };
}

function normalizeDraft(value: Partial<ImportDraft>, texto: string): ImportDraft {
  const fallback = fallbackImport(texto);
  const processos = Array.isArray(value.processos) ? value.processos : fallback.processos;
  const cliente = {
    ...fallback.cliente,
    ...(value.cliente ?? {}),
  };
  const observacoesDoCaso = cleanLine(cliente.observacoes);
  delete cliente.observacoes;

  return {
    cliente,
    processos: processos
      .filter((p) => p?.numero)
      .map((p) => ({
        ...p,
        numero: p.numero.trim(),
        titulo: cleanLine(p.titulo) || "Processo importado",
        descricao: cleanLine(p.descricao) || observacoesDoCaso || fallback.processos.find((fp) => fp.numero === p.numero)?.descricao || "Importado pela triagem assistida.",
        tipo: cleanLine(p.tipo) || inferTipo(texto),
      })),
    movimentacoes: Array.isArray(value.movimentacoes) ? value.movimentacoes.filter((m) => m?.descricao) : [],
    avisos: [...(fallback.avisos ?? []), ...(Array.isArray(value.avisos) ? value.avisos : [])],
  };
}

function extractJson(text: string): Partial<ImportDraft> | undefined {
  const raw = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return JSON.parse(raw.slice(start, end + 1)) as Partial<ImportDraft>;
}

function getAgentToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-justio-agent-token")?.trim() ?? "";
}

function assertAgentAuthorized(req: NextRequest): NextResponse | null {
  const expected = process.env.JUSTIO_AGENT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "JUSTIO_AGENT_TOKEN não configurado no servidor." },
      { status: 503 }
    );
  }

  if (getAgentToken(req) !== expected) {
    return NextResponse.json({ error: "Token do agente inválido." }, { status: 401 });
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { texto, persistir, origem, cowork } = (await req.json()) as {
      texto?: string;
      persistir?: boolean;
      origem?: string;
      cowork?: { conversa_id?: string; projeto?: string; marcador?: string };
    };
    const input = texto?.trim();

    async function registrarDedup(importacaoId: string): Promise<void> {
      if (cowork?.conversa_id && cowork?.marcador) {
        await registrarCoworkImportacao({
          conversa_id: cowork.conversa_id,
          projeto: cowork.projeto,
          marcador: cowork.marcador,
          importacao_id: importacaoId,
        });
      }
    }

    if (!input) {
      return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
    }

    if (persistir) {
      const unauthorized = assertAgentAuthorized(req);
      if (unauthorized) return unauthorized;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const draft = fallbackImport(input);
      if (persistir) {
        const importacao = await createTriagemImportacao({
          texto_original: input,
          draft,
          origem: origem || "agente",
        });
        await registrarDedup(importacao.id);
        return NextResponse.json({ draft, source: "fallback", importacao });
      }
      return NextResponse.json({ draft, source: "fallback" });
    }

    const system = `Você extrai dados jurídicos para cadastro no Justio.
Responda SOMENTE JSON válido, sem markdown, neste formato:
{
  "cliente": {
    "nome": "",
    "cpf": "",
    "rg": "",
    "email": "",
    "celular": "",
    "cep": "",
    "logradouro": "",
    "numero_end": "",
    "complemento": "",
    "bairro": "",
    "cidade": "",
    "uf": ""
  },
  "processos": [{
    "numero": "CNJ",
    "titulo": "",
    "descricao": "resumo e observaÃ§Ãµes do caso, nunca observaÃ§Ãµes do cliente",
    "tribunal": "",
    "uf": "",
    "comarca": "",
    "vara": "",
    "tipo": "civel|familia|criminal|juri|execucao_penal|inquerito_policial|bo_pm|trabalhista|outro",
    "parte_contraria": "",
    "cliente_nome": "",
    "cliente_cpf_cnpj": "",
    "unidade_prisional": "",
    "tipo_penal": "crime imputado, só para processos criminais/júri/execução penal (ex.: Tráfico de drogas (art. 33, Lei 11.343/06))",
    "data_distribuicao": "YYYY-MM-DD"
  }],
  "movimentacoes": [{ "processo_numero": "", "data_movimentacao": "YYYY-MM-DD", "descricao": "", "tipo": "", "fonte": "" }],
  "avisos": []
}
Sempre que o texto descrever um andamento, movimentação, decisão, despacho, intimação ou evento de um processo, gere uma entrada correspondente em "movimentacoes", com "processo_numero" igual ao número do processo — MESMO que esse processo também apareça em "processos" como novo cadastro. A "descricao" da movimentação deve conter o andamento em si.
Não invente dados. Se faltar algo, omita ou deixe vazio.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        temperature: 0,
        system,
        messages: [{ role: "user", content: input }],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const draft = fallbackImport(input);
      if (persistir) {
        const importacao = await createTriagemImportacao({
          texto_original: input,
          draft,
          origem: origem || "agente",
        });
        await registrarDedup(importacao.id);
        return NextResponse.json({ draft, source: "fallback", error: `IA HTTP ${res.status}`, importacao });
      }
      return NextResponse.json({ draft, source: "fallback", error: `IA HTTP ${res.status}` });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n") ?? "";
    const parsed = extractJson(text);

    const draft = normalizeDraft(parsed ?? {}, input);

    if (persistir) {
      const importacao = await createTriagemImportacao({
        texto_original: input,
        draft,
        origem: origem || "agente",
      });
      return NextResponse.json({ draft, source: parsed ? "ai" : "fallback", importacao });
    }

    return NextResponse.json({ draft, source: parsed ? "ai" : "fallback" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao importar dados." },
      { status: 500 }
    );
  }
}
