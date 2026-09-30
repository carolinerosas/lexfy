import { NextRequest, NextResponse } from "next/server";
import { createTriagemImportacao, registrarCoworkImportacao } from "@/lib/store";
import { buscarCep } from "@/lib/format";
import {
  CNJ_RE, INFO_SEM_CNJ, aplicarCep, cleanLine, extractLabeled, extrairEntidades, sanearCliente,
} from "@/lib/triagem-extracao";
import type { TriagemImportDraft } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

type ImportDraft = TriagemImportDraft;

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
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

function labeled(texto: string, labels: string[]): string | undefined {
  return extractLabeled(texto, labels) || undefined;
}

function fallbackImport(texto: string): ImportDraft {
  const numeros = uniq(texto.match(CNJ_RE) ?? []);
  // Extração escopada por entidade: dados do cliente só saem do bloco do cliente.
  const entidades = extrairEntidades(texto);
  const cliente = entidades.cliente;
  const comarca = labeled(texto, ["comarca", "foro"]);
  const vara = labeled(texto, ["vara", "cartório", "cartorio", "juízo", "juizo"]);
  const unidadePrisional = labeled(texto, ["unidade prisional", "presidio", "presídio", "cadeia", "penitenciaria", "penitenciária"]);
  const tipo = inferTipo(texto);

  return {
    cliente,
    processos: numeros.map((numero) => ({
      numero,
      titulo: tipo === "familia" ? "Processo de família" : tipo === "juri" ? "Processo do júri" : tipo === "criminal" ? "Processo criminal" : "Processo importado",
      descricao: texto.slice(0, 4000),
      ...inferTribunal(numero),
      comarca,
      vara,
      tipo,
      parte_contraria: entidades.parte_contraria,
      cliente_nome: cliente.nome,
      cliente_cpf_cnpj: cliente.cpf,
      unidade_prisional: unidadePrisional,
    })),
    movimentacoes: [],
    avisos: [],
    info: numeros.length === 0 ? [INFO_SEM_CNJ] : [],
  };
}

function normalizeDraft(value: Partial<ImportDraft> & { parte_contraria?: { nome?: string } }, texto: string): ImportDraft {
  const fallback = fallbackImport(texto);
  const entidades = extrairEntidades(texto);
  const processos = Array.isArray(value.processos) ? value.processos : fallback.processos;
  // A IA manda; a leitura básica (já escopada no bloco do cliente) só completa lacunas.
  // Depois, tudo passa pelo saneamento: dado que só existe no bloco de outra entidade é descartado.
  const ia = Object.fromEntries(
    Object.entries(value.cliente ?? {}).filter(([, v]) => typeof v === "string" && v.trim())
  ) as NonNullable<ImportDraft["cliente"]>;
  const { cliente, avisos: avisosSaneamento } = sanearCliente({ ...fallback.cliente, ...ia }, entidades);
  const observacoesDoCaso = cleanLine(cliente.observacoes);
  delete cliente.observacoes;
  const parteContraria = cleanLine(value.parte_contraria?.nome) || entidades.parte_contraria;
  const processosComNumero = processos.filter((p) => p?.numero);

  return {
    cliente,
    processos: processosComNumero.map((p) => ({
      ...p,
      numero: p.numero.trim(),
      titulo: cleanLine(p.titulo) || "Processo importado",
      descricao: cleanLine(p.descricao) || observacoesDoCaso || fallback.processos.find((fp) => fp.numero === p.numero)?.descricao || "Importado pela triagem assistida.",
      tipo: cleanLine(p.tipo) || inferTipo(texto),
      parte_contraria: cleanLine(p.parte_contraria) || parteContraria,
    })),
    movimentacoes: Array.isArray(value.movimentacoes) ? value.movimentacoes.filter((m) => m?.descricao) : [],
    avisos: [...avisosSaneamento, ...(Array.isArray(value.avisos) ? value.avisos : [])],
    info: processosComNumero.length === 0 ? [INFO_SEM_CNJ] : [],
  };
}

/** O CEP é a fonte de rua/bairro/cidade/UF; do texto ficam só número e complemento. */
async function enriquecerComCep(draft: ImportDraft): Promise<ImportDraft> {
  const cep = draft.cliente?.cep;
  if (!draft.cliente || !cep || cep.replace(/\D/g, "").length !== 8) return draft;
  const end = await Promise.race([
    buscarCep(cep),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  if (!end) return draft;
  const { cliente, avisos } = aplicarCep(draft.cliente, end);
  return { ...draft, cliente, avisos: [...(draft.avisos ?? []), ...avisos] };
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
      const draft = await enriquecerComCep(fallbackImport(input));
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
  "parte_contraria": { "nome": "", "cpf_cnpj": "", "email": "", "telefone": "" },
  "terceiros": [{ "nome": "", "papel": "", "cpf": "", "rg": "" }],
  "processos": [{
    "numero": "CNJ",
    "titulo": "",
    "descricao": "resumo e observações do caso, nunca observações do cliente",
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
Regras de entidade (obrigatórias):
- Cada pessoa ou empresa do texto é uma entidade separada. Os campos de "cliente" só podem vir do trecho que descreve o cliente. E-mail, telefone, documento ou endereço da parte contrária, de concessionária/empresa ou de terceiros NUNCA vão para "cliente".
- Se o texto disser que um dado do cliente "não foi informado", "não consta" ou equivalente, deixe o campo vazio.
- "rg" é só documento de identidade de pessoa física. Inscrição estadual, CNPJ, CNH ou qualquer outro número não são RG.
- Decomponha o endereço: "logradouro" só com o nome da rua, "numero_end" só com o número, bairro, cidade e UF em seus campos. Ignore comentários entre parênteses.
- "processos" só recebe processos com número CNJ. Caso ainda não ajuizado ou texto sem CNJ: "processos": [].
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
      const draft = await enriquecerComCep(fallbackImport(input));
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

    const draft = await enriquecerComCep(normalizeDraft(parsed ?? {}, input));

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
