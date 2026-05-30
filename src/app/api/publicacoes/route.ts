import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const DJERJ_SEARCH_DAYS = 15;

export interface PubEncontrada {
  titulo: string;
  conteudo?: string;
  data_publicacao: string;
  diario: string;
  url?: string;
  hash: string;
}

type DjerjBusca = {
  tipo: "OAB" | "CONT";
  termo: string;
  label: string;
};

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function hojeSaoPaulo(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return new Date(Number(get("year")), Number(get("month")) - 1, Number(get("day")));
}

function dataHoje(): { dd: string; mm: string; yyyy: string; iso: string } {
  const d = hojeSaoPaulo();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return { dd, mm, yyyy, iso: `${yyyy}-${mm}-${dd}` };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function brToIso(dateBR: string): string {
  const [dd, mm, yyyy] = dateBR.split("/");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

async function buscarDOU(nome: string): Promise<PubEncontrada[]> {
  const { dd, mm, yyyy, iso } = dataHoje();
  const dataParam = `${dd}-${mm}-${yyyy}`;
  const query = encodeURIComponent(`"${nome}"`);
  const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${query}&s=all&exactDate=dia&data=${dataParam}`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const resultados: PubEncontrada[] = [];

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const items = (json.content ?? json.results ?? json.items ?? []) as unknown[];
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const titulo = stripHtml(String(item.title ?? item.titulo ?? "Publicacao DOU"));
      resultados.push({
        titulo,
        conteudo: item.content ? stripHtml(String(item.content)) : undefined,
        data_publicacao: iso,
        diario: "DOU",
        url: String(item.htmlUrl ?? item.url ?? item.pdfPage ?? ""),
        hash: `dou-${simpleHash(`${titulo}|${iso}`)}`,
      });
    }
    if (resultados.length > 0) return resultados;
  } catch {
    // The DOU endpoint sometimes returns HTML instead of JSON.
  }

  const articleRx = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = articleRx.exec(text)) !== null) {
    const block = m[1];
    const titleM = /<h\d[^>]*>([\s\S]*?)<\/h\d>/i.exec(block);
    const hrefM = /href="([^"]+)"/i.exec(block);
    const excerptM = /<p[^>]*class="[^"]*excerpt[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    if (!titleM) continue;
    const titulo = stripHtml(titleM[1]);
    resultados.push({
      titulo,
      conteudo: excerptM ? stripHtml(excerptM[1]) : undefined,
      data_publicacao: iso,
      diario: "DOU",
      url: hrefM ? (hrefM[1].startsWith("http") ? hrefM[1] : `https://www.in.gov.br${hrefM[1]}`) : undefined,
      hash: `dou-${simpleHash(`${titulo}|${iso}`)}`,
    });
  }

  return resultados;
}

function parseDjerjResults(html: string, busca: DjerjBusca, resultUrl: string): PubEncontrada[] {
  const searchText = stripHtml(
    /<span[^>]+id=["']ctl00_ContentPlaceHolder1_searchText["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1] ?? ""
  );

  if (normalizeText(searchText).includes("nao foram encontradas")) {
    return [];
  }

  const resultados: PubEncontrada[] = [];
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM: RegExpExecArray | null;

  while ((rowM = rowRx.exec(html)) !== null) {
    const row = rowM[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripHtml(c[1]));
    if (cells.length < 3) continue;

    const dataBR = cells[0];
    const caderno = cells[1];
    const pagina = cells[2];
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataBR)) continue;
    if (!caderno || !pagina) continue;

    const alt = stripHtml(/alt=["']([^"']+)["']/i.exec(row)?.[1] ?? "");
    const data_publicacao = brToIso(dataBR);
    const conteudoBase = alt || `Data ${dataBR}, caderno ${caderno}, pagina ${pagina}.`;
    const titulo = `DJE/TJERJ - ${caderno} - pagina ${pagina}`;
    const hashBase = `${data_publicacao}|${caderno}|${pagina}`;

    resultados.push({
      titulo,
      conteudo: `${busca.label}: ${busca.termo}. ${conteudoBase}`,
      data_publicacao,
      diario: "DJE/TJERJ",
      url: resultUrl,
      hash: `djerj-${simpleHash(hashBase)}`,
    });
  }

  return resultados;
}

async function buscarDjerjPorTermo(busca: DjerjBusca): Promise<PubEncontrada[]> {
  const hoje = hojeSaoPaulo();
  const inicio = addDays(hoje, -(DJERJ_SEARCH_DAYS - 1));
  const params = new URLSearchParams({
    dtInicio: formatDateBR(inicio),
    dtFim: formatDateBR(hoje),
    txtPesq: busca.termo,
    tipoPesq: busca.tipo,
    caderPesq: "0",
  });
  const url = `https://www3.tjrj.jus.br/consultadje/Result.aspx?${params.toString()}`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  return parseDjerjResults(html, busca, url);
}

async function buscarDJETJERJ(nome?: string, oabNumero?: string, oabUF = "RJ"): Promise<PubEncontrada[]> {
  const buscas: DjerjBusca[] = [];
  const uf = oabUF.trim().toUpperCase() || "RJ";
  const numero = oabNumero?.replace(/\D/g, "");

  if (numero && uf === "RJ") {
    buscas.push({
      tipo: "OAB",
      termo: `OAB/${uf}-${numero}`,
      label: "Encontrado pela OAB",
    });
  }

  if (nome?.trim()) {
    buscas.push({
      tipo: "CONT",
      termo: nome.trim(),
      label: "Encontrado pelo nome",
    });
  }

  const porHash = new Map<string, PubEncontrada>();
  for (const busca of buscas) {
    const items = await buscarDjerjPorTermo(busca);
    for (const item of items) {
      if (!porHash.has(item.hash)) porHash.set(item.hash, item);
    }
  }

  return [...porHash.values()];
}

export async function POST(req: NextRequest) {
  try {
    const { nome, oabNumero, oabUF } = (await req.json()) as {
      nome?: string;
      oabNumero?: string;
      oabUF?: string;
    };

    const resultados: PubEncontrada[] = [];
    const erros: string[] = [];

    if (nome) {
      try {
        const items = await buscarDOU(nome);
        resultados.push(...items);
        console.log(`[DOU] ${items.length} publicacao(oes) encontrada(s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`DOU: ${msg}`);
        console.error("[DOU] erro:", msg);
      }
    }

    if ((oabNumero && (!oabUF || oabUF === "RJ")) || nome) {
      try {
        const items = await buscarDJETJERJ(nome, oabNumero, oabUF ?? "RJ");
        resultados.push(...items);
        console.log(`[TJERJ DJE] ${items.length} publicacao(oes) encontrada(s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`TJERJ DJE: ${msg}`);
        console.error("[TJERJ DJE] erro:", msg);
      }
    }

    return NextResponse.json({
      resultados,
      erros,
      buscadoEm: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
