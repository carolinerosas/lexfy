// CNJ number format: NNNNNNN-DD.AAAA.J.TT.OOOO
// J = segment, TT = tribunal code

const TRIBUNAL_MAP: Record<string, string> = {
  // Segment 8 — Estadual
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam",
  "8.05": "tjba", "8.06": "tjce", "8.07": "tjdft","8.08": "tjes",
  "8.09": "tjgo", "8.10": "tjma", "8.11": "tjmt", "8.12": "tjms",
  "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb", "8.16": "tjpr",
  "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc",
  "8.25": "tjse", "8.26": "tjsp", "8.27": "tjto",
  // Segment 4 — Federal (TRF)
  "4.01": "trf1", "4.02": "trf2", "4.03": "trf3",
  "4.04": "trf4", "4.05": "trf5", "4.06": "trf6",
  // Segment 5 — Trabalhista (TRT)
  "5.01": "trt1",  "5.02": "trt2",  "5.03": "trt3",  "5.04": "trt4",
  "5.05": "trt5",  "5.06": "trt6",  "5.07": "trt7",  "5.08": "trt8",
  "5.09": "trt9",  "5.10": "trt10", "5.11": "trt11", "5.12": "trt12",
  "5.13": "trt13", "5.14": "trt14", "5.15": "trt15", "5.16": "trt16",
  "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
  "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
  // STJ
  "3.00": "stj",
  // STF
  "1.00": "stf",
};

export function formatarCNJ(numero: string): string | null {
  const digits = numero.replace(/\D/g, "");
  if (digits.length !== 20) return null;

  return [
    digits.slice(0, 7),
    "-",
    digits.slice(7, 9),
    ".",
    digits.slice(9, 13),
    ".",
    digits.slice(13, 14),
    ".",
    digits.slice(14, 16),
    ".",
    digits.slice(16, 20),
  ].join("");
}

export function normalizarCNJ(numero: string): string {
  return formatarCNJ(numero) ?? numero.replace(/\s/g, "");
}

export function parseCNJ(numero: string): { tribunal: string | null; numeroLimpo: string } {
  const limpo = normalizarCNJ(numero);
  const match = limpo.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
  if (!match) return { tribunal: null, numeroLimpo: limpo };
  const [, , , , segment, tt] = match;
  const key = `${segment}.${tt}`;
  return { tribunal: TRIBUNAL_MAP[key] ?? null, numeroLimpo: limpo };
}

export function ufFromTribunalDataJud(tribunal: string | null | undefined): string {
  if (!tribunal) return "";
  const slug = tribunal.toLowerCase();
  if (slug === "tjdft") return "DF";
  if (slug.startsWith("tj") && slug.length === 4) return slug.slice(2).toUpperCase();
  return "";
}

export interface DataJudMovimento {
  codigo: number;
  nome: string;
  dataHora: string;
  complementos?: string[];
  complementosTabelados?: { descricao: string }[];
}

export interface DataJudResult {
  movimentos: DataJudMovimento[];
  classe?: string;
  tribunal?: string;
  dataAjuizamento?: string;
  orgaoJulgador?: string;
  grau?: string;
  assuntos?: string[];
  sistema?: string;
}

export type DataJudErro =
  | "numero_invalido"
  | "tribunal_nao_suportado"
  | "nao_encontrado"
  | "api_erro";

export class DataJudError extends Error {
  constructor(public code: DataJudErro, message: string) {
    super(message);
  }
}

export async function buscarNoDataJud(numero: string): Promise<DataJudResult> {
  const { tribunal, numeroLimpo } = parseCNJ(numero);

  if (!numeroLimpo.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/)) {
    throw new DataJudError("numero_invalido", "Formato CNJ inválido (esperado: 0000000-00.0000.0.00.0000)");
  }
  if (!tribunal) {
    throw new DataJudError("tribunal_nao_suportado", "Tribunal não suportado pelo DataJud");
  }

  const apiKey = localStorage.getItem("justio_datajud_apikey") ?? localStorage.getItem("lexfy_datajud_apikey") ?? "";

  const res = await fetch("/api/datajud", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tribunal, numero: numeroLimpo, apiKey }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new DataJudError("api_erro", body.error ?? `Erro ${res.status} na API DataJud`);
  }

  const data = await res.json();
  const hit = data?.hits?.hits?.[0]?._source;
  if (!hit) {
    throw new DataJudError("nao_encontrado", "Processo não encontrado no DataJud (pode ainda não estar indexado)");
  }

  // Valida que o numeroProcesso retornado bate com o que pedimos
  const numeroRetornado = (hit.numeroProcesso ?? "").replace(/\D/g, "");
  const numeroPedido = numeroLimpo.replace(/\D/g, "");
  if (numeroRetornado && numeroPedido && numeroRetornado !== numeroPedido) {
    throw new DataJudError("nao_encontrado", "Processo não encontrado no DataJud (pode ainda não estar indexado)");
  }

  return {
    movimentos: (hit.movimentos ?? []).map((m: DataJudMovimento) => ({
      codigo: m.codigo,
      nome: m.nome,
      dataHora: m.dataHora,
      complementos: m.complementosTabelados
        ? m.complementosTabelados.map((c: { descricao: string }) => c.descricao)
        : [],
    })),
    classe: hit.classe?.nome,
    tribunal: hit.tribunal?.toString(),
    dataAjuizamento: hit.dataAjuizamento,
    orgaoJulgador: hit.orgaoJulgador?.nome,
    grau: hit.grau,
    assuntos: (hit.assuntos ?? []).map((a: { nome: string }) => a.nome),
    sistema: hit.sistema?.nome,
  };
}
