import Fastify from "fastify";
import { chromium } from "playwright";

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";

const app = Fastify({ logger: true });

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
    console.log(`Lexfy Scraper rodando na porta ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
