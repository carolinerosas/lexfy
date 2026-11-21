"use client";
// Busca a capa do processo no DataJud (CNJ) pelo número, para completar o cadastro.
import { buscarNoDataJud, parseCNJ, ufFromTribunalDataJud } from "@/lib/datajud";

export interface CapaProcesso {
  numero: string; classe?: string; orgao?: string; comarca?: string; uf?: string;
  assuntos: string[]; distribuido_em?: string; tribunal?: string; sistema?: string;
}

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e", "em", "a", "o"]);
/** "VARA CRIMINAL DA COMARCA DE VOLTA REDONDA" → "Vara Criminal da Comarca de Volta Redonda". */
export function titulo(s?: string): string | undefined {
  if (!s) return undefined;
  if (s !== s.toUpperCase()) return s.trim();
  return s.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ")
    .replace(/\b(\d+)(ª|º|a|o)\b/gi, (_, n, o) => `${n}${/a|ª/i.test(o) ? "ª" : "º"}`).replace(/\bJecrim\b|\bJec\b|\bJef\b|\bVep\b/gi, (x) => x.toUpperCase());
}

/** Comarca a partir do nome do órgão ("... da Comarca de X", "... de X"). */
function comarcaDoOrgao(orgao?: string): string | undefined {
  if (!orgao) return undefined;
  const m = orgao.match(/comarca d[eao]s?\s+(.+)$/i) ?? orgao.match(/\s(?:de|da|do)\s+([^,]+)$/i);
  return m ? titulo(m[1].trim()) : undefined;
}

/** DataJud manda "2023-05-10T00:00:00Z" ou "20230510000000". */
function dataDJ(d?: string): string | undefined {
  if (!d) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const m = d.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

export const numeroCompleto = (n: string) => n.replace(/\D/g, "").length === 20;

export async function buscarCapa(numero: string): Promise<CapaProcesso> {
  const r = await buscarNoDataJud(numero);
  const { tribunal, numeroLimpo } = parseCNJ(numero);
  const orgao = titulo(r.orgaoJulgador);
  return {
    numero: numeroLimpo, classe: titulo(r.classe), orgao, comarca: comarcaDoOrgao(orgao), uf: ufFromTribunalDataJud(tribunal) || undefined,
    assuntos: (r.assuntos ?? []).map((a) => titulo(a)!).filter(Boolean), distribuido_em: dataDJ(r.dataAjuizamento),
    tribunal: tribunal?.toUpperCase(), sistema: r.sistema,
  };
}
