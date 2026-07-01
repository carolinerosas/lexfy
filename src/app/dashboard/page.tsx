"use client";

import { Children, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  ListTodo,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAtendimentosWithProcesso,
  getAudienciasWithProcesso,
  getDashboardStats,
  getPrazosWithProcesso,
  getTarefasWithProcesso,
  type DashboardStats,
} from "@/lib/store";
import { daysUntil, formatDate, formatDateTime, prazoColor } from "@/lib/utils";
import type { Atendimento, Audiencia, Prazo, Processo, Tarefa } from "@/types";

type ProcessoResumo = Pick<Processo, "numero" | "titulo" | "cliente_nome">;
type ProcessoResumoComId = Pick<Processo, "id" | "numero" | "titulo" | "cliente_nome">;
type PrazoComProcesso = Prazo & { processo?: ProcessoResumo };
type TarefaComProcesso = Tarefa & { processo?: ProcessoResumoComId };
type AudienciaComProcesso = Audiencia & { processo?: ProcessoResumo };

type EventoPrazo = { kind: "prazo"; data: PrazoComProcesso };
type EventoTarefa = { kind: "tarefa"; data: TarefaComProcesso };
type EventoAudiencia = { kind: "audiencia"; data: AudienciaComProcesso };
type EventoAtendimento = { kind: "atendimento"; data: Atendimento };
type Evento = EventoPrazo | EventoTarefa | EventoAudiencia | EventoAtendimento;

