import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const BASE = "https://tjrj.pje.jus.br";
const SEARCH_URL = `${BASE}/pje/ConsultaPublica/listView.seam`;

interface Movimento {
  data: string;
  descricao: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractCookies(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "";
  return setCookieHeader
    .split(/,(?=\s*\w+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function extractViewState(html: string): string | null {
  const m = html.match(/name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/id=["']javax\.faces\.ViewState[^"']*["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/value=["']([^"']+)["'][^>]*name=["']javax\.faces\.ViewState["']/i);
  return m ? m[1] : null;
}

// Extrai todos pares input name/value/id pra descobrir os IDs reais do form
function extractInputs(html: string): { name: string; id?: string }[] {
  const result: { name: string; id?: string }[] = [];
  const inputPattern = /<input[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputPattern.exec(html)) !== null) {
    const tag = m[0];
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    const id = tag.match(/id=["']([^"']+)["']/i)?.[1];
    if (name) result.push({ name, id });
  }
  return result;
}

function findFormField(inputs: { name: string }[], keywords: string[]): string | null {
  for (const inp of inputs) {
    const lower = inp.name.toLowerCase();
    if (keywords.every((k) => lower.includes(k.toLowerCase()))) {
      return inp.name;
    }
  }
  return null;
}

function findDetalheUrl(html: string): string | null {
  // Procura link p/ DetalheProcessoConsultaPublica
  const m = html.match(/href=["']([^"']*DetalheProcessoConsultaPublica[^"']+)["']/i);
  if (m) {
    const href = m[1].replace(/&amp;/g, "&");
    return href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/pje/"}${href}`;
  }
  // Procura window.open ou JS de redirect
  const js = html.match(/window\.open\(['"]([^'"]*DetalheProcesso[^'"]+)/i);
  if (js) {
    const href = js[1].replace(/&amp;/g, "&");
    return href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/pje/"}${href}`;
  }
  return null;
}

function parseMovimentos(html: string): Movimento[] {
  const movs: Movimento[] = [];
  // PJe geralmente tem uma tabela com classes "rich-table" ou similar
  // Cada movimento vem em <tr> com 2 ou 3 células: data, descrição, [tipo]
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const row = trMatch[1];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdPattern.exec(row)) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }
    if (cells.length >= 2) {
      const dateCell = cells[0].trim();
      const descCell = cells.slice(1).join(" ").trim();
      // Aceita dd/mm/yyyy ou dd/mm/yyyy hh:mm:ss
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateCell) && descCell) {
        movs.push({ data: dateCell.slice(0, 10), descricao: descCell });
      }
    }
  }
  return movs;
}

export async function POST(req: NextRequest) {
  const { numero } = await req.json();
  if (!numero) {
    return NextResponse.json({ error: "numero obrigatorio" }, { status: 400 });
  }

  const debug: Record<string, unknown>[] = [];

  try {
    // PASSO 1: GET da página de consulta pública pra obter ViewState e cookies
    const r1 = await fetch(SEARCH_URL, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    const cookies = extractCookies(r1.headers.get("set-cookie"));
    const html1 = await r1.text();
    const viewState = extractViewState(html1);
    const inputs = extractInputs(html1);
    debug.push({ step: "GET listView", status: r1.status, viewState: viewState?.slice(0, 30), cookies: cookies ? "sim" : "não", inputs: inputs.length });

    if (!viewState) {
      return NextResponse.json({ error: "Não foi possível obter ViewState do PJe-RJ", debug }, { status: 500 });
    }

    // Descobre os nomes dos campos do form dinamicamente
    const formId = inputs.find((i) => i.name.includes(":numProcesso") || i.name.endsWith("Pesquisar"))?.name.split(":")[0]
      ?? "fPP";

    const fieldNumero = findFormField(inputs, [":numProcesso-inputNumeroProcessoDecoration"])
      ?? findFormField(inputs, [":numeroProcesso"])
      ?? findFormField(inputs, ["numProcesso-inputNumeroProcesso"])
      ?? `${formId}:numProcesso-inputNumeroProcessoDecoration:numProcesso-inputNumeroProcesso`;

    const btnPesquisar = inputs.find((i) => i.name.toLowerCase().includes("pesquisar") || (i.id?.toLowerCase().includes("pesquisar")))?.name
      ?? `${formId}:searchProcessos`;

    debug.push({ step: "campos detectados", formId, fieldNumero, btnPesquisar });

    // PASSO 2: POST com o número do processo - submissão de form normal (sem AJAX)
    // O PJe usa JSF; precisa fazer POST não-AJAX pra receber página completa em vez de fragmento
    const body = new URLSearchParams();
    body.set(formId, formId);
    body.set(fieldNumero, numero);
    body.set(btnPesquisar, "Pesquisar");
    body.set("javax.faces.ViewState", viewState);

    const r2 = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: SEARCH_URL,
        Origin: BASE,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(25000),
      redirect: "follow",
    });
    const html2 = await r2.text();
    debug.push({
      step: "POST busca",
      status: r2.status,
      len: html2.length,
      hasDetalhe: html2.includes("DetalheProcesso"),
      hasMovimento: /Movimento|movimenta/i.test(html2),
      finalUrl: r2.url,
    });

    // Atualiza cookies com qualquer set-cookie da resposta
    const newCookies = extractCookies(r2.headers.get("set-cookie"));
    const allCookies = [cookies, newCookies].filter(Boolean).join("; ");

    // PASSO 3: tenta extrair movimentos direto, OU achar link p/ detalhe
    let movs = parseMovimentos(html2);
    debug.push({ step: "parse direto", count: movs.length });

    if (movs.length === 0) {
      const detalheUrl = findDetalheUrl(html2);
      debug.push({ step: "achou link detalhe", url: detalheUrl, sample: html2.slice(0, 300) });
      if (detalheUrl) {
        const r3 = await fetch(detalheUrl, {
          headers: { ...HEADERS, Cookie: allCookies, Referer: r2.url },
          signal: AbortSignal.timeout(25000),
          redirect: "follow",
        });
        const html3 = await r3.text();
        debug.push({ step: "GET detalhe", status: r3.status, len: html3.length, hasMovimento: /movimenta/i.test(html3) });
        movs = parseMovimentos(html3);
        debug.push({ step: "parse detalhe", count: movs.length, sample: movs.length === 0 ? html3.slice(0, 500) : "" });
      }
    }

    if (movs.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível extrair movimentos do PJe-RJ. Pode requerer login ou o número é inválido.", debug, sample: html2.slice(0, 500) },
        { status: 404 }
      );
    }

    // Ordena por data desc
    movs.sort((a, b) => {
      const da = a.data.split("/").reverse().join("");
      const db = b.data.split("/").reverse().join("");
      return db.localeCompare(da);
    });

    return NextResponse.json({ movimentos: movs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro desconhecido", debug },
      { status: 500 }
    );
  }
}
