import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

export interface TJRJMovimento {
  data: string;
  descricao: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseTJRJHtml(html: string): TJRJMovimento[] {
  const movimentos: TJRJMovimento[] = [];

  // Match all <tr> blocks
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trPattern.exec(html)) !== null) {
    const row = trMatch[1];
    // Extract all <td> cells in this row
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdPattern.exec(row)) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }

    if (cells.length >= 2) {
      const dateCell = cells[0].trim();
      const descCell = cells[1].trim();
      // Accept only cells that start with a Brazilian date dd/mm/yyyy
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateCell) && descCell) {
        movimentos.push({ data: dateCell, descricao: descCell });
      }
    }
  }

  return movimentos;
}

async function fetchTJRJ(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function POST(req: NextRequest) {
  const { numero } = await req.json();
  if (!numero) {
    return NextResponse.json({ error: "numero obrigatorio" }, { status: 400 });
  }

  const encoded = encodeURIComponent(numero);
  const urls = [
    `http://www4.tjrj.jus.br/consultaProcessoWebV2/consultaMov.do?v=2&tipo=consulta&numProcesso=${encoded}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}/movimentos`,
  ];

  for (const url of urls) {
    try {
      console.log("[TJRJ] tentando:", url);
      const html = await fetchTJRJ(url);

      // Try JSON first (REST API)
      try {
        const json = JSON.parse(html);
        if (Array.isArray(json)) {
          const movimentos = json.map((m: { dataHora?: string; descricao?: string; nome?: string }) => ({
            data: m.dataHora ? m.dataHora.split("T")[0] : "",
            descricao: m.descricao ?? m.nome ?? "",
          })).filter((m) => m.descricao);
          if (movimentos.length > 0) {
            console.log("[TJRJ] JSON encontrado:", movimentos.length, "movimentos");
            return NextResponse.json({ movimentos });
          }
        }
      } catch {
        // not JSON, parse as HTML
      }

      const movimentos = parseTJRJHtml(html);
      console.log("[TJRJ] HTML parseado:", movimentos.length, "movimentos de", url);

      if (movimentos.length > 0) {
        return NextResponse.json({ movimentos });
      }
    } catch (err) {
      console.log("[TJRJ] falhou:", url, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json(
    { error: "Processo não encontrado no portal TJERJ. Verifique se o número está correto." },
    { status: 404 }
  );
}
