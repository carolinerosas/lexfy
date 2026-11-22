// Cálculo de pena na execução penal: crime por crime, com frações próprias,
// remição, detração e períodos em que a pena não correu (interrupção ou suspensão).
// É uma estimativa de trabalho: o cálculo oficial é o homologado pelo juízo.
import { addDays, addMonths, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Caso, CrimeExec, DadosExecucao, Interrupcao } from "./types";

export const EXEC_VAZIA: DadosExecucao = { crimes: [], remicoes: [], interrupcoes: [] };
export const NATUREZAS = ["Comum sem violência", "Comum com violência ou grave ameaça", "Hediondo ou equiparado", "Hediondo com resultado morte"];
export const CONDICOES = ["Primário", "Reincidente", "Reincidente específico"];
export const MOTIVOS_REMICAO = ["Trabalho", "Estudo", "Leitura", "Atividade esportiva ou cultural", "Remição ficta"];
export const MOTIVOS_INTERRUPCAO = ["Fuga ou evasão", "Não retorno da saída temporária", "Descumprimento no regime aberto", "Suspensão por doença mental (art. 41 do CP)", "Suspensão condicional", "Outro"];
/** Lei 13.964/2019 (Pacote Anticrime) entrou em vigor em 23/01/2020. */
const ANTICRIME = "2020-01-23";
/** Lei 11.464/2007 (frações de 2/5 e 3/5 para hediondos) entrou em vigor em 29/03/2007. */
const LEI_11464 = "2007-03-29";

const dt = (s: string) => parseISO(`${s.slice(0, 10)}T12:00:00`);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const hoje = () => iso(new Date());
const entre = (a: string, b: string) => differenceInCalendarDays(dt(b), dt(a));

/** Pena em dias, contada no calendário a partir de uma data. */
export function penaEmDias(c: Pick<CrimeExec, "anos" | "meses" | "dias">, desde: string): number {
  const fim = addDays(addMonths(addYears(dt(desde), c.anos || 0), c.meses || 0), c.dias || 0);
  return differenceInCalendarDays(fim, dt(desde));
}

export const penaTexto = (c: Pick<CrimeExec, "anos" | "meses" | "dias">) =>
  [c.anos ? `${c.anos} ${c.anos === 1 ? "ano" : "anos"}` : "", c.meses ? `${c.meses} ${c.meses === 1 ? "mês" : "meses"}` : "", c.dias ? `${c.dias} ${c.dias === 1 ? "dia" : "dias"}` : ""].filter(Boolean).join(", ") || "sem pena informada";

/** Dias em anos, meses e dias (aproximado: ano de 365 e mês de 30 dias). */
export function diasTexto(n: number): string {
  const neg = n < 0; let r = Math.abs(Math.round(n));
  const a = Math.floor(r / 365); r -= a * 365;
  const m = Math.floor(r / 30); r -= m * 30;
  const t = [a ? `${a}a` : "", m ? `${m}m` : "", r || (!a && !m) ? `${r}d` : ""].filter(Boolean).join(" ");
  return neg ? `−${t}` : t;
}

/** "25%", "2/5", "0,4" → fração. "vedado" ou vazio → null. */
export function lerFracao(f?: string): number | null {
  const t = String(f ?? "").trim().toLowerCase().replace(",", ".");
  if (!t || /vedad|não cabe|nao cabe/.test(t)) return null;
  const pct = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pct) return Number(pct[1]) / 100;
  const fr = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fr && Number(fr[2])) return Number(fr[1]) / Number(fr[2]);
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
}
export const vedado = (f?: string) => /vedad/i.test(String(f ?? ""));

const ehHediondo = (n?: string) => /hediond|equiparad|tr[áa]fico/i.test(String(n ?? ""));
const comMorte = (n?: string) => /morte/i.test(String(n ?? ""));
const comViolencia = (n?: string) => /com viol|grave amea/i.test(String(n ?? ""));
const reincidente = (c?: string) => /reincid/i.test(String(c ?? ""));
const especifico = (c?: string) => /espec/i.test(String(c ?? ""));

