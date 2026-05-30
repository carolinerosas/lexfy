import Fastify from "fastify";
import { chromium } from "playwright";

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";

const app = Fastify({ logger: true });

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

// Healthcheck
app.get("/", async () => ({ ok: true, service: "lexfy-scraper" }));

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

// Endpoint DJE-TJERJ — proxy HTTP (Vercel é bloqueado, Railway não)
app.post("/dje-tjerj", async (req, reply) => {
  if (!checkAuth(req, reply)) return;
  const { oabNumero, date } = req.body ?? {};
  if (!oabNumero) return reply.code(400).send({ error: "oabNumero obrigatorio" });

  const d = date ? new Date(date) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const dataStr = `${dd}/${mm}/${yyyy}`;

  const params = new URLSearchParams({
    metodo: "pesquisar",
    numOAB: oabNumero,
    tipoOAB: "A",
    dtInicio: dataStr,
    dtFim: dataStr,
    cadernos: "0",
  });

  try {
    const res = await fetch(`https://dje.tjrj.jus.br/consultaAdvogadoAction.do?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    return reply.send({ html, status: res.status });
  } catch (err) {
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
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Justio Scraper rodando na porta ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
