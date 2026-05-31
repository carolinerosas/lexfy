import Fastify from "fastify";
import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.JUSTIO_SYNC_PORT || 4477);
const API_KEY = process.env.JUSTIO_SYNC_KEY || "";
const PROFILE_DIR = process.env.JUSTIO_SYNC_PROFILE_DIR ||
  path.join(os.homedir(), ".justio-sync", "chrome-profile");

const ALLOWED_ORIGINS = new Set([
  "https://www.justio.com.br",
  "https://app.justio.com.br",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3020",
]);

const app = Fastify({ logger: true });

let browserContextPromise = null;
let ephemeralPin = { value: "", expiresAt: 0 };

function isAllowedOrigin(origin = "") {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

app.addHook("onSend", (req, reply, payload, done) => {
  const origin = req.headers.origin ?? "";
  if (isAllowedOrigin(origin)) {
    reply.header("Access-Control-Allow-Origin", origin || "*");
  }
  reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-justio-sync-key");
  reply.header("Access-Control-Allow-Private-Network", "true");
  done();
});

app.options("*", async (req, reply) => {
  const origin = req.headers.origin ?? "";
  if (isAllowedOrigin(origin)) {
    reply.header("Access-Control-Allow-Origin", origin || "*");
  }
  reply.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-justio-sync-key");
  reply.header("Access-Control-Allow-Private-Network", "true");
  reply.code(204).send();
});

function checkAuth(req, reply) {
  if (!API_KEY) return true;
  const auth = req.headers.authorization ?? "";
  const key = req.headers["x-justio-sync-key"] ?? "";
  if (auth === `Bearer ${API_KEY}` || key === API_KEY) return true;
  reply.code(401).send({ error: "unauthorized" });
  return false;
}

function normalizeDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function maskCNJ(numero) {
  const d = String(numero || "").replace(/\D/g, "");
  if (d.length !== 20) return String(numero || "");
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

function parseTjrjMovimentosHtml(html) {
  const movimentos = [];
  const rows = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rows) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 2) continue;
    const data = cells[0].trim();
    const descricao = cells.slice(1).join(" ").trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(data) && descricao) {
      movimentos.push({ data: data.slice(0, 10), descricao });
    }
  }
  return movimentos;
}

function parseTjrjMovimentosJson(arr) {
  return arr.map((raw) => {
    const dataRaw = raw.dataHora ?? raw.data ?? raw.dataMovimentacao ?? "";
    const data = /^\d{4}-\d{2}-\d{2}/.test(dataRaw)
      ? dataRaw.slice(0, 10).split("-").reverse().join("/")
      : dataRaw;
    const complementos = raw.complementosTabelados?.map((c) => c.descricao).filter(Boolean).join(" - ") ?? "";
    const descricao = [raw.descricao, raw.descricaoMovimento, raw.nome, raw.texto, complementos]
      .filter(Boolean)
      .join(" - ");
    return { data, descricao };
  }).filter((m) => m.data && m.descricao);
}

async function getBrowserContext() {
  if (!browserContextPromise) {
    browserContextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
      channel: process.env.JUSTIO_SYNC_CHROME_CHANNEL || "chrome",
      headless: false,
      locale: "pt-BR",
      viewport: { width: 1366, height: 768 },
      args: ["--disable-blink-features=AutomationControlled"],
    }).catch(async () => chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      locale: "pt-BR",
      viewport: { width: 1366, height: 768 },
      args: ["--disable-blink-features=AutomationControlled"],
    }));
  }
  return browserContextPromise;
}

async function openAssistedLogin(url, sistema, numero) {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  return {
    status: "needs_interaction",
    sistema,
    numero,
    url: page.url(),
    message: "Login assistido necessario. Conclua o acesso com certificado na janela do Chrome aberta pelo Justio Sync Local e tente sincronizar novamente.",
  };
}

