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

export async function buscarMovimentosSistema(
  tribunal: string,
  numero: string
): Promise<{ data: string; descricao: string; fonte: string }[]> {
  const sistema = getSistema(tribunal);

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
