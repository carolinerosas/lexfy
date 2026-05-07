import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

export interface EprocMovimento {
  data: string;
  descricao: string;
}

// EPROC base URLs by tribunal
const EPROC_BASES: Record<string, string> = {
  trf1: "https://processual.trf1.jus.br",
  trf2: "https://eproc.trf2.jus.br",
  trf4: "https://eproc2g.trf4.jus.br",
  trf5: "https://eproc.trf5.jus.br",
  trf6: "https://eproc.trf6.jus.br",
  // State courts using EPROC
  tjes: "https://eproc.tjes.jus.br",
};

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseEprocHtml(html: string): EprocMovimento[] {
  const result: EprocMovimento[] = [];

  // EPROC uses tables with class "infraTable" or similar; look for date patterns
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

async function fetchEproc(tribunal: string, numero: string): Promise<EprocMovimento[] | null> {
  const base = EPROC_BASES[tribunal];
  if (!base) return null;

  const urls =
    tribunal === "trf1"
      ? [`${base}/consultaProcessual/processo/${encodeURIComponent(numero)}`]
      : [
          `${base}/eproc/externo_controlador.php?acao=processo_seleciona_publica&num_processo=${encodeURIComponent(numero)}`,
          `${base}/eproc/externo_controlador.php?acao=consulta_processual_pesquisa&num_processo=${encodeURIComponent(numero)}`,
        ];

  for (const url of urls) {
    try {
      console.log("[EPROC] tentando:", url);
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000), redirect: "follow" });
      if (!res.ok) { console.log("[EPROC] HTTP", res.status); continue; }
      const html = await res.text();
      const movimentos = parseEprocHtml(html);
      if (movimentos.length > 0) {
        console.log("[EPROC]", movimentos.length, "movimentos de", url);
        return movimentos;
      }
    } catch (e) {
      console.log("[EPROC] erro:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { tribunal, numero } = await req.json();
  if (!tribunal || !numero) {
    return NextResponse.json({ error: "tribunal e numero obrigatorios" }, { status: 400 });
  }

  const movimentos = await fetchEproc(tribunal, numero);
  if (!movimentos || movimentos.length === 0) {
    return NextResponse.json(
      { error: `Processo não encontrado no EPROC do ${tribunal.toUpperCase()}.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ movimentos });
}
