import { format, parseISO, differenceInCalendarDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export const brl = (v?: number | null) =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brlCurto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  : v >= 10_000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
  : brl(v);

const d = (s: string) => parseISO(s.length === 10 ? `${s}T12:00:00` : s);
const seguro = (s: string | undefined, f: string) => {
  if (!s) return "—";
  const x = d(s);
  return isValid(x) ? format(x, f, { locale: ptBR }) : "—";
};
export const data = (s?: string) => seguro(s, "dd/MM/yyyy");
export const dataCurta = (s?: string) => seguro(s, "dd MMM");
export const diaSemana = (s?: string) => seguro(s, "EEE");
export const hora = (s?: string) => seguro(s, "HH:mm");
export const dataLonga = (x: Date) => format(x, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
export const mesAno = (x: Date) => format(x, "MMMM 'de' yyyy", { locale: ptBR });

export const hojeISO = () => format(new Date(), "yyyy-MM-dd");
export const iso = (x: Date) => format(x, "yyyy-MM-dd");
/** Dias de hoje até a data (negativo = já passou). */
export const diasAte = (s: string) => differenceInCalendarDays(d(s), new Date());

export function quando(s: string): string {
  const n = diasAte(s);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n < 0) return `há ${-n} dias`;
  return `em ${n} dias`;
}
export const horas = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
export const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