type AgendaView = "dia" | "semana" | "mes";

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [prazos, setPrazos] = useState<PrazoComProcesso[]>([]);
  const [tarefas, setTarefas] = useState<TarefaComProcesso[]>([]);
  const [audiencias, setAudiencias] = useState<AudienciaComProcesso[]>([]);
  const [agendaView, setAgendaView] = useState<AgendaView>("semana");
  const [offset, setOffset] = useState(0);
  const [eventosPorDia, setEventosPorDia] = useState<Map<string, Evento[]>>(new Map());

  useEffect(() => {
    async function load() {
      const [s, allPrazosRaw, allTarefasRaw, allAudienciasRaw] = await Promise.all([
        getDashboardStats(),
        getPrazosWithProcesso(),
        getTarefasWithProcesso(),
        getAudienciasWithProcesso(),
      ]);

      setStats(s);
      setPrazos(
        allPrazosRaw
          .filter((p) => !p.concluido)
          .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime())
          .slice(0, 5)
      );
      setTarefas(
        allTarefasRaw
          .filter((t) => !t.concluida)
          .sort((a, b) => (a.data_limite ?? "9999-12-31").localeCompare(b.data_limite ?? "9999-12-31"))
          .slice(0, 5)
      );

      const now = new Date();
      setAudiencias(
        allAudienciasRaw
          .filter((a) => !a.realizada && new Date(a.data_hora) >= now)
          .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
          .slice(0, 5)
      );
    }
    load();
  }, []);

  useEffect(() => {
    async function buildAgenda() {
      const mapa = new Map<string, Evento[]>();
      const push = (key: string, ev: Evento) => {
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key)!.push(ev);
      };

      const [allPrazos, allTarefas, allAudiencias, allAtendimentos] = await Promise.all([
        getPrazosWithProcesso(),
        getTarefasWithProcesso(),
        getAudienciasWithProcesso(),
        getAtendimentosWithProcesso(),
      ]);

      allPrazos.filter((p) => !p.concluido).forEach((p) => push(p.data_prazo.slice(0, 10), { kind: "prazo", data: p }));
      allTarefas.filter((t) => !t.concluida && t.data_limite).forEach((t) => push(t.data_limite!.slice(0, 10), { kind: "tarefa", data: t }));
      allAudiencias.filter((a) => !a.realizada).forEach((a) => push(a.data_hora.slice(0, 10), { kind: "audiencia", data: a }));
      allAtendimentos.filter((a) => a.status === "agendado").forEach((a) => push(a.data_hora.slice(0, 10), { kind: "atendimento", data: a }));

      setEventosPorDia(mapa);
    }
    buildAgenda();
  }, []);

  if (!stats) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Dias visíveis conforme a visão (dia/semana/mês) e o deslocamento (offset).
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
    agendaDias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Painel</h1>
        <p className="mt-1 text-sm text-gray-400">
          {today.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <Link href="/dashboard/briefing" className="mb-6 block">
        <div className="group flex min-w-0 flex-col gap-4 rounded-2xl border border-[#21181d]/10 bg-gradient-to-br from-[#21181d] to-[#3a2a35] p-5 text-white shadow-lg shadow-[#21181d]/10 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Briefing</p>
              <h2 className="mt-1 text-lg font-black tracking-tight">Leia o briefing de hoje</h2>
              <p className="mt-1 text-sm leading-6 text-white/70">
                Veja o resumo do dia, pontos de atenção e próximos movimentos importantes.
              </p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#21181d] transition-transform group-hover:translate-x-0.5">
            Abrir briefing <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </Link>

      {(stats.prazosVencidos > 0 || stats.tarefasVencidas > 0 || stats.publicacoesNaoLidas > 0 || stats.movimentacoesNaoLidas > 0) && (
        <div className="mb-6 flex min-w-0 flex-wrap gap-3">
          {stats.prazosVencidos > 0 && (
            <div className="flex min-w-0 w-full items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:w-auto">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {stats.prazosVencidos} prazo{stats.prazosVencidos > 1 ? "s" : ""} vencido{stats.prazosVencidos > 1 ? "s" : ""}
            </div>
          )}
          {stats.tarefasVencidas > 0 && (
            <Link href="/dashboard/tarefas" className="min-w-0 w-full sm:w-auto">
              <div className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100">
                <ListTodo className="h-4 w-4 shrink-0" />
                {stats.tarefasVencidas} tarefa{stats.tarefasVencidas > 1 ? "s" : ""} vencida{stats.tarefasVencidas > 1 ? "s" : ""}
              </div>
            </Link>
          )}
          {stats.movimentacoesNaoLidas > 0 && (
            <Link href="/dashboard/processos" className="min-w-0 w-full sm:w-auto">
              <div className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-[#21181d] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2b2027]">
                <Activity className="h-4 w-4 shrink-0" />
                {stats.movimentacoesNaoLidas} movimentaç{stats.movimentacoesNaoLidas > 1 ? "ões" : "ão"} nova{stats.movimentacoesNaoLidas > 1 ? "s" : ""}
              </div>
            </Link>
          )}
          {stats.publicacoesNaoLidas > 0 && (
            <Link href="/dashboard/publicacoes" className="min-w-0 w-full sm:w-auto">
              <div className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-[#21181d] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2b2027]">
                <Bell className="h-4 w-4 shrink-0" />
                {stats.publicacoesNaoLidas} publicaç{stats.publicacoesNaoLidas > 1 ? "ões" : "ão"} não {stats.publicacoesNaoLidas > 1 ? "lidas" : "lida"}
              </div>
            </Link>
          )}
        </div>
      )}

      <div className="mb-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<FolderOpen className="h-5 w-5 text-gray-600" />} label="Processos Ativos" value={stats.processosAtivos} sub={`${stats.totalProcessos} total`} href="/dashboard/processos" />
        <StatCard icon={<ListTodo className="h-5 w-5 text-gray-600" />} label="Tarefas" value={stats.tarefasPendentes} sub={stats.tarefasProximas > 0 ? `${stats.tarefasProximas} nos próximos 7 dias` : "pendentes"} href="/dashboard/tarefas" />
        <StatCard icon={<Clock className="h-5 w-5 text-gray-600" />} label="Prazos Próximos" value={stats.prazosProximos} sub={stats.prazosVencidos > 0 ? `${stats.prazosVencidos} vencidos` : "próximos 7 dias"} subColor={stats.prazosVencidos > 0 ? "text-red-500" : undefined} href="/dashboard/prazos" />
        <StatCard icon={<Users className="h-5 w-5 text-gray-600" />} label="Atendimentos" value={stats.atendimentosProximos} sub="próximos 7 dias" href="/dashboard/atendimentos" />
        <StatCard icon={<Calendar className="h-5 w-5 text-gray-600" />} label="Audiências" value={stats.audienciasProximas} sub="próximos 7 dias" href="/dashboard/audiencias" />
      </div>

      <Card className="mb-6">
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
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <ListCard title="Tarefas Pendentes" href="/dashboard/tarefas" empty="Nenhuma tarefa pendente" icon={<CheckCircle2 className="h-8 w-8 text-gray-300" />}>
          {tarefas.map((tarefa) => <TarefaItem key={tarefa.id} tarefa={tarefa} />)}
        </ListCard>

        <ListCard title="Próximos Prazos" href="/dashboard/prazos" empty="Nenhum prazo pendente" icon={<CheckCircle2 className="h-8 w-8 text-gray-300" />}>
          {prazos.map((prazo) => <PrazoItem key={prazo.id} prazo={prazo} />)}
        </ListCard>

        <ListCard title="Próximas Audiências" href="/dashboard/audiencias" empty="Nenhuma audiência agendada" icon={<Calendar className="h-8 w-8 text-gray-200" />}>
          {audiencias.map((aud) => <AudienciaItem key={aud.id} audiencia={aud} />)}
        </ListCard>
      </div>
    </div>
  );
}

function EventoChip({ evento, isOnDark, compact }: { evento: Evento; isOnDark: boolean; compact?: boolean }) {
  const pad = `truncate rounded-md font-medium leading-tight ${compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-1 text-[10px]"}`;

  if (evento.kind === "prazo") {
    const days = daysUntil(evento.data.data_prazo);
    const isUrgent = days <= 2;
    return (
      <div className={`${pad} ${
        isOnDark
          ? isUrgent ? "bg-red-500/30 text-red-200" : "bg-amber-400/20 text-amber-200"
          : isUrgent ? "bg-red-100 text-red-700" : "border border-amber-200 bg-amber-50 text-amber-800"
      }`}>
        {compact ? "" : "Prazo · "}{evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "tarefa") {
    return (
      <div className={`${pad} ${
        isOnDark ? "bg-white/15 text-slate-100" : "border border-slate-200 bg-slate-50 text-slate-700"
      }`}>
        {compact ? "" : "Tarefa · "}{evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "audiencia") {
    const hora = evento.data.data_hora.slice(11, 16);
    return (
      <div className={`${pad} ${
        isOnDark ? "bg-blue-500/25 text-blue-200" : "border border-blue-200 bg-blue-50 text-blue-700"
      }`}>
        {hora && hora !== "00:00" ? hora : "Audiência"} · {evento.data.titulo}
      </div>
    );
  }

  const hora = evento.data.data_hora.slice(11, 16);
  return (
    <div className={`${pad} ${
      isOnDark ? "bg-violet-500/25 text-violet-200" : "border border-violet-200 bg-violet-50 text-violet-700"
    }`}>
      {hora && hora !== "00:00" ? hora : "Atendimento"} · {evento.data.cliente_nome}
    </div>
  );
}

function StatCard({ icon, label, value, sub, subColor, href }: { icon: React.ReactNode; label: string; value: string | number; sub: string; subColor?: string; href: string }) {
  return (
    <Link href={href} className="min-w-0">
      <Card className="cursor-pointer transition-all hover:border-gray-300 hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">{icon}</div>
          <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-xs ${subColor ?? "text-gray-400"}`}>{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListCard({ title, href, empty, icon, children }: { title: string; href: string; empty: string; icon: React.ReactNode; children: React.ReactNode }) {
  const items = Children.toArray(children);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <Link href={href}>
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-900">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState icon={icon} text={empty} />
        ) : (
          <ul className="divide-y divide-gray-50">{items}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function TarefaItem({ tarefa }: { tarefa: TarefaComProcesso }) {
  const days = tarefa.data_limite ? daysUntil(tarefa.data_limite) : undefined;
  const dueLabel = days === undefined ? "Sem data" : days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "Hoje" : `${days}d`;

  return (
    <li className="px-6 py-3.5 transition-colors hover:bg-gray-50/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{tarefa.titulo}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {tarefa.processo?.cliente_nome ?? "—"} · <span className="font-mono">{tarefa.processo?.numero ?? "—"}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${days !== undefined ? prazoColor(days) : "bg-gray-100 text-gray-500"}`}>
            {dueLabel}
          </span>
          <p className="mt-1 text-xs text-gray-400">{tarefa.data_limite ? formatDate(tarefa.data_limite) : ""}</p>
        </div>
      </div>
    </li>
  );
}

function PrazoItem({ prazo }: { prazo: PrazoComProcesso }) {
  const days = daysUntil(prazo.data_prazo);
  return (
    <li className="px-6 py-3.5 transition-colors hover:bg-gray-50/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{prazo.titulo}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {prazo.processo?.cliente_nome ?? "—"} · <span className="font-mono">{prazo.processo?.numero ?? "—"}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${prazoColor(days)}`}>
            {days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days}d`}
          </span>
          <p className="mt-1 text-xs text-gray-400">{formatDate(prazo.data_prazo)}</p>
        </div>
      </div>
    </li>
  );
}

function AudienciaItem({ audiencia }: { audiencia: AudienciaComProcesso }) {
  return (
    <li className="px-6 py-3.5 transition-colors hover:bg-gray-50/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{audiencia.titulo}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {audiencia.processo?.cliente_nome ?? "—"} · {audiencia.local ?? "Local não informado"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold tabular-nums text-gray-900">
            {formatDateTime(audiencia.data_hora).split(" ")[1]}
          </p>
          <p className="mt-1 text-xs text-gray-400">{formatDate(audiencia.data_hora)}</p>
        </div>
      </div>
    </li>
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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