async function buscarDjen({ nome, oabNumero, oabUF = "RJ", dias = 45 }) {
  const hoje = new Date();
  const inicio = addDays(hoje, -(Number(dias) - 1));
  const filtros = [];
  const numero = String(oabNumero || "").replace(/\D/g, "");
  const uf = String(oabUF || "RJ").trim().toUpperCase();

  if (numero) filtros.push({ numeroOab: numero, ufOab: uf });
  if (nome?.trim()) filtros.push({ nomeAdvogado: nome.trim() });

  const porHash = new Map();

  for (const filtro of filtros) {
    let pagina = 1;
    let totalPaginas = 1;
    do {
      const params = new URLSearchParams({
        pagina: String(pagina),
        itensPorPagina: "100",
        dataDisponibilizacaoInicio: normalizeDateISO(inicio),
        dataDisponibilizacaoFim: normalizeDateISO(hoje),
        ...filtro,
      });
      const res = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params}`);
      if (!res.ok) throw new Error(`DJEN HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items ?? [];
      totalPaginas = Math.max(1, Math.ceil((data.count ?? items.length) / 100));
      for (const item of items) {
        const hash = item.hash ?? String(item.id);
        if (hash && !porHash.has(hash)) porHash.set(hash, item);
      }
      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 10);
  }

  return [...porHash.values()];
}

function mapDjenPublicacao(item) {
  const advogados = (item.destinatarioadvogados ?? [])
    .map((a) => a.advogado ? `${a.advogado.nome} - OAB/${a.advogado.uf_oab} ${a.advogado.numero_oab}` : "")
    .filter(Boolean);
  return {
    id: item.id,
    hash: item.hash,
    numero: item.numeroprocessocommascara ?? maskCNJ(item.numero_processo),
    data: item.data_disponibilizacao,
    sistema: "djen",
    tribunal: item.siglaTribunal,
    tipo: item.tipoComunicacao,
    orgao: item.nomeOrgao,
    classe: item.nomeClasse,
    texto: item.texto,
    advogados,
    url: item.hash ? `https://comunica.pje.jus.br/consulta/comunicacao/${item.hash}/certidao` : undefined,
  };
}

async function syncTjrjPublico(numero) {
  const encoded = encodeURIComponent(numero);
  const metaRes = await fetch(`https://www3.tjrj.jus.br/consultaprocessual/api/processos/${encoded}`, {
    headers: { Accept: "application/json, text/plain, */*", "User-Agent": "Mozilla/5.0" },
  });
  if (!metaRes.ok) return null;

  const metas = await metaRes.json();
  const meta = Array.isArray(metas) ? metas[0] : null;
  if (!meta?.idProcesso) return null;

  const ehPje = meta.classe?.toLowerCase().includes("pje") ||
    meta.urlProcessoExterno?.includes("pje.jus.br") ||
    meta.tipoProcesso === 13;
  if (ehPje) return null;

  const urls = [
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${meta.idProcesso}/movimentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${meta.idProcesso}/movimentacoes`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/${meta.idProcesso}/andamentos`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/movimentos?idProcesso=${meta.idProcesso}`,
    `https://www3.tjrj.jus.br/consultaprocessual/api/processos/movimentacoes?idProcesso=${meta.idProcesso}`,
  ];

  const seen = new Set();
  const movimentos = [];
  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Accept: "application/json, text/plain, */*", "User-Agent": "Mozilla/5.0" },
    }).catch(() => null);
    if (!res?.ok) continue;
    const body = await res.text();
    let movs = [];
    try {
      const json = JSON.parse(body);
      const arr = Array.isArray(json)
        ? json
        : (json.movimentos ?? json.movimentacoes ?? json.andamentos ?? json.data?.movimentos ?? []);
      if (Array.isArray(arr)) movs = parseTjrjMovimentosJson(arr);
    } catch {
      movs = parseTjrjMovimentosHtml(body);
    }
    for (const mov of movs) {
      const key = `${mov.data}|${mov.descricao}`;
      if (!seen.has(key)) {
        seen.add(key);
        movimentos.push({ ...mov, fonte: "DCP/TJRJ" });
      }
    }
  }
  return movimentos.length ? movimentos : null;
}