/** Fração de progressão sugerida (LEP, art. 112), conforme a data do fato. */
export function sugerirFracaoProg(c: Pick<CrimeExec, "natureza" | "condicao" | "data_fato">): string {
  const antes = c.data_fato && c.data_fato < ANTICRIME;
  if (ehHediondo(c.natureza)) {
    if (antes) return c.data_fato! < LEI_11464 ? "1/6" : reincidente(c.condicao) ? "3/5" : "2/5";
    if (comMorte(c.natureza)) return especifico(c.condicao) ? "70%" : "50%";
    return especifico(c.condicao) ? "60%" : "40%";
  }
  if (antes) return "1/6";
  if (comViolencia(c.natureza)) return reincidente(c.condicao) ? "30%" : "25%";
  return reincidente(c.condicao) ? "20%" : "16%";
}

/** Fração de livramento condicional sugerida (CP, art. 83; LEP, art. 112, VI, a, e VIII). */
export function sugerirFracaoLC(c: Pick<CrimeExec, "natureza" | "condicao" | "data_fato">): string {
  if (ehHediondo(c.natureza)) {
    if (especifico(c.condicao)) return "vedado";
    if (comMorte(c.natureza) && !(c.data_fato && c.data_fato < ANTICRIME)) return "vedado";
    return "2/3";
  }
  return reincidente(c.condicao) ? "1/2" : "1/3";
}

/** Dias de um período que caem dentro de [de, ate). Período aberto vai até hoje. */
function sobreposicao(p: Interrupcao, de: string, ate: string): number {
  const ini = p.inicio > de ? p.inicio : de;
  const fimP = p.fim || hoje();
  const fim = fimP < ate ? fimP : ate;
  return Math.max(0, entre(ini, fim));
}

export interface Calculo {
  ok: boolean; falta?: string;
  inicio: string; totalDias: number; detracao: number; remidos: number; remidosPendentes: number;
  interrompidos: number; cumpridos: number; restante: number; pctCumprido: number; termino: string;
  porCrime: { crime: CrimeExec; dias: number; fProg: number | null; fLc: number | null; vedadoLc: boolean }[];
  progressao?: { base: string; fracao: number; requisito: number; data: string; semFracao: string[] };
  livramento?: { base: string; fracao: number; requisito: number; data: string; vedados: string[] };
}

