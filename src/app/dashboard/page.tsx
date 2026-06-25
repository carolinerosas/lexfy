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
  const [weekOffset, setWeekOffset] = useState(0);
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
      const today = new Date();
      const monday = getMonday(today);
      monday.setDate(monday.getDate() + weekOffset * 7);

      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d;
      });

      const mapa = new Map<string, Evento[]>();
      dias.forEach((d) => mapa.set(dateKey(d), []));

      const [allPrazos, allTarefas, allAudiencias, allAtendimentos] = await Promise.all([
        getPrazosWithProcesso(),
        getTarefasWithProcesso(),
        getAudienciasWithProcesso(),
        getAtendimentosWithProcesso(),
      ]);

      allPrazos.filter((p) => !p.concluido).forEach((p) => {
        const key = p.data_prazo.slice(0, 10);
        if (mapa.has(key)) mapa.get(key)!.push({ kind: "prazo", data: p });
      });

      allTarefas.filter((t) => !t.concluida && t.data_limite).forEach((t) => {
        const key = t.data_limite!.slice(0, 10);
        if (mapa.has(key)) mapa.get(key)!.push({ kind: "tarefa", data: t });
      });

      allAudiencias.filter((a) => !a.realizada).forEach((a) => {
        const key = a.data_hora.slice(0, 10);
        if (mapa.has(key)) mapa.get(key)!.push({ kind: "audiencia", data: a });
      });

      allAtendimentos.filter((a) => a.status === "agendado").forEach((a) => {
        const key = a.data_hora.slice(0, 10);
        if (mapa.has(key)) mapa.get(key)!.push({ kind: "atendimento", data: a });
      });

      setEventosPorDia(mapa);
    }
    buildAgenda();
  }, [weekOffset]);

  if (!stats) return null;

  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekLabel = (() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} de ${end.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
    }
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="mx-auto w-full max-w-7xl overflow-hidden px-4 py-6 md:px-8 md:py-8">
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agenda da Semana</CardTitle>
              <p className="mt-0.5 text-xs text-gray-400">{weekLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Hoje
                </button>
              )}
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div>
            <div className="grid grid-cols-1 divide-y divide-gray-100 border-t border-gray-100 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
              {weekDays.map((day) => {
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const eventos = eventosPorDia.get(dateKey(day)) ?? [];

                return (
                  <div
                    key={dateKey(day)}
                    className={`flex min-w-0 flex-col p-3 sm:min-h-[180px] ${isToday ? "bg-[#21181d]" : isWeekend ? "bg-gray-50/60" : "bg-white"}`}
                  >
                    <div className="mb-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                      </p>
                      <p className={`text-lg font-black leading-tight ${isToday ? "text-white" : isWeekend ? "text-gray-400" : "text-gray-900"}`}>
                        {day.getDate()}
                      </p>
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
          </div>

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

function EventoChip({ evento, isOnDark }: { evento: Evento; isOnDark: boolean }) {
  if (evento.kind === "prazo") {
    const days = daysUntil(evento.data.data_prazo);
    const isUrgent = days <= 2;
    return (
      <div className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight ${
        isOnDark
          ? isUrgent ? "bg-red-500/30 text-red-200" : "bg-amber-400/20 text-amber-200"
          : isUrgent ? "bg-red-100 text-red-700" : "border border-amber-200 bg-amber-50 text-amber-800"
      }`}>
        Prazo · {evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "tarefa") {
    return (
      <div className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight ${
        isOnDark ? "bg-white/15 text-slate-100" : "border border-slate-200 bg-slate-50 text-slate-700"
      }`}>
        Tarefa · {evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "audiencia") {
    const hora = evento.data.data_hora.slice(11, 16);
    return (
      <div className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight ${
        isOnDark ? "bg-blue-500/25 text-blue-200" : "border border-blue-200 bg-blue-50 text-blue-700"
      }`}>
        {hora && hora !== "00:00" ? hora : "Audiência"} · {evento.data.titulo}
      </div>
    );
  }

  const hora = evento.data.data_hora.slice(11, 16);
  return (
    <div className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight ${
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
