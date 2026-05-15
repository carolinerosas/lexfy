// Maps tribunal DataJud slug to the primary system used for public consultation

export type SistemaJudicial = "datajud" | "pje" | "eproc";

// TJs that primarily use PJe for new cases (sigla = DataJud slug = PJe subdomain)
const PJE_TJS = new Set([
  "tjac", "tjal", "tjap", "tjam", "tjba", "tjce", "tjdft",
  "tjgo", "tjma", "tjmg", "tjms", "tjmt", "tjpa", "tjpb",
  "tjpe", "tjpi", "tjpr", "tjrj", "tjrn", "tjro", "tjrr",
  "tjrs", "tjsc", "tjse", "tjsp", "tjto",
]);

// TRFs that use EPROC (TRF3 uses PJe, others use EPROC)
const EPROC_TRFS = new Set(["trf1", "trf2", "trf4", "trf5", "trf6"]);
const PJE_TRFS = new Set(["trf3"]);

// State courts using EPROC
const EPROC_TJS = new Set(["tjes"]);

export function getSistema(tribunal: string): SistemaJudicial {
  if (EPROC_TJS.has(tribunal)) return "eproc";
  if (PJE_TJS.has(tribunal)) return "pje";
  if (EPROC_TRFS.has(tribunal)) return "eproc";
  if (PJE_TRFS.has(tribunal)) return "pje";
  return "datajud"; // STJ, STF, TRTs
}

async function buscarNoDataJudComoFonte(
  tribunal: string,
  numero: string
): Promise<{ data: string; descricao: string; fonte: string }[]> {
  const { buscarNoDataJud } = await import("./datajud");
  const resultado = await buscarNoDataJud(numero);
  return resultado.movimentos.map((m) => {
    const complemento = m.complementos?.length ? ` — ${m.complementos.join(", ")}` : "";
    return {
      data: m.dataHora,
      descricao: `${m.nome}${complemento}`,
      fonte: `DataJud/${tribunal.toUpperCase()}`,
    };
  });
}

async function buscarPjeRJ(numero: string): Promise<{ data: string; descricao: string; fonte: string }[] | null> {
  // 1ª opção: scraper externo com Playwright (NEXT_PUBLIC_SCRAPER_URL configurado)
  const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_URL;
  if (scraperUrl) {
    try {
      console.log("[PJe-RJ via scraper Playwright]", numero);
      const res = await fetch(`${scraperUrl.replace(/\/$/, "")}/pje-rj`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.NEXT_PUBLIC_SCRAPER_KEY ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SCRAPER_KEY}` } : {}),
        },
        body: JSON.stringify({ numero }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.debug) console.log("[Scraper debug]", JSON.stringify(data.debug, null, 2));
      if (res.ok && Array.isArray(data.movimentos) && data.movimentos.length > 0) {
        return data.movimentos.map((m: { data: string; descricao: string }) => ({
          ...m,
          fonte: "PJe-RJ",
        }));
      }
    } catch (err) {
      console.log("[Scraper erro]", err);
    }
  }

  // 2ª opção: fallback pra rota interna (tentativa de scraping serverless)
  try {
    const res = await fetch("/api/pje-rj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.debug) console.log("[PJe-RJ interno]", JSON.stringify(data.debug, null, 2));
    if (!res.ok) return null;
    const movs = (data.movimentos ?? []).map((m: { data: string; descricao: string }) => ({
      ...m,
      fonte: "PJe-RJ",
    }));
    return movs.length > 0 ? movs : null;
  } catch {
    return null;
  }
}

async function buscarTJRJDireto(numero: string): Promise<{ data: string; descricao: string; fonte: string }[] | null> {
  try {
    const res = await fetch("/api/tjrj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.debug) {
      console.log("[TJRJ debug]", JSON.stringify(data.debug, null, 2));
    }
    if (!res.ok) return null;
    const movs = (data.movimentos ?? []).map((m: { data: string; descricao: string }) => ({
      ...m,
      fonte: "TJRJ",
    }));
    return movs.length > 0 ? movs : null;
  } catch (err) {
    console.log("[TJRJ fetch erro]", err);
    return null;
  }
}

export async function buscarMovimentosSistema(
  tribunal: string,
  numero: string
): Promise<{ data: string; descricao: string; fonte: string }[]> {
  const sistema = getSistema(tribunal);

  // TJRJ: tenta PJe-RJ (consulta pública) primeiro, depois www3.tjrj
  if (tribunal === "tjrj") {
    const pjerj = await buscarPjeRJ(numero);
    if (pjerj) return pjerj;
    const tjrj = await buscarTJRJDireto(numero);
    if (tjrj) return tjrj;
  }

  if (sistema === "pje") {
    try {
      const res = await fetch("/api/pje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sigla: tribunal, numero }),
      });
      if (res.ok) {
        const data = await res.json();
        const movs = (data.movimentos ?? []).map((m: { data: string; descricao: string }) => ({
          ...m,
          fonte: `PJe/${tribunal.toUpperCase()}`,
        }));
        if (movs.length > 0) return movs;
      }
    } catch {
      // cai no fallback
    }
    // Fallback: DataJud
    return buscarNoDataJudComoFonte(tribunal, numero);
  }

  if (sistema === "eproc") {
    try {
      const res = await fetch("/api/eproc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tribunal, numero }),
      });
      if (res.ok) {
        const data = await res.json();
        const movs = (data.movimentos ?? []).map((m: { data: string; descricao: string }) => ({
          ...m,
          fonte: `EPROC/${tribunal.toUpperCase()}`,
        }));
        if (movs.length > 0) return movs;
      }
    } catch {
      // cai no fallback
    }
    // Fallback: DataJud
    return buscarNoDataJudComoFonte(tribunal, numero);
  }

  // Padrão: DataJud
  return buscarNoDataJudComoFonte(tribunal, numero);
}
