import Fastify from "fastify";
import { chromium } from "playwright";

if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
const USER_ID = process.env.JUSTIO_USER_ID || "lexfy_shared";
const SUPABASE_URL = process.env.JUSTIO_SUPABASE_URL || "https://upwckimpkpxfzejrupkg.supabase.co";
const SUPABASE_KEY = process.env.JUSTIO_SUPABASE_KEY || "sb_publishable_AzgYO9RznVv6B10D1ZdqJQ_A-ZsMBmc";
const PUBLICACOES_DAILY_HOUR = Number(process.env.JUSTIO_PUBLICACOES_DAILY_HOUR || 8);
const PUBLICACOES_DAILY_ENABLED = process.env.JUSTIO_PUBLICACOES_DAILY_ENABLED !== "false";
const PUBLICACOES_SEARCH_DAYS = Number(process.env.JUSTIO_PUBLICACOES_SEARCH_DAYS || 45);
const SYNC_STATUS_ID = "daily_publicacoes";
const COMUNICA_API_URL = "https://comunicaapi.pje.jus.br/api/v1";
const COMUNICA_PORTAL_URL = "https://comunica.pje.jus.br";
const PUBLICACOES_BROWSER_FALLBACK = process.env.JUSTIO_PUBLICACOES_BROWSER_FALLBACK !== "false";
const PUBLICACOES_FORCE_BROWSER = process.env.JUSTIO_PUBLICACOES_FORCE_BROWSER === "true";

const app = Fastify({ logger: true });
let publicacoesTimer = null;
let nextPublicacoesRunAt = "";
let supabaseClientPromise = null;

async function getSupabase() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY));
  }
  return supabaseClientPromise;
}

// CORS — permite chamadas do justio.com.br e localhost
const ALLOWED_ORIGINS = [
  "https://www.justio.com.br",
  "https://app.justio.com.br",
  "http://localhost:3000",
];

app.addHook("onSend", (req, reply, payload, done) => {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    reply.header("Access-Control-Allow-Origin", origin || "*");
  }
  reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  done();
});

app.options("*", async (req, reply) => {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    reply.header("Access-Control-Allow-Origin", origin || "*");
  }
  reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  reply.code(204).send();
});

// Browser singleton — abre uma vez, reusa entre requests
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browserPromise;
}

