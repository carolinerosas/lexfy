// Leitura de publicações: prazo em dias, ato a praticar, audiência marcada e número CNJ.
// Usado pelo servidor (prazo automático ao salvar publicação) e pelas telas do novo Justio.
// É apoio: a contagem não conhece feriados locais nem suspensões do tribunal.
import { contarPrazo } from "@/novo/lib/prazo";

const PALAVRAS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, sessenta: 60, noventa: 90,
};
const NUM = `(\\d{1,3}|${Object.keys(PALAVRAS).join("|")})`;
const EXTENSO = `(?:\\s*\\([^)]{0,24}\\))?`;
const UNIDADE = `\\s*dias?(\\s+[úu]teis|\\s+corridos)?`;
const PADROES = [
  new RegExp(`prazo\\s+(?:legal\\s+|comum\\s+|sucessivo\\s+|improrrog[áa]vel\\s+)?de\\s+${NUM}${EXTENSO}${UNIDADE}`, "i"),
  new RegExp(`(?:no prazo de|dentro de|em at[ée]|em)\\s+${NUM}${EXTENSO}${UNIDADE}`, "i"),
  new RegExp(`${NUM}${EXTENSO}\\s*dias?\\s+([úu]teis|corridos)`, "i"),
];

const ATOS: [RegExp, string][] = [
  [/contrarraz/i, "Contrarrazões"],
  [/r[ée]plica/i, "Réplica"],
  [/alega[çc][õo]es finais|memoriais/i, "Alegações finais"],
  [/respo(?:sta|nder) [àa] acusa/i, "Resposta à acusação"],
  [/defesa pr[ée]via/i, "Defesa prévia"],
  [/contesta/i, "Contestação"],
  [/embargos de declara/i, "Embargos de declaração"],
  [/especifica[çc][ãa]o de provas|especific(?:ar|uem) (?:as )?provas/i, "Especificação de provas"],
  [/emenda/i, "Emenda à inicial"],
  [/apela[çc]/i, "Apelação"],
  [/recurso/i, "Recurso"],
  [/quesitos/i, "Quesitos"],
  [/manifest/i, "Manifestação"],
];

export interface PrazoLido { dias: number; uteis: boolean | null; ato: string; trecho: string }

/** Procura no texto um prazo em dias ("no prazo de 15 (quinze) dias úteis", "em 5 dias"). */
export function detectarPrazo(texto?: string | null): PrazoLido | null {
  if (!texto) return null;
  for (const re of PADROES) {
    const m = re.exec(texto);
    if (!m) continue;
    const bruto = m[1].toLowerCase();
    const dias = /^\d+$/.test(bruto) ? Number(bruto) : PALAVRAS[bruto];
    if (!dias || dias < 1 || dias > 90) continue;
    const unidade = (m[2] ?? "").trim().toLowerCase();
    const uteis = unidade.startsWith("corr") ? false : unidade ? true : null;
    // o ato costuma estar perto do prazo; se não estiver, vale o primeiro citado no texto
    const perto = texto.slice(Math.max(0, m.index - 220), m.index + m[0].length + 160);
    const ato = ATOS.find(([r]) => r.test(perto))?.[1] ?? ATOS.find(([r]) => r.test(texto))?.[1] ?? "Prazo";
    return { dias, uteis, ato, trecho: m[0].trim() };
  }
  return null;
}

const AREAS_PENAIS = ["criminal", "juri", "execucao_penal", "inquerito_policial", "inquerito", "bo_pm"];
export const ePenal = (tipoOuArea?: string | null) => AREAS_PENAIS.includes(String(tipoOuArea ?? ""));

/**
 * Vencimento a partir da data de disponibilização no diário.
 * Sem unidade no texto: dias úteis no cível (CPC, art. 219) e corridos no penal (CPP, art. 798).
 */
export function vencimentoDaPublicacao(disponibilizacao: string, prazo: PrazoLido, tipoOuArea?: string | null) {
  const uteis = prazo.uteis ?? !ePenal(tipoOuArea);
  return { ...contarPrazo(disponibilizacao.slice(0, 10), prazo.dias, uteis, true, true), uteis };
}

export interface AudienciaLida { data_hora: string; trecho: string }

/** "audiência ... designada para 12/03/2027, às 14h30" → data e hora (horário de Brasília). */
export function detectarAudiencia(texto?: string | null): AudienciaLida | null {
  if (!texto) return null;
  const m = /audi[êe]ncia[^.;]{0,160}?(\d{2})\/(\d{2})\/(\d{4})[^.;\d]{0,40}?(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i.exec(texto);
  if (!m) return null;
  const [, d, mes, a, h, min] = m;
  if (Number(mes) > 12 || Number(d) > 31 || Number(h) > 23) return null;
  return { data_hora: `${a}-${mes}-${d}T${h.padStart(2, "0")}:${min ?? "00"}:00-03:00`, trecho: m[0].trim() };
}

const CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;
export const soDigitos = (s?: string | null) => String(s ?? "").replace(/\D/g, "");

/** Número CNJ formatado (0000000-00.0000.0.00.0000) encontrado no texto. */
export function extrairCNJ(...textos: (string | null | undefined)[]): string | null {
  for (const t of textos) {
    const m = t ? CNJ.exec(t) : null;
    if (!m) continue;
    const x = soDigitos(m[0]);
    return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16)}`;
  }
  return null;
}

/** Área provável a partir da classe processual informada pelo diário. */
export function areaPelaClasse(classe?: string | null, numero?: string | null): string {
  const c = String(classe ?? "").toLowerCase();
  if (/j[úu]ri/.test(c)) return "juri";
  if (/execu[çc][ãa]o penal|execu[çc][ãa]o da pena/.test(c)) return "execucao_penal";
  if (/inqu[ée]rito|medidas protetivas|pedido de pris|cautelar inominada criminal/.test(c)) return "inquerito";
  if (/penal|criminal|crime|habeas|termo circunstanciado|flagrante/.test(c)) return "criminal";
  if (/alimentos|div[óo]rcio|guarda|uni[ãa]o est[áa]vel|fam[íi]lia|paternidade|interdi/.test(c)) return "familia";
  if (/invent[áa]rio|arrolamento|alvar[áa]/.test(c)) return "sucessoes";
  const segmento = soDigitos(numero).slice(13, 14);
  if (segmento === "5" || /trabalh|reclama[çc][ãa]o/.test(c)) return "trabalhista";
  if (segmento === "4" && /previd|benef[íi]cio/.test(c)) return "previdenciario";
  if (/consum/.test(c)) return "consumidor";
  return "civel";
}
