import { supabase } from "@/lib/supabase";
import type { Prazo, Audiencia, Processo } from "@/types";

export const dynamic = "force-dynamic";

function escapar(txt: string): string {
  return txt
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// data/hora em UTC no formato básico iCal: 20260607T184530Z
function carimboUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// Interpreta uma string de data/hora.
// - só data (YYYY-MM-DD) → dia inteiro
// - data+hora sem fuso → assume America/Sao_Paulo (UTC-3, sem horário de verão)
// - com Z ou offset → usa como está
function interpretar(valor: string): { diaInteiro: boolean; inicio: Date } {
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  if (soData) {
    return { diaInteiro: true, inicio: new Date(`${valor}T12:00:00Z`) };
  }
  const temFuso = /Z$|[+-]\d{2}:?\d{2}$/.test(valor);
  const iso = valor.includes("T") ? valor : valor.replace(" ", "T");
  const comFuso = temFuso ? iso : `${iso}-03:00`;
  return { diaInteiro: false, inicio: new Date(comFuso) };
}

function dataBasica(d: Date): string {
  // usa a parte de data em UTC (já normalizada com meio-dia para evitar virada)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function veventDiaInteiro(uid: string, agora: string, data: Date, summary: string, descricao: string, categoria: string, location?: string): string[] {
  const inicio = dataBasica(data);
  const prox = new Date(data.getTime());
  prox.setUTCDate(prox.getUTCDate() + 1);
  const linhas = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${agora}`,
    `DTSTART;VALUE=DATE:${inicio}`,
    `DTEND;VALUE=DATE:${dataBasica(prox)}`,
    `SUMMARY:${escapar(summary)}`,
  ];
  if (descricao) linhas.push(`DESCRIPTION:${escapar(descricao)}`);
  if (location) linhas.push(`LOCATION:${escapar(location)}`);
  linhas.push(`CATEGORIES:${escapar(categoria)}`, "END:VEVENT");
  return linhas;
}

function veventComHora(uid: string, agora: string, inicio: Date, summary: string, descricao: string, categoria: string, location?: string): string[] {
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
  const linhas = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${agora}`,
    `DTSTART:${carimboUtc(inicio)}`,
    `DTEND:${carimboUtc(fim)}`,
    `SUMMARY:${escapar(summary)}`,
  ];
  if (descricao) linhas.push(`DESCRIPTION:${escapar(descricao)}`);
  if (location) linhas.push(`LOCATION:${escapar(location)}`);
  linhas.push(`CATEGORIES:${escapar(categoria)}`, "END:VEVENT");
  return linhas;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const esperado = process.env.CALENDAR_TOKEN;
  if (!esperado || token !== esperado) {
    return new Response("Not found", { status: 404 });
  }

  const [{ data: prazosData }, { data: audienciasData }, { data: processosData }] = await Promise.all([
    supabase.from("prazos").select("*"),
    supabase.from("audiencias").select("*"),
    supabase.from("processos").select("id, numero, titulo, cliente_nome"),
  ]);

  const prazos = (prazosData ?? []) as Prazo[];
  const audiencias = (audienciasData ?? []) as Audiencia[];
  const procs = new Map<string, Pick<Processo, "numero" | "titulo" | "cliente_nome">>();
  for (const p of (processosData ?? []) as Processo[]) {
    procs.set(p.id, { numero: p.numero, titulo: p.titulo, cliente_nome: p.cliente_nome });
  }

  const agora = carimboUtc(new Date());
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Justio//Escritorio//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Escritório — Justio",
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];

  for (const p of prazos) {
    if (!p?.data_prazo || !p?.titulo) continue;
    const proc = p.processo_id ? procs.get(p.processo_id) : undefined;
    const cliente = proc?.cliente_nome;
    const summary = `⚖️ Prazo: ${p.titulo}${cliente ? ` — ${cliente}` : ""}${p.concluido ? " ✓" : ""}`;
    const desc = [
      proc?.numero ? `Processo ${proc.numero}` : "",
      cliente ? `Cliente: ${cliente}` : "",
      p.tipo ? `Tipo: ${p.tipo}` : "",
      p.prioridade ? `Prioridade: ${p.prioridade}` : "",
      p.descricao ?? "",
      p.concluido ? "✓ Concluído" : "",
    ].filter(Boolean).join("\n");
    const { inicio } = interpretar(p.data_prazo);
    linhas.push(...veventDiaInteiro(`prazo-${p.id}@justio`, agora, inicio, summary, desc, "Prazo"));
  }

  for (const a of audiencias) {
    if (!a?.data_hora || !a?.titulo) continue;
    const proc = a.processo_id ? procs.get(a.processo_id) : undefined;
    const cliente = proc?.cliente_nome;
    const summary = `🏛️ Audiência: ${a.titulo}${cliente ? ` — ${cliente}` : ""}${a.realizada ? " ✓" : ""}`;
    const desc = [
      proc?.numero ? `Processo ${proc.numero}` : "",
      cliente ? `Cliente: ${cliente}` : "",
      a.tipo ? `Tipo: ${a.tipo}` : "",
      a.observacoes ?? "",
      a.realizada ? "✓ Realizada" : "",
    ].filter(Boolean).join("\n");
    const { diaInteiro, inicio } = interpretar(a.data_hora);
    if (diaInteiro) {
      linhas.push(...veventDiaInteiro(`aud-${a.id}@justio`, agora, inicio, summary, desc, "Audiência", a.local));
    } else {
      linhas.push(...veventComHora(`aud-${a.id}@justio`, agora, inicio, summary, desc, "Audiência", a.local));
    }
  }

  linhas.push("END:VCALENDAR");
  const corpo = linhas.join("\r\n") + "\r\n";

  return new Response(corpo, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="escritorio.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