function checkAuth(req, reply) {
  if (!API_KEY) return true; // sem auth se API_KEY não configurada
  const auth = req.headers["authorization"] ?? req.headers["x-api-key"];
  if (auth !== `Bearer ${API_KEY}` && auth !== API_KEY) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

function normalizeDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

function dateRangeRecentISO(days) {
  const hoje = new Date();
  return Array.from({ length: Math.max(1, Number(days) || 1) }, (_, index) => normalizeDateISO(addDays(hoje, -index)));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  if (value == null) return "";
  return stripTags(String(value)).replace(/\s+/g, " ").trim();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

const CNJ_REGEX = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

function extractCNJ(text) {
  const match = CNJ_REGEX.exec(String(text || ""));
  return match ? match[0] : "";
}

function publicacaoKey(pub) {
  return simpleHash([
    pub.diario || "",
    pub.data_publicacao || "",
    pub.titulo || "",
    String(pub.conteudo || "").slice(0, 1000),
    pub.url || "",
  ].join("|"));
}

function publicacaoLooseKey(pub) {
  return simpleHash([
    pub.diario || "",
    pub.data_publicacao || "",
    pub.titulo || "",
  ].join("|"));
}

function generateId() {
  return crypto.randomUUID();
}

function criarFiltrosDjen({ nome, oabNumero, oabUF = "RJ" }) {
  const filtros = [];
  const numero = onlyDigits(oabNumero);
  const uf = String(oabUF || "RJ").trim().toUpperCase() || "RJ";

  if (numero) filtros.push({ numeroOab: numero, ufOab: uf });
  else if (nome?.trim()) filtros.push({ nomeAdvogado: nome.trim() });

  return filtros;
}

function buildDjenParams({ pagina = 1, dataInicio, dataFim, filtro }) {
  return new URLSearchParams({
    pagina: String(pagina),
    itensPorPagina: "100",
    dataDisponibilizacaoInicio: dataInicio,
    dataDisponibilizacaoFim: dataFim,
    meio: "D",
    ...filtro,
  });
}

function collectDjenItems(porHash, items) {
  for (const item of items || []) {
    const hash = item.hash ?? String(item.id ?? simpleHash(JSON.stringify(item)));
    if (hash && !porHash.has(hash)) porHash.set(hash, item);
  }
}

async function buscarDjenDireto({ nome, oabNumero, oabUF = "RJ", dias = PUBLICACOES_SEARCH_DAYS }) {
  const filtros = criarFiltrosDjen({ nome, oabNumero, oabUF });
  const porHash = new Map();
  const jobs = dateRangeRecentISO(dias).flatMap((data) =>
    filtros.map((filtro) => ({ data, filtro }))
  );
  let successfulRequests = 0;
  let lastError = null;

  async function buscarDia({ data, filtro }) {
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const params = buildDjenParams({
        pagina,
        dataInicio: data,
        dataFim: data,
        filtro,
      });
      const res = await fetch(`${COMUNICA_API_URL}/comunicacao?${params.toString()}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
          Accept: "application/json, text/html, */*",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) throw new Error(`DJEN HTTP ${res.status}`);
      successfulRequests += 1;

      const responseData = await res.json();
      const items = responseData.items ?? [];
      totalPaginas = Math.max(1, Math.ceil((responseData.count ?? items.length) / 100));

      collectDjenItems(porHash, items);

      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 10);
  }

  for (let index = 0; index < jobs.length; index += 4) {
    const chunk = jobs.slice(index, index + 4);
    const settled = await Promise.allSettled(chunk.map((job) => buscarDia(job)));
    for (const result of settled) {
      if (result.status === "rejected") {
        lastError = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      }
    }
  }

  if (successfulRequests === 0 && lastError) throw lastError;

  return [...porHash.values()];
}

async function buscarDjenBrowser({ nome, oabNumero, oabUF = "RJ", dias = PUBLICACOES_SEARCH_DAYS }) {
  const filtros = criarFiltrosDjen({ nome, oabNumero, oabUF });
  if (!filtros.length) return [];

  const datas = dateRangeRecentISO(dias);
  const dataFim = datas[0];
  const dataInicio = datas[datas.length - 1] || dataFim;
  const porHash = new Map();
  let successfulRequests = 0;
  let lastError = null;

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  async function abrirPortal() {
    await page.goto(COMUNICA_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(async () => {
        await page.goto(`${COMUNICA_PORTAL_URL}/consulta`, { waitUntil: "domcontentloaded", timeout: 30000 });
      });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null);
  }

  function parseDjenJson(text, label) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} resposta invalida: ${text.slice(0, 220)}`);
    }
  }

  async function fetchJsonNoNavegador(url) {
    const apiRes = await ctx.request.get(url, {
      timeout: 25000,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: `${COMUNICA_PORTAL_URL}/`,
        Origin: COMUNICA_PORTAL_URL,
      },
    });
    const apiText = await apiRes.text();
    if (apiRes.ok()) return parseDjenJson(apiText, "DJEN browser request");

    const requestMessage = `DJEN browser request HTTP ${apiRes.status()}: ${apiText.slice(0, 220)}`;

    try {
      return await page.evaluate(async (targetUrl) => {
        const res = await fetch(targetUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json, text/plain, */*",
          },
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`DJEN browser HTTP ${res.status}: ${text.slice(0, 220)}`);
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`DJEN browser page resposta invalida: ${text.slice(0, 220)}`);
        }
      }, url);
    } catch (err) {
      const pageMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`${requestMessage}; page fetch: ${pageMessage}`);
    }
  }

  async function buscarPeriodo({ filtro, inicio, fim }) {
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const params = buildDjenParams({
        pagina,
        dataInicio: inicio,
        dataFim: fim,
        filtro,
      });
      const url = `${COMUNICA_API_URL}/comunicacao?${params.toString()}`;
      const responseData = await fetchJsonNoNavegador(url);
      successfulRequests += 1;

      const items = responseData.items ?? [];
      totalPaginas = Math.max(1, Math.ceil((responseData.count ?? items.length) / 100));
      collectDjenItems(porHash, items);

      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 10);
  }

  try {
    await abrirPortal();

    for (const filtro of filtros) {
      try {
        await buscarPeriodo({ filtro, inicio: dataInicio, fim: dataFim });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        for (let index = 0; index < datas.length; index += 1) {
          try {
            await buscarPeriodo({ filtro, inicio: datas[index], fim: datas[index] });
          } catch (diaErr) {
            lastError = diaErr instanceof Error ? diaErr : new Error(String(diaErr));
          }
        }
      }
    }
  } finally {
    await ctx.close().catch(() => null);
  }

  if (successfulRequests === 0 && lastError) throw lastError;
  return [...porHash.values()];
}

async function buscarDjen(input) {
  if (PUBLICACOES_FORCE_BROWSER) {
    return buscarDjenBrowser(input);
  }

  try {
    return await buscarDjenDireto(input);
  } catch (err) {
    const directMessage = err instanceof Error ? err.message : String(err);
    if (!PUBLICACOES_BROWSER_FALLBACK) throw err;

    app.log.warn({ error: directMessage }, "DJEN direto falhou; tentando fallback com navegador");

    try {
      return await buscarDjenBrowser(input);
    } catch (browserErr) {
      const browserMessage = browserErr instanceof Error ? browserErr.message : String(browserErr);
      throw new Error(`DJEN direto: ${directMessage}; DJEN navegador: ${browserMessage}`);
    }
  }
}

function mapDjenPublicacao(item) {
  const data = item.data_disponibilizacao || item.datadisponibilizacao || normalizeDateISO(new Date());
  const numero = item.numeroprocessocommascara || item.numero_processo || "";
  const numeroMascara = item.numeroprocessocommascara || numero;
  const orgao = item.nomeOrgao || item.siglaTribunal || "DJEN";
  const tipo = item.tipoComunicacao || item.tipoDocumento || "Publicacao";
  const classe = item.nomeClasse || "";
  const advogados = (item.destinatarioadvogados || [])
    .map((a) => {
      const adv = a.advogado;
      if (!adv?.nome) return "";
      const oab = adv.numero_oab && adv.uf_oab ? ` - OAB/${adv.uf_oab} ${adv.numero_oab}` : "";
      return `${adv.nome}${oab}`;
    })
    .filter(Boolean);
  const teor = cleanText(item.texto || "");
  const advogadosText = advogados.length ? `\n\nAdvogados: ${advogados.join("; ")}` : "";
  const meta = [
    orgao,
    classe ? `Classe: ${classe}` : "",
    item.siglaTribunal ? `Tribunal: ${item.siglaTribunal}` : "",
  ].filter(Boolean).join(" - ");

  return {
    titulo: `${tipo}${numeroMascara ? ` - ${numeroMascara}` : ""}`,
    conteudo: [teor, meta, advogadosText].filter(Boolean).join("\n\n").trim(),
    data_publicacao: data,
    diario: item.meiocompleto || "Diario de Justica Eletronico Nacional",
    url: item.hash
      ? `https://comunica.pje.jus.br/consulta/comunicacao/${item.hash}/certidao`
      : item.link || undefined,
    hash: `djen-${item.hash ?? item.id ?? simpleHash(`${data}|${numeroMascara}|${teor}`)}`,
  };
}

async function getPerfilAdvogadoCloud() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("perfil_advogado")
    .select("nome,oab_numero,oab_uf")
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function updatePublicacoesSyncStatus(input) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("publicacoes_sync_status")
    .upsert({
      id: SYNC_STATUS_ID,
      updated_at: new Date().toISOString(),
      ...input,
    }, { onConflict: "id" });

  if (error) throw error;
}

async function salvarPublicacoesDjen(items) {
  if (!items.length) return 0;

  const supabase = await getSupabase();
  const [{ data: publicacoesData, error: publicacoesError }, { data: processosData, error: processosError }] = await Promise.all([
    supabase.from("publicacoes").select("titulo,conteudo,data_publicacao,diario,url"),
    supabase.from("processos").select("id,numero"),
  ]);

  if (publicacoesError) throw publicacoesError;
  if (processosError) throw processosError;

  const knownKeys = new Set((publicacoesData || []).map((pub) => publicacaoKey(pub)));
  const knownLooseKeys = new Set((publicacoesData || []).map((pub) => publicacaoLooseKey(pub)));
  const processos = processosData || [];
  const createdAt = new Date().toISOString();
  const novas = [];

  for (const item of items) {
    const pub = mapDjenPublicacao(item);
    const processoDigits = onlyDigits(extractCNJ(`${pub.titulo} ${pub.conteudo}`));
    const processo = processos.find((p) => onlyDigits(p.numero) === processoDigits);
    const key = publicacaoKey(pub);
    const looseKey = publicacaoLooseKey(pub);

    if (knownKeys.has(key) || knownLooseKeys.has(looseKey)) continue;

    novas.push({
      id: generateId(),
      processo_id: processo?.id,
      created_at: createdAt,
      lida: false,
      user_id: USER_ID,
      ...pub,
    });
    knownKeys.add(key);
    knownLooseKeys.add(looseKey);
  }

  if (!novas.length) return 0;

  const { error } = await supabase.from("publicacoes").insert(novas);
  if (error) throw error;
  return novas.length;
}

async function executarBuscaPublicacoes({ nome, oabNumero, oabUF, dias = PUBLICACOES_SEARCH_DAYS } = {}) {
  const perfil = nome || oabNumero
    ? { nome, oab_numero: oabNumero, oab_uf: oabUF || "RJ" }
    : await getPerfilAdvogadoCloud();
  const perfilNome = cleanText(perfil?.nome || "");
  const perfilOab = onlyDigits(perfil?.oab_numero);
  const perfilUf = cleanText(perfil?.oab_uf || "RJ").toUpperCase() || "RJ";
  const startedAt = new Date().toISOString();

  await updatePublicacoesSyncStatus({ last_run_at: startedAt, last_errors: [] });

  if (!perfilNome && !perfilOab) {
    throw new Error("Perfil de advogado nao configurado para busca de publicacoes no Railway.");
  }

  const items = await buscarDjen({
    nome: perfilNome,
    oabNumero: perfilOab,
    oabUF: perfilUf,
    dias,
  });
  const imported = await salvarPublicacoesDjen(items);
  const finishedAt = new Date().toISOString();

  await updatePublicacoesSyncStatus({
    last_run_at: startedAt,
    last_success_at: finishedAt,
    last_found: items.length,
    last_imported: imported,
    last_errors: [],
  });

  return {
    ok: true,
    total: items.length,
    imported,
    buscadoEm: finishedAt,
  };
}

async function executarBuscaPublicacoesSegura(source = "manual") {
  try {
    const result = await executarBuscaPublicacoes();
    app.log.info({ source, ...result }, "Busca de publicacoes concluida");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    app.log.error({ source, error: message }, "Busca de publicacoes falhou");
    try {
      await updatePublicacoesSyncStatus({
        last_run_at: new Date().toISOString(),
        last_errors: [`Railway: ${message}`],
      });
    } catch (statusErr) {
      app.log.error(statusErr, "Nao foi possivel atualizar status de publicacoes");
    }
    throw err;
  }
}

function nextDailyRun(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function schedulePublicacoesDaily() {
  if (!PUBLICACOES_DAILY_ENABLED) return;
  if (publicacoesTimer) clearTimeout(publicacoesTimer);

  const nextRun = nextDailyRun(PUBLICACOES_DAILY_HOUR);
  nextPublicacoesRunAt = nextRun.toISOString();
  const delay = Math.max(1000, nextRun.getTime() - Date.now());

  publicacoesTimer = setTimeout(async () => {
    await executarBuscaPublicacoesSegura("daily").catch(() => undefined);
    schedulePublicacoesDaily();
  }, delay);

  app.log.info(
    { nextPublicacoesRunAt, hour: PUBLICACOES_DAILY_HOUR },
    "Busca diaria de publicacoes agendada"
  );
}

// Healthcheck
app.get("/", async () => ({
  ok: true,
  service: "lexfy-scraper",
  publicacoesDailyEnabled: PUBLICACOES_DAILY_ENABLED,
  publicacoesDailyHour: PUBLICACOES_DAILY_HOUR,
  publicacoesBrowserFallback: PUBLICACOES_BROWSER_FALLBACK,
  publicacoesForceBrowser: PUBLICACOES_FORCE_BROWSER,
  nextPublicacoesRunAt,
}));

app.post("/djen/publicacoes", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  try {
    const items = await buscarDjen(req.body ?? {});
    return { publicacoes: items.map(mapDjenPublicacao), count: items.length };
  } catch (err) {
    return reply.code(502).send({
      error: "djen_publicacoes_failed",
      message: err instanceof Error ? err.message : "Nao foi possivel buscar publicacoes no DJEN.",
    });
  }
});

app.post("/publicacoes/sync", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  try {
    return await executarBuscaPublicacoesSegura("manual");
  } catch (err) {
    return reply.code(502).send({
      ok: false,
      error: "publicacoes_sync_failed",
      message: err instanceof Error ? err.message : "Nao foi possivel sincronizar publicacoes.",
    });
  }
});

// Endpoint PJe-RJ
app.post("/pje-rj", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { numero } = req.body ?? {};
  if (!numero) return reply.code(400).send({ error: "numero obrigatorio" });

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "pt-BR",
    viewport: { width: 1366, height: 768 },
  });
  const page = await ctx.newPage();
  // Mascara propriedades que denunciam automação
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const debug = [];
  try {
    await page.goto("https://tjrj.pje.jus.br/pje/ConsultaPublica/listView.seam", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    debug.push({ step: "GET listView", url: page.url() });

    // Aguarda o campo de busca aparecer
    const inputSel = 'input[id*="numProcesso-inputNumeroProcesso"]';
    await page.waitForSelector(inputSel, { timeout: 15000 });
    await page.fill(inputSel, numero);
    debug.push({ step: "preencheu número" });

    // Clica em pesquisar e aguarda navegação ou atualização
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => null),
      page.click('input[type="submit"][value="Pesquisar"], input[id*="searchProcessos"]'),
    ]);
    debug.push({ step: "clicou pesquisar", url: page.url() });

    // Aguarda resultado: ou link DetalheProcesso ou tabela de resultados
    await page.waitForSelector(
      'a[href*="DetalheProcesso"], a[onclick*="DetalheProcesso"], table.rich-table',
      { timeout: 20000 }
    ).catch(() => null);

    // Tenta clicar no primeiro resultado pra abrir o detalhe
    const linkDetalhe = await page.$('a[href*="DetalheProcesso"], a[onclick*="DetalheProcesso"]');
    if (linkDetalhe) {
      const [popup] = await Promise.all([
        page.context().waitForEvent("page", { timeout: 10000 }).catch(() => null),
        linkDetalhe.click().catch(() => null),
      ]);
      if (popup) {
        await popup.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => null);
        debug.push({ step: "abriu popup detalhe", url: popup.url() });
        const movs = await extractMovimentos(popup);
        await popup.close();
        await ctx.close();
        if (movs.length > 0) return { movimentos: movs };
      } else {
        // sem popup; pode ter navegado na mesma aba
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => null);
        debug.push({ step: "navegou detalhe mesma aba", url: page.url() });
      }
    }

    // Extrai movimentos da página atual
    const movs = await extractMovimentos(page);
    debug.push({ step: "extracao final", count: movs.length });
    await ctx.close();

    if (movs.length === 0) {
      // Retorna sample do HTML pra debug
      const html = await page.content().catch(() => "");
      return reply.code(404).send({
        error: "Sem movimentos extraídos",
        debug,
        sample: html.slice(0, 1000),
      });
    }
    return { movimentos: movs };
  } catch (err) {
    await ctx.close().catch(() => null);
    return reply.code(500).send({
      error: err instanceof Error ? err.message : "erro",
      debug,
    });
  }
});

// Endpoint DJE-TJERJ — Playwright (HTTP direto é bloqueado)
app.post("/dje-tjerj", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { oabNumero, date } = req.body ?? {};
  if (!oabNumero) return reply.code(400).send({ error: "oabNumero obrigatorio" });

  const d = date ? new Date(date) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const dataStr = `${dd}/${mm}/${yyyy}`;

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    locale: "pt-BR",
  });
  const page = await ctx.newPage();

  try {
    const url = `https://dje.tjrj.jus.br/consultaAdvogadoAction.do?metodo=pesquisar&numOAB=${oabNumero}&tipoOAB=A&dtInicio=${dataStr}&dtFim=${dataStr}&cadernos=0`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const html = await page.content();
    await ctx.close();
    return reply.send({ html, status: 200 });
  } catch (err) {
    await ctx.close().catch(() => null);
    return reply.code(502).send({ error: err instanceof Error ? err.message : "erro" });
  }
});

async function extractMovimentos(page) {
  return page.evaluate(() => {
    const out = [];
    const trs = document.querySelectorAll("tr");
    trs.forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      if (tds.length >= 2) {
        const dateText = tds[0].textContent?.trim() ?? "";
        const descText = Array.from(tds).slice(1).map((t) => t.textContent?.trim()).filter(Boolean).join(" ");
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateText) && descText) {
          out.push({ data: dateText.slice(0, 10), descricao: descText });
        }
      }
    });
    return out;
  });
}

const start = async () => {
  try {
    schedulePublicacoesDaily();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Justio Scraper rodando na porta ${PORT}`);
    if (PUBLICACOES_DAILY_ENABLED) {
      console.log(`Busca diaria de publicacoes: ${PUBLICACOES_DAILY_HOUR}:00; proxima em ${nextPublicacoesRunAt}`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
