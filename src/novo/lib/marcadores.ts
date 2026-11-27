// Marcadores {{...}} que os modelos do Word recebem a partir do caso: dados do processo,
// todos os campos da ficha da área e o que a advogada já digitou antes para aquele caso.
import { AREAS, areaDe, type Campo } from "./areas";
import { brl, data } from "./format";
import type { Caso } from "./types";

/** Prefixo dos valores digitados na hora de gerar um documento e guardados no caso. */
export const PREFIXO_DOC = "doc_";

const itens = (v: unknown) => String(v ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

export function valorMarcador(c: Campo | undefined, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (!c) return String(v);
  if (c.tipo === "d") return data(String(v));
  if (c.tipo === "v") return brl(Number(v));
  if (c.tipo === "m") return itens(v).join("; ");
  return String(v);
}

/** Marcadores do processo (não dependem da área). */
export const MARCADORES_PROCESSO: [string, string][] = [
  ["processo", "Número do processo"], ["vara", "Vara ou órgão"], ["comarca", "Comarca do processo"], ["uf_processo", "UF do processo"],
  ["parte_contraria", "Parte contrária"], ["titulo_caso", "Título do caso"], ["area", "Área"], ["fase", "Fase atual"],
  ["unidade_prisional", "Unidade prisional (da ficha)"], ["crimes", "Crimes da execução, com a pena de cada um"],
];

/** Todos os valores que o caso oferece aos modelos. */
export function marcadoresDoCaso(caso: Caso): Record<string, string> {
  const area = areaDe(caso.area);
  const campos = new Map(area.secoes.flatMap((s) => s.campos).map((c) => [c.k, c]));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(caso.dados)) {
    if (k.startsWith(PREFIXO_DOC)) out[k.slice(PREFIXO_DOC.length)] = String(v ?? "");
    else if (k !== "tipo_caso") { const t = valorMarcador(campos.get(k), v); if (t) out[k] = t; }
  }
  const crimes = (caso.execucao?.crimes ?? []).map((c) => `${c.crime} (${[c.anos && `${c.anos} anos`, c.meses && `${c.meses} meses`, c.dias && `${c.dias} dias`].filter(Boolean).join(", ") || "pena não informada"})`);
  Object.assign(out, Object.fromEntries(Object.entries({
    processo: caso.numero, vara: caso.orgao, comarca: caso.comarca, uf_processo: caso.uf, parte_contraria: caso.parte_contraria,
    titulo_caso: caso.titulo, area: area.nome, fase: area.fases[caso.fase], unidade_prisional: caso.dados.unidade ? String(caso.dados.unidade) : undefined,
    crimes: crimes.join("; ") || undefined,
  }).filter(([, v]) => v)) as Record<string, string>);
  return out;
}

/** Campos que valem como marcador em cada área (para a lista de marcadores). */
export function marcadoresPorArea(): { area: string; campos: [string, string][] }[] {
  return AREAS.map((a) => ({ area: a.nome, campos: a.secoes.flatMap((s) => s.campos.map((c) => [c.k, c.rotulo] as [string, string])) }));
}

const ROTULOS = new Map<string, string>([...MARCADORES_PROCESSO, ...AREAS.flatMap((a) => a.secoes.flatMap((s) => s.campos.map((c) => [c.k, c.rotulo] as [string, string])))]);
/** Rótulo legível de um marcador da ficha ou do processo (undefined se não for um deles). */
export const rotuloMarcador = (k: string) => ROTULOS.get(k);
