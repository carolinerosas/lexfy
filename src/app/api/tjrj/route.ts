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
  const soDigitos = numero.replace(/\D/g, "");
  const urls = [
    `http://www4.tjrj.jus.br/consultaProcessoWebV2/consultaMov.do?v=2&tipo=consulta&numProcesso=${encoded}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${soDigitos}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}`,
  ];

  const todasMovs: TJRJMovimento[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    try {
      console.log("[TJRJ] tentando:", url);
      const html = await fetchTJRJ(url);
      let movs: TJRJMovimento[] = [];

      // Try JSON first (REST API)
      try {
        const json = JSON.parse(html);
        const arr = Array.isArray(json) ? json : (json.movimentos ?? json.data?.movimentos ?? []);
        if (Array.isArray(arr) && arr.length > 0) {
          movs = arr.map((m: { dataHora?: string; data?: string; descricao?: string; nome?: string; texto?: string; complementosTabelados?: { descricao?: string }[] }) => {
            const dataRaw = m.dataHora ?? m.data ?? "";
            const data = /^\d{4}-\d{2}-\d{2}/.test(dataRaw)
              ? dataRaw.slice(0, 10).split("-").reverse().join("/")
              : dataRaw;
            const compl = m.complementosTabelados?.map((c) => c.descricao).filter(Boolean).join(" — ") ?? "";
            const desc = [m.descricao ?? m.nome ?? m.texto, compl].filter(Boolean).join(" — ");
            return { data, descricao: desc };
          }).filter((m) => m.descricao);
        }
      } catch {
        // not JSON, parse as HTML
        movs = parseTJRJHtml(html);
      }

      console.log("[TJRJ]", movs.length, "movs de", url);
      for (const m of movs) {
        const k = `${m.data}|${m.descricao}`;
        if (!seen.has(k)) {
          seen.add(k);
          todasMovs.push(m);
        }
      }
    } catch (err) {
      console.log("[TJRJ] falhou:", url, err instanceof Error ? err.message : err);
    }
  }

  if (todasMovs.length === 0) {
    return NextResponse.json(
      { error: "Processo não encontrado no portal TJERJ. Verifique se o número está correto." },
      { status: 404 }
    );
  }

  // Ordena: mais recentes primeiro
  todasMovs.sort((a, b) => {
    const da = a.data.split("/").reverse().join("");
    const db = b.data.split("/").reverse().join("");
    return db.localeCompare(da);
  });

  return NextResponse.json({ movimentos: todasMovs });
}
