import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

export interface PJeMovimento {
  data: string;
  descricao: string;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseMovimentosHtml(html: string): PJeMovimento[] {
  const result: PJeMovimento[] = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trPattern.exec(html)) !== null) {
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let td: RegExpExecArray | null;
    while ((td = tdPattern.exec(tr[1])) !== null) cells.push(stripTags(td[1]));
    if (cells.length >= 2 && /^\d{2}\/\d{2}\/\d{4}/.test(cells[0]) && cells[1]) {
      result.push({ data: cells[0].trim(), descricao: cells[1].trim() });
    }
  }
  return result;
}

async function tryRestApi(baseUrl: string, numero: string): Promise<PJeMovimento[] | null> {
  const endpoints = [
    `/pje/api/v2/processos/publico?numero=${encodeURIComponent(numero)}`,
    `/pje/api/v1/processos?numero=${encodeURIComponent(numero)}`,
    `/pje/api/v2/consulta/processo/publico?numero=${encodeURIComponent(numero)}`,
    `/pje/api/v1/consulta/paginacao/processos?numero=${encodeURIComponent(numero)}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: { ...HEADERS, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      console.log("[PJe] REST", baseUrl + ep, "→", res.status);
      if (!res.ok) continue;
      const data = await res.json();
      const movimentos = data?.movimentos ?? data?.data?.movimentos ?? data?.hits?.hits?.[0]?._source?.movimentos;
      if (Array.isArray(movimentos) && movimentos.length > 0) {
        return movimentos.map((m: { dataHora?: string; nome?: string; descricao?: string }) => ({
          data: m.dataHora ? m.dataHora.split("T")[0].split("-").reverse().join("/") : "",
          descricao: m.nome ?? m.descricao ?? "",
        })).filter((m) => m.descricao);
      }
    } catch (e) {
      console.log("[PJe] REST erro:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

async function tryHtmlForm(baseUrl: string, numero: string): Promise<PJeMovimento[] | null> {
  // Step 1: get viewState
  const listUrl = `${baseUrl}/pje/ConsultaPublica/listView.seam`;
  let viewState = "";
  try {
    const r1 = await fetch(listUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!r1.ok) return null;
    const html1 = await r1.text();
    const vsMatch = html1.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
    if (!vsMatch) return null;
    viewState = vsMatch[1];
  } catch { return null; }

  // Step 2: POST with number
  try {
    const body = new URLSearchParams({
      "AJAXREQUEST": "_viewRoot",
      "fPP:numProcesso-inputNumeroProcessoDecoration:numProcesso-inputNumeroProcesso": numero,
      "fPP:j_id150": "Pesquisar",
      "javax.faces.ViewState": viewState,
    });
    const r2 = await fetch(listUrl, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!r2.ok) return null;
    const html2 = await r2.text();
    const movimentos = parseMovimentosHtml(html2);
    return movimentos.length > 0 ? movimentos : null;
  } catch { return null; }
}

// Some courts host PJe on their own domain instead of {sigla}.pje.jus.br
const CUSTOM_PJE_BASES: Record<string, string[]> = {
  tjrj: [
    "https://tjrj.pje.jus.br",
    "https://pje1g.tjrj.jus.br",
    "https://pje.tjrj.jus.br",
  ],
  tjsp: ["https://tjsp.pje.jus.br", "https://pje.tjsp.jus.br"],
  tjmg: ["https://pje.tjmg.jus.br", "https://tjmg.pje.jus.br"],
};

export async function POST(req: NextRequest) {
  const { sigla, numero } = await req.json();
  if (!sigla || !numero) {
    return NextResponse.json({ error: "sigla e numero obrigatorios" }, { status: 400 });
  }

  const bases = CUSTOM_PJE_BASES[sigla] ?? [`https://${sigla}.pje.jus.br`];

  for (const baseUrl of bases) {
    console.log("[PJe] tentando base:", baseUrl, "numero:", numero);
    let movimentos = await tryRestApi(baseUrl, numero);
    if (!movimentos) movimentos = await tryHtmlForm(baseUrl, numero);
    if (movimentos && movimentos.length > 0) {
      console.log("[PJe]", movimentos.length, "movimentos em", baseUrl);
      return NextResponse.json({ movimentos });
    }
  }

  return NextResponse.json(
    { error: `Processo não encontrado no PJe do ${sigla.toUpperCase()}. Pode estar em sistema diferente (DCP, e-SAJ).` },
    { status: 404 }
  );
}
