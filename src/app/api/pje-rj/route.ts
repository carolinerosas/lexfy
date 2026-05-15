import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const BASE = "https://tjrj.pje.jus.br";
const ENTRY_URL = `${BASE}/pje/ConsultaPublica/listView.seam`;

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

// Cookie jar simples
class CookieJar {
  private cookies = new Map<string, string>();
  add(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(/,(?=\s*\w+=)/);
    for (const p of parts) {
      const first = p.split(";")[0].trim();
      const eq = first.indexOf("=");
      if (eq > 0) {
        this.cookies.set(first.slice(0, eq), first.slice(eq + 1));
      }
    }
  }
  toString(): string {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

// Extrai todos inputs (incluindo hidden) com seus valores atuais
interface FormInput { name: string; value: string; type?: string; id?: string }
function extractAllInputs(html: string): FormInput[] {
  const result: FormInput[] = [];
  const inputPattern = /<input\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputPattern.exec(html)) !== null) {
    const tag = m[0];
    const name = tag.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "";
    const type = tag.match(/\btype=["']([^"']+)["']/i)?.[1];
    const id = tag.match(/\bid=["']([^"']+)["']/i)?.[1];
    result.push({ name, value, type, id });
  }
  return result;
}

function findFormFields(inputs: FormInput[]) {
  const fieldNumero = inputs.find((i) =>
    /numProcesso.*inputNumeroProcesso$/i.test(i.name) ||
    /numProcesso-inputNumeroProcesso$/i.test(i.name) ||
    /numProcesso.*input$/i.test(i.name)
  )?.name;

  const btnPesquisar = inputs.find((i) =>
    i.value === "Pesquisar" || /pesquisar/i.test(i.name) || /searchProcessos/i.test(i.name)
  )?.name;

  const formId = inputs.find((i) => /^fPP\b/.test(i.name))?.name.split(":")[0] ?? "fPP";

  return { fieldNumero, btnPesquisar, formId };
}

function findDetalheUrl(html: string): string | null {
  // Procura href ou window.open com DetalheProcesso
  const patterns = [
    /href=["']([^"']*DetalheProcessoConsultaPublica[^"']+)["']/i,
    /window\.open\(['"]([^'"]*DetalheProcesso[^'"]+)/i,
    /location\.href\s*=\s*['"]([^'"]*DetalheProcesso[^'"]+)/i,
    /href=["']([^"']*\/Processo\/ConsultaProcesso\/[^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      let href = m[1].replace(/&amp;/g, "&");
      if (href.startsWith("http")) return href;
      if (href.startsWith("/")) return BASE + href;
      return `${BASE}/pje/${href}`;
    }
  }
  return null;
}

function parseMovimentos(html: string): Movimento[] {
  const movs: Movimento[] = [];
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

  const jar = new CookieJar();
  const debug: Record<string, unknown>[] = [];

  try {
    // PASSO 1: GET inicial, segue redirects, captura cookies e cid
    const r1 = await fetch(ENTRY_URL, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    jar.add(r1.headers.get("set-cookie"));
    const html1 = await r1.text();
    const finalUrl = r1.url;
    const cidMatch = finalUrl.match(/[?&]cid=(\d+)/);
    const cid = cidMatch?.[1] ?? null;

    const inputs = extractAllInputs(html1);
    const { fieldNumero, btnPesquisar, formId } = findFormFields(inputs);
    debug.push({
      step: "GET inicial",
      status: r1.status,
      finalUrl,
      cid,
      inputs: inputs.length,
      fieldNumero,
      btnPesquisar,
      formId,
      cookies: jar.toString().split(";").length,
    });

    if (!fieldNumero) {
      return NextResponse.json(
        { error: "Não foi possível encontrar campo de busca no PJe-RJ", debug, sample: html1.slice(0, 600) },
        { status: 500 }
      );
    }

    // PASSO 2: Monta body com TODOS os hidden inputs + nosso número
    const body = new URLSearchParams();
    body.set(formId, formId); // marca que o form foi submetido
    for (const inp of inputs) {
      if (inp.type === "submit" || inp.type === "button" || inp.type === "image") continue;
      if (inp.name === fieldNumero) continue;
      if (body.has(inp.name)) continue;
      body.set(inp.name, inp.value);
    }
    body.set(fieldNumero, numero);
    if (btnPesquisar) body.set(btnPesquisar, "Pesquisar");

    // PASSO 3: POST sem AJAX header pra receber HTML completo
    const postUrl = finalUrl; // mantém cid
    const r2 = await fetch(postUrl, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.toString(),
        Referer: finalUrl,
        Origin: BASE,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(25000),
      redirect: "follow",
    });
    jar.add(r2.headers.get("set-cookie"));
    const html2 = await r2.text();
    debug.push({
      step: "POST search",
      status: r2.status,
      finalUrl: r2.url,
      len: html2.length,
      hasDetalhe: html2.includes("DetalheProcesso"),
      hasMovimento: /movimenta/i.test(html2),
      isRedirect: html2.includes("Ajax-Response"),
      bodyLen: body.toString().length,
    });

    let movs = parseMovimentos(html2);
    debug.push({ step: "parse 1", count: movs.length });

    if (movs.length === 0) {
      const detalheUrl = findDetalheUrl(html2);
      debug.push({ step: "achou link detalhe", url: detalheUrl, sample: detalheUrl ? "" : html2.slice(0, 800) });

      if (detalheUrl) {
        const r3 = await fetch(detalheUrl, {
          headers: { ...HEADERS, Cookie: jar.toString(), Referer: r2.url },
          signal: AbortSignal.timeout(25000),
          redirect: "follow",
        });
        jar.add(r3.headers.get("set-cookie"));
        const html3 = await r3.text();
        debug.push({ step: "GET detalhe", status: r3.status, len: html3.length, hasMovimento: /movimenta/i.test(html3) });
        movs = parseMovimentos(html3);
        debug.push({ step: "parse detalhe", count: movs.length, sample: movs.length === 0 ? html3.slice(0, 800) : "" });
      }
    }

    if (movs.length === 0) {
      return NextResponse.json(
        { error: "PJe-RJ não retornou movimentos. Provável bloqueio anti-bot (IP do servidor) ou conversation ID expirado.", debug },
        { status: 404 }
      );
    }

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