async function syncProcesso({ numero, sistema, tribunal }) {
  const sys = String(sistema || "").toLowerCase();
  const trib = String(tribunal || "").toLowerCase();

  if (trib === "tjrj" || sys === "dcp") {
    const tjrj = await syncTjrjPublico(numero);
    if (tjrj?.length) return { status: "ok", movimentos: tjrj };
  }

  if (sys === "pje" || trib === "tjrj") {
    return openAssistedLogin("https://tjrj.pje.jus.br/pje/login.seam", "pje", numero);
  }
  if (sys === "eproc" || trib === "trf2") {
    return openAssistedLogin("https://eproc.trf2.jus.br/eproc/", "eproc", numero);
  }
  if (sys === "seeu") {
    return openAssistedLogin("https://seeu.pje.jus.br/seeu/", "seeu", numero);
  }
  if (sys === "esaj" || trib === "tjsp") {
    return openAssistedLogin("https://esaj.tjsp.jus.br/cpopg/open.do", "esaj", numero);
  }

  return {
    status: "unsupported",
    message: "Sistema ainda nao mapeado no agente local.",
  };
}

app.get("/health", async () => ({
  ok: true,
  service: "justio-sync-local",
  profileDir: PROFILE_DIR,
  auth: Boolean(API_KEY),
  pinInMemory: Boolean(ephemeralPin.value && ephemeralPin.expiresAt > Date.now()),
}));

app.post("/session/pin", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { pin, ttlMinutes = 30 } = req.body ?? {};
  if (!pin) return reply.code(400).send({ error: "pin obrigatorio" });
  ephemeralPin = {
    value: String(pin),
    expiresAt: Date.now() + Number(ttlMinutes) * 60_000,
  };
  return { ok: true, expiresAt: new Date(ephemeralPin.expiresAt).toISOString() };
});

app.post("/djen/publicacoes", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const items = await buscarDjen(req.body ?? {});
  return { publicacoes: items.map(mapDjenPublicacao), count: items.length };
});

app.post("/djen/processos", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const items = await buscarDjen(req.body ?? {});
  const processos = new Map();
  for (const item of items) {
    const numero = item.numeroprocessocommascara ?? maskCNJ(item.numero_processo);
    if (!numero) continue;
    if (!processos.has(numero)) {
      processos.set(numero, {
        numero,
        tribunal: item.siglaTribunal,
        sistema: item.siglaTribunal === "TJRJ" ? "pje/dcp" : "desconhecido",
        classe: item.nomeClasse,
        orgao: item.nomeOrgao,
        ultima_publicacao: item.data_disponibilizacao,
        total_publicacoes: 0,
      });
    }
    const proc = processos.get(numero);
    proc.total_publicacoes += 1;
    if (item.data_disponibilizacao > proc.ultima_publicacao) {
      proc.ultima_publicacao = item.data_disponibilizacao;
    }
  }
  return { processos: [...processos.values()], count: processos.size };
});

app.post("/sync/processo", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { numero } = req.body ?? {};
  if (!numero) return reply.code(400).send({ error: "numero obrigatorio" });
  return syncProcesso(req.body);
});

app.post("/browser/open", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { url } = req.body ?? {};
  if (!url) return reply.code(400).send({ error: "url obrigatoria" });
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  return { ok: true, url: page.url() };
});

app.listen({ port: PORT, host: "127.0.0.1" })
  .then(() => {
    console.log(`Justio Sync Local em http://127.0.0.1:${PORT}`);
    console.log(`Perfil Chrome: ${PROFILE_DIR}`);
    if (!API_KEY) console.log("Aviso: JUSTIO_SYNC_KEY nao configurada; aceitando chamadas locais sem chave.");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
