import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

export interface PubEncontrada {
  titulo: string;
  conteudo?: string;
  data_publicacao: string;
  diario: string;
  url?: string;
  hash: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function dataHoje(): { dd: string; mm: string; yyyy: string; iso: string } {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return { dd, mm, yyyy, iso: `${yyyy}-${mm}-${dd}` };
}

// ─── DOU — Diário Oficial da União ──────────────────────────────────────────
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

  // Tenta JSON
  try {
    const json = JSON.parse(text);
    const items: unknown[] = json.content ?? json.results ?? json.items ?? [];
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const titulo = stripHtml(String(item.title ?? item.titulo ?? "Publicação DOU"));
      resultados.push({
        titulo,
        conteudo: item.content ? stripHtml(String(item.content)) : undefined,
        data_publicacao: iso,
        diario: "DOU",
        url: String(item.htmlUrl ?? item.url ?? item.pdfPage ?? ""),
        hash: `dou-${titulo.slice(0, 60)}-${iso}`,
      });
    }
    if (resultados.length > 0) return resultados;
  } catch {
    // não é JSON, parseia HTML
  }

  // Parseia HTML — padrão do portal IN.gov.br
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
      hash: `dou-${titulo.slice(0, 60)}-${iso}`,
    });
  }

  return resultados;
}

// ─── DJE-TJERJ ──────────────────────────────────────────────────────────────
async function buscarDJETJERJ(oabNumero: string): Promise<PubEncontrada[]> {
  const { iso } = dataHoje();

  // Tenta via Railway scraper (Vercel é bloqueado pelo dje.tjrj.jus.br)
  const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_URL?.trim();
  const scraperKey = process.env.NEXT_PUBLIC_SCRAPER_KEY?.trim();
  let html = "";

  if (scraperUrl) {
    const scraperRes = await fetch(`${scraperUrl}/dje-tjerj`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(scraperKey ? { Authorization: `Bearer ${scraperKey}` } : {}),
      },
      body: JSON.stringify({ oabNumero }),
      signal: AbortSignal.timeout(20000),
    });
    if (scraperRes.ok) {
      const data = await scraperRes.json() as { html?: string; status?: number };
      html = data.html ?? "";
    }
  }

  // Fallback: tenta direto (pode falhar em produção)
  if (!html) {
    const { dd, mm, yyyy } = dataHoje();
    const dataStr = `${dd}/${mm}/${yyyy}`;
    const params = new URLSearchParams({
      metodo: "pesquisar", numOAB: oabNumero, tipoOAB: "A",
      dtInicio: dataStr, dtFim: dataStr, cadernos: "0",
    });
    const res = await fetch(`https://dje.tjrj.jus.br/consultaAdvogadoAction.do?${params}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  }
  const resultados: PubEncontrada[] = [];

  // Parseia linhas de tabela com publicações
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM: RegExpExecArray | null;
  while ((rowM = rowRx.exec(html)) !== null) {
    const row = rowM[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      stripHtml(c[1])
    );
    if (cells.length < 2) continue;
    const meaningful = cells.filter((c) => c.length > 5);
    if (!meaningful.length) continue;

    const linkM = /href="([^"]*\.pdf[^"]*)"/i.exec(row);
    const titulo = meaningful[0];
    const hash = `tjerj-${titulo.slice(0, 60)}-${iso}`;

    resultados.push({
      titulo,
      conteudo: meaningful.slice(1).join(" · "),
      data_publicacao: iso,
      diario: "DJE/TJERJ",
      url: linkM
        ? linkM[1].startsWith("http")
          ? linkM[1]
          : `https://dje.tjrj.jus.br${linkM[1]}`
        : undefined,
      hash,
    });
  }

  return resultados;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
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
        console.log(`[DOU] ${items.length} publicação(ões) encontrada(s)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`DOU: ${msg}`);
        console.error("[DOU] erro:", msg);
      }
    }

    if (oabNumero && (!oabUF || oabUF === "RJ")) {
      try {
        const items = await buscarDJETJERJ(oabNumero);
        resultados.push(...items);
        console.log(`[TJERJ DJE] ${items.length} publicação(ões) encontrada(s)`);
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
