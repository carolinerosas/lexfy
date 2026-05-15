import { NextRequest, NextResponse } from "next/server";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

const API_HEADERS = {
  ...BROWSER_HEADERS,
  Accept: "application/json, text/plain, */*",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
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

// Session warming: visita a página principal pra obter cookies de sessão
async function obterCookiesTJRJ(): Promise<string> {
  try {
    const res = await fetch("https://www3.tjrj.jus.br/consultaprocessual/", {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const setCookies = res.headers.get("set-cookie") ?? "";
    // Extrai os pares cookie=value
    const cookies = setCookies
      .split(/,(?=\s*\w+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    return cookies;
  } catch {
    return "";
  }
}

async function fetchTJRJ(url: string, cookies = ""): Promise<{ status: number; body: string }> {
  const isApi = url.includes("/api/");
  const headers: Record<string, string> = { ...(isApi ? API_HEADERS : BROWSER_HEADERS) };
  if (cookies) headers["Cookie"] = cookies;
  if (isApi) headers["Referer"] = "https://www3.tjrj.jus.br/consultaprocessual/";

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  const body = await res.text();
  return { status: res.status, body };
}

export async function POST(req: NextRequest) {
  const { numero } = await req.json();
  if (!numero) {
    return NextResponse.json({ error: "numero obrigatorio" }, { status: 400 });
  }

  const encoded = encodeURIComponent(numero);
  const soDigitos = numero.replace(/\D/g, "");

  // 1. Faz session warming pra obter cookies (contorna parte do CAPTCHA)
  const cookies = await obterCookiesTJRJ();
  console.log("[TJRJ] cookies obtidos:", cookies ? "sim" : "não");

  const urls = [
    // API REST nova (precisa de cookies de sessão)
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${soDigitos}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${soDigitos}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/buscar?numeroProcesso=${encoded}`,
    // Portal antigo HTML (sem CAPTCHA, mas pode estar fora do ar)
    `http://www4.tjrj.jus.br/consultaProcessoWebV2/consultaMov.do?v=2&tipo=consulta&numProcesso=${encoded}`,
    `https://www4.tjrj.jus.br/consultaProcessoWebV2/consultaMov.do?v=2&tipo=consulta&numProcesso=${encoded}`,
    // Sistema SAJ
    `https://www3.tjrj.jus.br/scp/consulta.do?selOrigem=PB&numProcesso=${encoded}`,
  ];

  const todasMovs: TJRJMovimento[] = [];
  const seen = new Set<string>();
  const debug: { url: string; status: number; count: number; sample?: string }[] = [];

  for (const url of urls) {
    try {
      const { status, body } = await fetchTJRJ(url, cookies);
      let movs: TJRJMovimento[] = [];

      // Try JSON first
      try {
        const json = JSON.parse(body);
        // pode ser { movimentos: [...] }, { data: { movimentos: [...] } }, ou um array direto
        const arr = Array.isArray(json)
          ? json
          : (json.movimentos ?? json.movimentacoes ?? json.data?.movimentos ?? json.data?.movimentacoes ?? json.processo?.movimentos ?? []);
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
        // not JSON → tenta HTML
        movs = parseTJRJHtml(body);
      }

      debug.push({ url, status, count: movs.length, sample: movs[0]?.descricao?.slice(0, 60) });

      for (const m of movs) {
        const k = `${m.data}|${m.descricao}`;
        if (!seen.has(k)) {
          seen.add(k);
          todasMovs.push(m);
        }
      }
    } catch (err) {
      debug.push({ url, status: 0, count: 0, sample: err instanceof Error ? err.message : "erro" });
    }
  }

  console.log("[TJRJ] resumo:", JSON.stringify(debug, null, 2));

  if (todasMovs.length === 0) {
    return NextResponse.json(
      { error: "Processo não encontrado no portal TJERJ.", debug },
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
