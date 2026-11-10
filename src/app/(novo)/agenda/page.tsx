"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { useDB } from "@/novo/lib/store";
import { data, hojeISO, hora, iso, mesAno } from "@/novo/lib/format";
import { Cabecalho, Vazio, useMapas } from "@/novo/components/ui";

type Ev = { id: string; dia: string; hora?: string; tipo: "prazo" | "audiência" | "atendimento" | "ausência"; titulo: string; href?: string };
const COR = { prazo: "#c4281c", "audiência": "#0a0a0a", atendimento: "#9a9a9a", "ausência": "#d9a400" } as const;

export default function Agenda() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [sel, setSel] = useState(hojeISO());

  const eventos = useMemo(() => {
    const evs: Ev[] = [
      ...db.prazos.filter((p) => !p.concluido).map((p) => ({ id: p.id, dia: p.data, tipo: "prazo" as const, titulo: `${p.titulo} · ${caso(p.caso_id)?.cliente_nome ?? ""}`, href: `/casos/${p.caso_id}` })),
      ...db.audiencias.map((a) => ({ id: a.id, dia: a.data_hora.slice(0, 10), hora: hora(a.data_hora), tipo: "audiência" as const, titulo: `${a.titulo} · ${caso(a.caso_id)?.cliente_nome ?? ""}`, href: `/casos/${a.caso_id}` })),
      ...db.atendimentos.filter((a) => a.status !== "cancelado").map((a) => ({ id: a.id, dia: a.data_hora.slice(0, 10), hora: hora(a.data_hora), tipo: "atendimento" as const, titulo: `${a.tipo} · ${a.cliente_nome}`, href: "/atendimentos" })),
    ];
    db.ausencias.filter((a) => a.status === "aprovada").forEach((a) => {
      for (let d = new Date(`${a.inicio}T12:00:00`); iso(d) <= a.fim; d = addDays(d, 1)) evs.push({ id: a.id + iso(d), dia: iso(d), tipo: "ausência", titulo: `${pessoa(a.colaborador_id)?.nome.split(" ")[0]}: ${a.tipo}`, href: "/pessoas" });
    });
    const m = new Map<string, Ev[]>();
    evs.forEach((e) => m.set(e.dia, [...(m.get(e.dia) ?? []), e]));
    m.forEach((v) => v.sort((a, b) => (a.hora ?? "00").localeCompare(b.hora ?? "00")));
    return m;
  }, [db.prazos, db.audiencias, db.atendimentos, db.ausencias, caso, pessoa]);

  const dias = useMemo(() => {
    const out: Date[] = [];
    for (let d = startOfWeek(mes, { weekStartsOn: 1 }); d <= endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }); d = addDays(d, 1)) out.push(d);
    return out;
  }, [mes]);
  const hoje = hojeISO();
  const doDia = eventos.get(sel) ?? [];

  return (
    <>
      <Cabecalho titulo="Agenda" sub="Prazos, audiências, atendimentos e ausências da equipe no mesmo calendário.">
        <div className="flex items-center gap-1">
          <button className="btn btn-g btn-icone" aria-label="Mês anterior" onClick={() => setMes(addMonths(mes, -1))}><ChevronLeft /></button>
          <span className="w-[168px] text-center font-semibold first-letter:uppercase">{mesAno(mes)}</span>
          <button className="btn btn-g btn-icone" aria-label="Próximo mês" onClick={() => setMes(addMonths(mes, 1))}><ChevronRight /></button>
          <button className="btn btn-g ml-1" onClick={() => { setMes(startOfMonth(new Date())); setSel(hoje); }}>Hoje</button>
        </div>
      </Cabecalho>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="painel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-porcelana text-center text-[11.5px] font-semibold text-ink-3">{["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <span key={d} className="py-2">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-px bg-line-2">
            {dias.map((d) => {
              const k = iso(d); const evs = eventos.get(k) ?? []; const fora = d.getMonth() !== mes.getMonth();
              return (
                <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k} aria-label={`${data(k)}, ${evs.length} compromissos`}
                  className={`min-h-[68px] p-1.5 text-left align-top transition-colors sm:min-h-[96px] ${sel === k ? "bg-cobalto-f" : fora ? "bg-porcelana" : "bg-surface hover:bg-porcelana"}`}>
                  <span className={`inline-flex size-6 items-center justify-center rounded-full text-[12.5px] font-semibold ${k === hoje ? "bg-cobalto text-white" : fora ? "text-ink-3" : ""}`}>{d.getDate()}</span>
                  <span className="mt-1 hidden space-y-0.5 sm:block">
                    {evs.slice(0, 3).map((e) => <span key={e.id} className="flex items-center gap-1 truncate text-[11.5px] leading-tight"><span className="size-1.5 shrink-0 rounded-full" style={{ background: COR[e.tipo] }} /><span className="truncate">{e.hora ? `${e.hora} ` : ""}{e.titulo}</span></span>)}
                    {evs.length > 3 && <span className="block text-[11.5px] text-ink-3">mais {evs.length - 3}</span>}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{evs.slice(0, 5).map((e) => <span key={e.id} className="size-1.5 rounded-full" style={{ background: COR[e.tipo] }} />)}</span>
                </button>
              );
            })}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-2 px-3 py-2 text-[12px] text-ink-2">{(Object.keys(COR) as (keyof typeof COR)[]).map((t) => <span key={t} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: COR[t] }} />{t}</span>)}</p>
        </div>
        <section className="painel h-fit">
          <div className="painel-cab"><h2>{data(sel)}</h2><span className="tag">{doDia.length}</span></div>
          {doDia.length === 0 ? <Vazio titulo="Dia livre">Nenhum prazo, audiência ou atendimento nesta data.</Vazio> : (
            <ul>{doDia.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 border-b border-line-2 px-4 py-2.5 last:border-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: COR[e.tipo] }} />
                <div className="min-w-0"><p className="text-[12px] font-semibold text-ink-3">{e.hora ? `${e.hora} · ` : ""}{e.tipo}</p>{e.href ? <Link href={e.href} className="font-medium hover:text-cobalto hover:underline">{e.titulo}</Link> : <p>{e.titulo}</p>}</div>
              </li>
            ))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
