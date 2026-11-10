// Contagem de prazos processuais. Serve de apoio: feriados locais e suspensões
// do tribunal não estão na tabela e precisam ser conferidos.
import { addDays } from "date-fns";
import { iso } from "./format";

function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia, 12);
}

const cache = new Map<number, Map<string, string>>();
export function feriados(ano: number): Map<string, string> {
  let m = cache.get(ano);
  if (m) return m;
  m = new Map();
  const fixo = (mes: number, dia: number, nome: string) => m!.set(iso(new Date(ano, mes - 1, dia, 12)), nome);
  fixo(1, 1, "Confraternização Universal"); fixo(4, 21, "Tiradentes"); fixo(5, 1, "Dia do Trabalho"); fixo(9, 7, "Independência");
  fixo(10, 12, "Nossa Senhora Aparecida"); fixo(11, 2, "Finados"); fixo(11, 15, "Proclamação da República"); fixo(11, 20, "Consciência Negra"); fixo(12, 25, "Natal");
  fixo(8, 11, "Dia do Advogado (feriado forense)"); fixo(10, 28, "Dia do Servidor Público (feriado forense)"); fixo(12, 8, "Dia da Justiça (feriado forense)");
  const p = pascoa(ano);
  m.set(iso(addDays(p, -48)), "Carnaval (segunda)"); m.set(iso(addDays(p, -47)), "Carnaval (terça)"); m.set(iso(addDays(p, -46)), "Quarta-feira de Cinzas");
  m.set(iso(addDays(p, -3)), "Quinta-feira Santa (Justiça Federal e do Trabalho)"); m.set(iso(addDays(p, -2)), "Sexta-feira Santa"); m.set(iso(addDays(p, 60)), "Corpus Christi");
  cache.set(ano, m);
  return m;
}

/** Recesso de 20 de dezembro a 20 de janeiro (CPC, art. 220; CPP, art. 798-A). */
export function noRecesso(d: Date): boolean {
  const mes = d.getMonth() + 1, dia = d.getDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}
export function diaUtil(d: Date, comRecesso: boolean): boolean {
  const s = d.getDay();
  if (s === 0 || s === 6) return false;
  if (feriados(d.getFullYear()).has(iso(d))) return false;
  if (comRecesso && noRecesso(d)) return false;
  return true;
}
const proximoUtil = (d: Date, rec: boolean) => { let x = d; while (!diaUtil(x, rec)) x = addDays(x, 1); return x; };

export interface Contagem { publicacao: string; inicio: string; vencimento: string; pulados: { dia: string; motivo: string }[] }

/**
 * @param base data da disponibilização no diário eletrônico (ou da intimação pessoal)
 * @param diario se true, considera publicado no primeiro dia útil seguinte à disponibilização (Lei 11.419/06, art. 4º, § 3º)
 * @param uteis dias úteis (CPC, art. 219) ou corridos (CPP, art. 798)
 */
export function contarPrazo(base: string, dias: number, uteis: boolean, diario: boolean, recesso: boolean): Contagem {
  const d0 = new Date(`${base}T12:00:00`);
  const publicacao = diario ? proximoUtil(addDays(d0, 1), recesso) : d0;
  // o dia do começo é excluído; a contagem começa no primeiro dia útil seguinte
  let dia = proximoUtil(addDays(publicacao, 1), recesso);
  const inicio = dia;
  const pulados: Contagem["pulados"] = [];
  let contados = 1;
  while (contados < dias) {
    dia = addDays(dia, 1);
    if (uteis) {
      if (diaUtil(dia, recesso)) contados++;
      else pulados.push({ dia: iso(dia), motivo: motivo(dia, recesso) });
    } else if (recesso && noRecesso(dia)) {
      pulados.push({ dia: iso(dia), motivo: "Recesso forense" });
    } else contados++;
  }
  // vencimento em dia sem expediente passa para o próximo dia útil
  while (!diaUtil(dia, recesso)) { pulados.push({ dia: iso(dia), motivo: motivo(dia, recesso) }); dia = addDays(dia, 1); }
  return { publicacao: iso(publicacao), inicio: iso(inicio), vencimento: iso(dia), pulados };
}
function motivo(d: Date, rec: boolean) {
  const f = feriados(d.getFullYear()).get(iso(d));
  if (f) return f;
  if (rec && noRecesso(d)) return "Recesso forense";
  return d.getDay() === 6 ? "Sábado" : "Domingo";
}

/** Lê "15 dias úteis" ou "5 dias" de um texto. */
export function lerPrazo(texto?: string): { dias: number; uteis: boolean } | null {
  const m = texto?.match(/(\d+)\s*dias?(\s+úteis)?/i);
  return m ? { dias: Number(m[1]), uteis: !!m[2] } : null;
}
