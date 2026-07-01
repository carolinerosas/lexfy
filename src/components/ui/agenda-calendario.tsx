"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAtendimentosWithProcesso,
  getAudienciasWithProcesso,
  getPrazosWithProcesso,
  getTarefasWithProcesso,
  getAcordoParcelas,
} from "@/lib/store";
import { daysUntil, formatCurrency } from "@/lib/utils";
import type { Atendimento, Audiencia, Prazo, Processo, Tarefa, AcordoParcela } from "@/types";

type ProcessoResumo = Pick<Processo, "numero" | "titulo" | "cliente_nome">;
type ProcessoResumoComId = Pick<Processo, "id" | "numero" | "titulo" | "cliente_nome">;
type PrazoComProcesso = Prazo & { processo?: ProcessoResumo };
type TarefaComProcesso = Tarefa & { processo?: ProcessoResumoComId };
type AudienciaComProcesso = Audiencia & { processo?: ProcessoResumo };

type Evento =
  | { kind: "prazo"; data: PrazoComProcesso }
  | { kind: "tarefa"; data: TarefaComProcesso }
  | { kind: "audiencia"; data: AudienciaComProcesso }
  | { kind: "atendimento"; data: Atendimento }
  | { kind: "acordo"; data: AcordoParcela };

type AgendaView = "dia" | "semana" | "mes";

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AgendaCalendario() {
  const [agendaView, setAgendaView] = useState<AgendaView>("semana");
  const [offset, setOffset] = useState(0);
  const [eventosPorDia, setEventosPorDia] = useState<Map<string, Evento[]>>(new Map());

  useEffect(() => {
    async function build() {
      const mapa = new Map<string, Evento[]>();
      const push = (key: string, ev: Evento) => {
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key)!.push(ev);
      };
      const [allPrazos, allTarefas, allAudiencias, allAtendimentos, allAcordos] = await Promise.all([
        getPrazosWithProcesso(),
        getTarefasWithProcesso(),
        getAudienciasWithProcesso(),
        getAtendimentosWithProcesso(),
        getAcordoParcelas(),
      ]);
      allPrazos.filter((p) => !p.concluido).forEach((p) => push(p.data_prazo.slice(0, 10), { kind: "prazo", data: p }));
      allTarefas.filter((t) => !t.concluida && t.data_limite).forEach((t) => push(t.data_limite!.slice(0, 10), { kind: "tarefa", data: t }));
      allAudiencias.filter((a) => !a.realizada).forEach((a) => push(a.data_hora.slice(0, 10), { kind: "audiencia", data: a }));
      allAtendimentos.filter((a) => a.status === "agendado").forEach((a) => push(a.data_hora.slice(0, 10), { kind: "atendimento", data: a }));
      allAcordos.filter((p) => !p.pago && p.data_vencimento).forEach((p) => push(p.data_vencimento!.slice(0, 10), { kind: "acordo", data: p }));
      setEventosPorDia(mapa);
    }
    build();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let agendaDias: Date[] = [];
  let mesReferencia = today.getMonth();
  let agendaLabel = "";
  if (agendaView === "dia") {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    agendaDias = [d];
    mesReferencia = d.getMonth();
    agendaLabel = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } else if (agendaView === "semana") {
    const monday = getMonday(today);
    monday.setDate(monday.getDate() + offset * 7);
    agendaDias = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
    mesReferencia = agendaDias[3].getMonth();
    const start = agendaDias[0];
    const end = agendaDias[6];
    agendaLabel = start.getMonth() === end.getMonth()
      ? `${start.getDate()} - ${end.getDate()} de ${end.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
      : `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    const primeiro = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    mesReferencia = primeiro.getMonth();
    const gridStart = getMonday(primeiro);
    const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
    const gridEnd = getMonday(ultimo);
    gridEnd.setDate(gridEnd.getDate() + 6);
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) agendaDias.push(new Date(d));
    agendaLabel = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Agenda</CardTitle>
            <p className="mt-0.5 text-xs capitalize text-gray-400">{agendaLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              {(["dia", "semana", "mes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setAgendaView(v); setOffset(0); }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${agendaView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                >
                  {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setOffset((o) => o - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {offset !== 0 && (
                <button type="button" onClick={() => setOffset(0)} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200">
                  Hoje
                </button>
              )}
              <button type="button" onClick={() => setOffset((o) => o + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {agendaView === "dia" ? (
          (() => {
            const day = agendaDias[0];
            const eventos = eventosPorDia.get(dateKey(day)) ?? [];
            const isToday = isSameDay(day, today);
            return (
              <div className="border-t border-gray-100 p-4">
                {eventos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">Nada agendado {isToday ? "para hoje" : "neste dia"}.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {eventos.map((ev, i) => <EventoChip key={i} evento={ev} isOnDark={false} />)}
                  </div>
                )}
              </div>
            );
          })()
        ) : agendaView === "semana" ? (
          <div className="grid grid-cols-1 divide-y divide-gray-100 border-t border-gray-100 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
            {agendaDias.map((day) => {
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const eventos = eventosPorDia.get(dateKey(day)) ?? [];
              return (
                <div key={dateKey(day)} className={`flex min-w-0 flex-col p-3 sm:min-h-[180px] ${isToday ? "bg-[#21181d]" : isWeekend ? "bg-gray-50/60" : "bg-white"}`}>
                  <div className="mb-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</p>
                    <p className={`text-lg font-black leading-tight ${isToday ? "text-white" : isWeekend ? "text-gray-400" : "text-gray-900"}`}>{day.getDate()}</p>
                    {isToday && <span className="mt-0.5 inline-block text-[9px] font-bold uppercase tracking-wider text-gray-400">hoje</span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    {eventos.length === 0 && <p className={`mt-1 text-[10px] ${isToday ? "text-gray-500" : "text-gray-300"}`}>-</p>}
                    {eventos.map((ev, i) => <EventoChip key={i} evento={ev} isOnDark={isToday} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-gray-100">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
              {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {agendaDias.map((day) => {
                const isToday = isSameDay(day, today);
                const foraDoMes = day.getMonth() !== mesReferencia;
                const eventos = eventosPorDia.get(dateKey(day)) ?? [];
                return (
                  <div key={dateKey(day)} className={`flex min-h-[92px] flex-col border-b border-r border-gray-100 p-1.5 ${foraDoMes ? "bg-gray-50/40" : "bg-white"}`}>
                    <span className={`mb-1 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] font-bold ${isToday ? "bg-[#21181d] text-white" : foraDoMes ? "text-gray-300" : "text-gray-700"}`}>{day.getDate()}</span>
                    <div className="flex flex-col gap-0.5">
                      {eventos.slice(0, 3).map((ev, i) => <EventoChip key={i} evento={ev} isOnDark={false} compact />)}
                      {eventos.length > 3 && <span className="text-[9px] font-semibold text-gray-400">+{eventos.length - 3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <LegendDot color="bg-amber-400" label="Prazo" />
          <LegendDot color="bg-slate-500" label="Tarefa" />
          <LegendDot color="bg-blue-500" label="Audiência" />
          <LegendDot color="bg-violet-500" label="Atendimento" />
          <LegendDot color="bg-emerald-500" label="Acordo" />
        </div>
      </CardContent>
    </Card>
  );
}

function EventoChip({ evento, isOnDark, compact }: { evento: Evento; isOnDark: boolean; compact?: boolean }) {
  const pad = `truncate rounded-md font-medium leading-tight ${compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-1 text-[10px]"}`;

  if (evento.kind === "prazo") {
    const days = daysUntil(evento.data.data_prazo);
    const isUrgent = days <= 2;
    return (
      <div className={`${pad} ${isOnDark ? (isUrgent ? "bg-red-500/30 text-red-200" : "bg-amber-400/20 text-amber-200") : (isUrgent ? "bg-red-100 text-red-700" : "border border-amber-200 bg-amber-50 text-amber-800")}`}>
        {compact ? "" : "Prazo · "}{evento.data.titulo}
      </div>
    );
  }
  if (evento.kind === "tarefa") {
    return (
      <div className={`${pad} ${isOnDark ? "bg-white/15 text-slate-100" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
        {compact ? "" : "Tarefa · "}{evento.data.titulo}
      </div>
    );
  }
  if (evento.kind === "audiencia") {
    const hora = evento.data.data_hora.slice(11, 16);
    return (
      <div className={`${pad} ${isOnDark ? "bg-blue-500/25 text-blue-200" : "border border-blue-200 bg-blue-50 text-blue-700"}`}>
        {hora && hora !== "00:00" ? hora : "Audiência"} · {evento.data.titulo}
      </div>
    );
  }
  if (evento.kind === "acordo") {
    return (
      <div className={`${pad} ${isOnDark ? "bg-emerald-500/25 text-emerald-200" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
        {compact ? "" : "Acordo · "}{evento.data.direcao === "receber" ? "receber" : "pagar"} {formatCurrency(evento.data.valor)}
      </div>
    );
  }
  const hora = evento.data.data_hora.slice(11, 16);
  return (
    <div className={`${pad} ${isOnDark ? "bg-violet-500/25 text-violet-200" : "border border-violet-200 bg-violet-50 text-violet-700"}`}>
      {hora && hora !== "00:00" ? hora : "Atendimento"} · {evento.data.cliente_nome}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