/** Calcula a pena cumprida, o que falta e as datas previstas de progressão, livramento e término. */
export function calcular(caso: Caso, ref = hoje()): Calculo {
  const ex = caso.execucao ?? EXEC_VAZIA;
  const d = caso.dados;
  const inicio = String(d.inicio_cumprimento || d.data_base || "");
  const detracao = Number(d.detracao) || 0;
  const vazio: Calculo = { ok: false, inicio, totalDias: 0, detracao, remidos: 0, remidosPendentes: 0, interrompidos: 0, cumpridos: 0, restante: 0, pctCumprido: 0, termino: "", porCrime: [] };
  if (!ex.crimes.length) return { ...vazio, falta: "Cadastre os crimes da execução com a pena de cada um." };
  if (!inicio) return { ...vazio, falta: "Informe o início do cumprimento (data da prisão) em Datas da execução." };

  // Detração conta como pena já cumprida antes do início: o relógio começa "detracao" dias antes.
  const zero = iso(addDays(dt(inicio), -detracao));
  const porCrime = ex.crimes.map((c) => {
    const fP = lerFracao(c.fracao_prog || sugerirFracaoProg(c));
    const lc = c.fracao_lc || sugerirFracaoLC(c);
    return { crime: c, dias: penaEmDias(c, zero), fProg: fP, fLc: lerFracao(lc), vedadoLc: vedado(lc) };
  });
  const totalDias = porCrime.reduce((s, x) => s + x.dias, 0);
  const remidos = ex.remicoes.reduce((s, r) => s + (Number(r.dias) || 0), 0);
  const remidosPendentes = ex.remicoes.filter((r) => !r.homologada).reduce((s, r) => s + (Number(r.dias) || 0), 0);
  const remidosAte = (data: string) => ex.remicoes.filter((r) => r.data && r.data < data).reduce((s, r) => s + (Number(r.dias) || 0), 0);
  const interrAte = (de: string, ate: string) => ex.interrupcoes.reduce((s, p) => s + sobreposicao(p, de, ate), 0);

  const interrompidos = interrAte(zero, ref);
  const cumpridos = Math.max(0, entre(zero, ref) - interrompidos + remidos);
  const restante = Math.max(0, totalDias - cumpridos);
  // Término: total a partir do zero, menos remição, mais os dias em que a pena não correu.
  const interrTotal = ex.interrupcoes.reduce((s, p) => s + sobreposicao(p, zero, "9999-12-31"), 0);
  const termino = iso(addDays(dt(zero), totalDias - remidos + interrTotal));

  /** Data em que se completa "fracao" do que restava na data-base. */
  function prevista(baseInformada: string, fracao: number, diasBase: number) {
    const base = !baseInformada || baseInformada <= inicio ? zero : baseInformada;
    const cumpridoNaBase = Math.max(0, entre(zero, base) - interrAte(zero, base) + remidosAte(base));
    const restanteNaBase = Math.max(0, diasBase - cumpridoNaBase * (diasBase / (totalDias || 1)));
    const requisito = Math.ceil(fracao * restanteNaBase);
    const remDepois = remidos - remidosAte(base);
    let data = iso(addDays(dt(base), requisito - remDepois));
    // os dias de interrupção depois da data-base empurram a data
    const extra = interrAte(base, data);
    if (extra) data = iso(addDays(dt(data), extra + interrAte(data, iso(addDays(dt(data), extra)))));
    return { base: baseInformada || inicio, requisito, data };
  }

  const comProg = porCrime.filter((x) => x.fProg !== null);
  const semFracao = porCrime.filter((x) => x.fProg === null).map((x) => x.crime.crime);
  const diasProg = comProg.reduce((s, x) => s + x.dias, 0);
  const fracaoProg = diasProg ? comProg.reduce((s, x) => s + x.fProg! * x.dias, 0) / diasProg : 0;
  const progressao = diasProg ? { ...prevista(String(d.data_base || ""), fracaoProg, totalDias), fracao: fracaoProg, semFracao } : undefined;

  const comLc = porCrime.filter((x) => x.fLc !== null);
  const vedados = porCrime.filter((x) => x.vedadoLc).map((x) => x.crime.crime);
  const diasLc = comLc.reduce((s, x) => s + x.dias, 0);
  const fracaoLc = diasLc ? comLc.reduce((s, x) => s + x.fLc! * x.dias, 0) / diasLc : 0;
  const livramento = diasLc ? { ...prevista(String(d.data_base_lc || ""), fracaoLc, totalDias), fracao: fracaoLc, vedados } : undefined;

  return {
    ok: true, inicio, totalDias, detracao, remidos, remidosPendentes, interrompidos, cumpridos, restante,
    pctCumprido: totalDias ? Math.min(100, (cumpridos / totalDias) * 100) : 0, termino, porCrime, progressao, livramento,
  };
}

export const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dataBR = (s?: string) => (s ? format(dt(s), "dd/MM/yyyy") : "-");

/** Linhas de texto da execução, para o resumo do caso. */
export function resumoExecucao(caso: Caso): string[] {
  const ex = caso.execucao ?? EXEC_VAZIA;
  const l: string[] = [];
  if (ex.crimes.length) {
    l.push("CRIMES DA EXECUÇÃO");
    ex.crimes.forEach((c) => l.push(`${c.crime}${c.processo ? ` (proc. ${c.processo})` : ""}: ${penaTexto(c)}; ${[c.natureza, c.condicao].filter(Boolean).join(", ")}; progressão ${c.fracao_prog || sugerirFracaoProg(c)}; livramento ${c.fracao_lc || sugerirFracaoLC(c)}`));
  }
  const k = calcular(caso);
  if (k.ok) {
    l.push("", "CÁLCULO (estimativa)", `Pena total: ${diasTexto(k.totalDias)} (${k.totalDias} dias)`, `Cumprida: ${diasTexto(k.cumpridos)} (${k.cumpridos} dias, com ${k.remidos} remidos e ${k.detracao} de detração)`, `Restante: ${diasTexto(k.restante)}`);
    if (k.progressao) l.push(`Progressão prevista: ${dataBR(k.progressao.data)} (data-base ${dataBR(k.progressao.base)})`);
    if (k.livramento) l.push(`Livramento previsto: ${dataBR(k.livramento.data)} (data-base ${dataBR(k.livramento.base)})`);
    l.push(`Término previsto: ${dataBR(k.termino)}`);
  }
  return l;
}
