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

interface TJRJProcessoMeta {
  idProcesso: number;
  codigoProcesso?: string;
  codigoCnj?: string;
  tipoProcesso?: number;
  classe?: string;
  urlProcessoExterno?: string;
  ehPje?: boolean;
}

function parseMovsJson(arr: unknown[]): TJRJMovimento[] {
  return arr.map((raw) => {
    const m = raw as { dataHora?: string; data?: string; dataMovimentacao?: string; descricao?: string; descricaoMovimento?: string; nome?: string; texto?: string; complementosTabelados?: { descricao?: string }[] };
    const dataRaw = m.dataHora ?? m.data ?? m.dataMovimentacao ?? "";
    const data = /^\d{4}-\d{2}-\d{2}/.test(dataRaw)
      ? dataRaw.slice(0, 10).split("-").reverse().join("/")
      : dataRaw;
    const compl = m.complementosTabelados?.map((c) => c.descricao).filter(Boolean).join(" — ") ?? "";
    const desc = [m.descricao ?? m.descricaoMovimento ?? m.nome ?? m.texto, compl].filter(Boolean).join(" — ");
    return { data, descricao: desc };
  }).filter((m) => m.descricao);
}

export async function POST(req: NextRequest) {
  const { numero } = await req.json();
  if (!numero) {
    return NextResponse.json({ error: "numero obrigatorio" }, { status: 400 });
  }

  const encoded = encodeURIComponent(numero);
  const cookies = await obterCookiesTJRJ();
  const debug: { url: string; status: number; count: number; sample?: string }[] = [];

  // PASSO 1: descobrir o idProcesso a partir do CNJ
  let meta: TJRJProcessoMeta | null = null;
  try {
    const { status, body } = await fetchTJRJ(
      `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}`,
      cookies
    );
    debug.push({ url: "passo1: buscar idProcesso", status, count: 0, sample: body.slice(0, 200) });
    if (status === 200) {
      const arr = JSON.parse(body);
      if (Array.isArray(arr) && arr.length > 0) {
        meta = arr[0] as TJRJProcessoMeta;
      }
    }
  } catch (err) {
    debug.push({ url: "passo1: buscar idProcesso", status: 0, count: 0, sample: err instanceof Error ? err.message : "erro" });
  }

  if (!meta?.idProcesso) {
    return NextResponse.json(
      { error: "Processo não encontrado na consulta pública do TJERJ.", debug },
      { status: 404 }
    );
  }

  // Detecta se é PJe (não tem movimentos públicos)
  const ehPje = meta.classe?.toLowerCase().includes("pje") || meta.urlProcessoExterno?.includes("pje.jus.br") || meta.tipoProcesso === 13;
  if (ehPje) {
    return NextResponse.json(
      {
        error: "Este processo está no PJe-RJ — a consulta pública do TJRJ não disponibiliza movimentações. É necessário acessar o PJe com login (certificado digital ou senha OAB).",
        debug,
        ehPje: true,
        urlExterna: meta.urlProcessoExterno,
      },
      { status: 404 }
    );
  }

  // PASSO 2: buscar movimentações com idProcesso
  const idStr = String(meta.idProcesso);
  const movUrls = [
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${idStr}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${idStr}/movimentacoes`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${idStr}/andamentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${idStr}/listar-movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/dados-processo/${idStr}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${idStr}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/movimentos?idProcesso=${idStr}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/movimentacoes?idProcesso=${idStr}`,
  ];

  const todasMovs: TJRJMovimento[] = [];
  const seen = new Set<string>();

  for (const url of movUrls) {
    try {
      const { status, body } = await fetchTJRJ(url, cookies);
      let movs: TJRJMovimento[] = [];

      if (status === 200) {
        try {
          const json = JSON.parse(body);
          const arr = Array.isArray(json)
            ? json
            : (json.movimentos ?? json.movimentacoes ?? json.andamentos ?? json.data?.movimentos ?? json.data?.movimentacoes ?? json.processo?.movimentos ?? []);
          if (Array.isArray(arr) && arr.length > 0) {
            movs = parseMovsJson(arr);
          }
        } catch {
          movs = parseTJRJHtml(body);
        }
      }

      const sampleBody = (status === 200 && movs.length === 0) ? body.slice(0, 300) : (movs[0]?.descricao?.slice(0, 80) ?? "");
      debug.push({ url, status, count: movs.length, sample: sampleBody });

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

  if (todasMovs.length === 0) {
    return NextResponse.json(
      { error: `Processo encontrado (id ${idStr}) mas nenhum endpoint de movimentos respondeu.`, debug, idProcesso: idStr },
      { status: 404 }
    );
  }

  todasMovs.sort((a, b) => {
    const da = a.data.split("/").reverse().join("");
    const db = b.data.split("/").reverse().join("");
    return db.localeCompare(da);
  });

  return NextResponse.json({ movimentos: todasMovs });
}
