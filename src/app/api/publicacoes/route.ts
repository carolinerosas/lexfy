import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Processo, Publicacao } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const PUBLICATION_SEARCH_DAYS = 45;
const COMUNICA_API_URL = "https://comunicaapi.pje.jus.br/api/v1";
const USER_ID = "lexfy_shared";
const SYNC_STATUS_ID = "daily_publicacoes";

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

type DjenAdvogado = {
  advogado?: {
    nome?: string;
    numero_oab?: string;
    uf_oab?: string;
  };
};

type DjenComunicacao = {
  id?: number;
  hash?: string;
  data_disponibilizacao?: string;
  datadisponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  link?: string;
  tipoDocumento?: string;
  nomeClasse?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  meiocompleto?: string;
  destinatarioadvogados?: DjenAdvogado[];
};

type DjenResponse = {
  status?: string;
  message?: string;
  count?: number;
  items?: DjenComunicacao[];
};

type PerfilAdvogadoDb = {
  nome?: string | null;
  oab_numero?: string | null;
  oab_uf?: string | null;
};

type PublicacoesSyncStatus = {
  id: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
  last_found?: number | null;
  last_imported?: number | null;
  last_errors?: string[] | null;
  updated_at?: string | null;
};

const CNJ_REGEX = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (
    (error as { code?: string }).code === "PGRST205" ||
    (error as { code?: string }).code === "42P01"
  );
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function onlyDigits(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

function extractCNJ(text?: string): string | null {
  if (!text) return null;
  const m = CNJ_REGEX.exec(text);
  return m ? m[0] : null;
}

function findProcessoIdByCNJ(processos: Pick<Processo, "id" | "numero">[], ...texts: (string | undefined)[]): string | undefined {
  for (const text of texts) {
    const cnj = extractCNJ(text);
    if (!cnj) continue;
    const digits = onlyDigits(cnj);
    const match = processos.find((p) => onlyDigits(p.numero) === digits);
    if (match) return match.id;
  }
  return undefined;
}

function publicacaoKey(pub: Pick<Publicacao, "titulo" | "conteudo" | "data_publicacao" | "diario" | "url"> | PubEncontrada): string {
  return simpleHash([
    pub.diario ?? "",
    pub.data_publicacao ?? "",
    pub.titulo ?? "",
    (pub.conteudo ?? "").slice(0, 1000),
    pub.url ?? "",
  ].join("|"));
}

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

function formatDateISO(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateBRFromISO(dateISO: string): string {
  const [yyyy, mm, dd] = dateISO.split("-");
  if (!yyyy || !mm || !dd) return dateISO;
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
  const inicio = addDays(hoje, -(PUBLICATION_SEARCH_DAYS - 1));
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

function mapDjenItem(item: DjenComunicacao): PubEncontrada {
  const dataDisponibilizacao = item.data_disponibilizacao ?? "";
  const processo = item.numeroprocessocommascara ?? item.numero_processo ?? "";
  const orgao = item.nomeOrgao ?? item.siglaTribunal ?? "DJEN";
  const tipo = item.tipoComunicacao ?? item.tipoDocumento ?? "Publicacao";
  const classe = item.nomeClasse ?? "";
  const advogados = (item.destinatarioadvogados ?? [])
    .map((a) => {
      const adv = a.advogado;
      if (!adv?.nome) return "";
      const oab = adv.numero_oab && adv.uf_oab ? ` - OAB/${adv.uf_oab} ${adv.numero_oab}` : "";
      return `${adv.nome}${oab}`;
    })
    .filter(Boolean);

  const teor = item.texto ? stripHtml(item.texto) : "";

  // Metadados compactos no rodapé (o teor vem primeiro para leitura)
  const metaParts = [
    orgao,
    classe ? `Classe: ${classe}` : "",
    advogados.length ? `Adv.: ${advogados.join("; ")}` : "",
  ].filter(Boolean);
  const meta = metaParts.length ? `\n\n— ${metaParts.join(" · ")}` : "";

  const conteudo = (teor || metaParts.join(" · ")) + (teor ? meta : "");
  const hash = item.hash ?? String(item.id ?? simpleHash(`${dataDisponibilizacao}|${processo}|${teor}`));

  return {
    titulo: `${tipo}${processo ? ` · ${processo}` : ""}`,
    conteudo: conteudo.trim(),
    data_publicacao: dataDisponibilizacao || dataHoje().iso,
    diario: item.meiocompleto ?? "Diario de Justica Eletronico Nacional",
    url: item.link || undefined,
    hash: `djen-${hash}`,
  };
}

async function buscarDJEN(nome?: string, oabNumero?: string, oabUF = "RJ"): Promise<PubEncontrada[]> {
  const hoje = hojeSaoPaulo();
  const inicio = addDays(hoje, -(PUBLICATION_SEARCH_DAYS - 1));
  const numero = oabNumero?.replace(/\D/g, "");
  const uf = oabUF.trim().toUpperCase() || "RJ";
  const buscas: URLSearchParams[] = [];

  if (numero) {
    buscas.push(new URLSearchParams({
      numeroOab: numero,
      ufOab: uf,
    }));
  }

  if (nome?.trim()) {
    buscas.push(new URLSearchParams({
      nomeAdvogado: nome.trim(),
    }));
  }

  const porHash = new Map<string, PubEncontrada>();

  for (const filtro of buscas) {
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const params = new URLSearchParams({
        pagina: String(pagina),
        itensPorPagina: "100",
        dataDisponibilizacaoInicio: formatDateISO(inicio),
        dataDisponibilizacaoFim: formatDateISO(hoje),
        ...Object.fromEntries(filtro.entries()),
      });
      const url = `${COMUNICA_API_URL}/comunicacao?${params.toString()}`;

      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as DjenResponse;
      const items = data.items ?? [];
      totalPaginas = Math.max(1, Math.ceil((data.count ?? items.length) / 100));

      for (const item of items) {
        const pub = mapDjenItem(item);
        if (!porHash.has(pub.hash)) porHash.set(pub.hash, pub);
      }

      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 10);
  }

  return [...porHash.values()];
}

async function executarBuscaPublicacoes(input: {
  nome?: string;
  oabNumero?: string;
  oabUF?: string;
}): Promise<{ resultados: PubEncontrada[]; erros: string[]; buscadoEm: string }> {
  const { nome, oabNumero, oabUF } = input;
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

  if (oabNumero || nome) {
    try {
      const items = await buscarDJEN(nome, oabNumero, oabUF ?? "RJ");
      resultados.push(...items);
      console.log(`[DJEN/CNJ] ${items.length} publicacao(oes) encontrada(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      erros.push(`DJEN/CNJ: ${msg}`);
      console.error("[DJEN/CNJ] erro:", msg);
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

  return {
    resultados,
    erros,
    buscadoEm: new Date().toISOString(),
  };
}

async function getPerfilCron(): Promise<PerfilAdvogadoDb | null> {
  const { data, error } = await supabase
    .from("perfil_advogado")
    .select("nome,oab_numero,oab_uf")
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }

  return data as PerfilAdvogadoDb | null;
}

async function salvarResultadosNoBanco(resultados: PubEncontrada[]): Promise<number> {
  if (resultados.length === 0) return 0;

  const [{ data: publicacoesExistentes, error: publicacoesError }, { data: processosData, error: processosError }] = await Promise.all([
    supabase
      .from("publicacoes")
      .select("titulo,conteudo,data_publicacao,diario,url"),
    supabase
      .from("processos")
      .select("id,numero"),
  ]);

  if (publicacoesError) throw publicacoesError;
  if (processosError) throw processosError;

  const knownKeys = new Set(
    ((publicacoesExistentes ?? []) as Publicacao[]).map((pub) => publicacaoKey(pub))
  );
  const processos = (processosData ?? []) as Pick<Processo, "id" | "numero">[];
  const nowIso = new Date().toISOString();
  const novas: Publicacao[] = [];

  for (const pub of resultados) {
    const key = publicacaoKey(pub);
    if (knownKeys.has(key)) continue;

    novas.push({
      id: generateId(),
      processo_id: findProcessoIdByCNJ(processos, pub.titulo, pub.conteudo),
      titulo: pub.titulo,
      conteudo: pub.conteudo,
      data_publicacao: pub.data_publicacao,
      diario: pub.diario,
      url: pub.url || undefined,
      lida: false,
      created_at: nowIso,
      user_id: USER_ID,
    });
    knownKeys.add(key);
  }

  if (novas.length === 0) return 0;

  const { error } = await supabase.from("publicacoes").insert(novas);
  if (error) throw error;

  return novas.length;
}

async function getSyncStatus(): Promise<PublicacoesSyncStatus | null> {
  const { data, error } = await supabase
    .from("publicacoes_sync_status")
    .select("*")
    .eq("id", SYNC_STATUS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }

  return data as PublicacoesSyncStatus | null;
}

async function updateSyncStatus(input: Partial<PublicacoesSyncStatus>): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("publicacoes_sync_status")
    .upsert({
      id: SYNC_STATUS_ID,
      updated_at: nowIso,
      ...input,
    }, { onConflict: "id" });

  if (error && !isMissingTable(error)) throw error;
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (process.env.PUBLICACOES_CRON_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "cron disabled" });
  }

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  await updateSyncStatus({ last_run_at: startedAt, last_errors: [] });

  try {
    const perfil = await getPerfilCron();
    const nome = perfil?.nome?.trim() ?? "";
    const oabNumero = perfil?.oab_numero?.trim() ?? "";
    const oabUF = perfil?.oab_uf?.trim().toUpperCase() || "RJ";

    if (!nome && !oabNumero) {
      throw new Error("Perfil de advogado nao configurado para busca automatica.");
    }

    const busca = await executarBuscaPublicacoes({ nome, oabNumero, oabUF });
    const imported = await salvarResultadosNoBanco(busca.resultados);

    await updateSyncStatus({
      last_run_at: startedAt,
      last_success_at: busca.buscadoEm,
      last_found: busca.resultados.length,
      last_imported: imported,
      last_errors: busca.erros,
    });

    return NextResponse.json({
      ok: true,
      total: busca.resultados.length,
      imported,
      erros: busca.erros,
      buscadoEm: busca.buscadoEm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    await updateSyncStatus({ last_run_at: startedAt, last_errors: [msg] });

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as {
      nome?: string;
      oabNumero?: string;
      oabUF?: string;
    };

    return NextResponse.json(await executarBuscaPublicacoes(input));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
