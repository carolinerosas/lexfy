"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  Bell,
  ArrowRight,
  CheckCircle2,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDashboardStats,
  getPrazosWithProcesso,
  getAudienciasWithProcesso,
  getAtendimentosWithProcesso,
  type DashboardStats,
} from "@/lib/store";
import { formatCurrency, formatDate, formatDateTime, daysUntil, prazoColor } from "@/lib/utils";
import type { Prazo, Audiencia, Atendimento, Processo } from "@/types";

type EventoPrazo = { kind: "prazo"; data: Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> } };
type EventoAudiencia = { kind: "audiencia"; data: Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> } };
type EventoAtendimento = { kind: "atendimento"; data: Atendimento };
type Evento = EventoPrazo | EventoAudiencia | EventoAtendimento;

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
  const [prazos, setPrazos] = useState<(Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [audiencias, setAudiencias] = useState<(Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventosPorDia, setEventosPorDia] = useState<Map<string, Evento[]>>(new Map());

  useEffect(() => {
    setStats(getDashboardStats());

    const allPrazos = getPrazosWithProcesso()
      .filter((p) => !p.concluido)
      .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime())
      .slice(0, 5);
    setPrazos(allPrazos);

    const now = new Date();
    const allAudiencias = getAudienciasWithProcesso()
      .filter((a) => !a.realizada && new Date(a.data_hora) >= now)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
      .slice(0, 5);
    setAudiencias(allAudiencias);
  }, []);

  useEffect(() => {
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

    const allPrazos = getPrazosWithProcesso().filter((p) => !p.concluido);
    allPrazos.forEach((p) => {
      const key = p.data_prazo.slice(0, 10);
      if (mapa.has(key)) mapa.get(key)!.push({ kind: "prazo", data: p });
    });

    const allAudiencias = getAudienciasWithProcesso().filter((a) => !a.realizada);
    allAudiencias.forEach((a) => {
      const key = a.data_hora.slice(0, 10);
      if (mapa.has(key)) mapa.get(key)!.push({ kind: "audiencia", data: a });
    });

    const allAtendimentos = getAtendimentosWithProcesso().filter((a) => a.status === "agendado");
    allAtendimentos.forEach((a) => {
      const key = a.data_hora.slice(0, 10);
      if (mapa.has(key)) mapa.get(key)!.push({ kind: "atendimento", data: a });
    });

    setEventosPorDia(mapa);
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
      return `${start.getDate()} – ${end.getDate()} de ${end.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
    }
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          {today.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Alertas */}
      {(stats.prazosVencidos > 0 || stats.publicacoesNaoLidas > 0 || stats.movimentacoesNaoLidas > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {stats.prazosVencidos > 0 && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {stats.prazosVencidos} prazo{stats.prazosVencidos > 1 ? "s" : ""} vencido{stats.prazosVencidos > 1 ? "s" : ""}
            </div>
          )}
          {stats.movimentacoesNaoLidas > 0 && (
            <Link href="/dashboard/processos">
              <div className="flex items-center gap-2.5 bg-gray-900 rounded-xl px-4 py-3 text-white text-sm font-medium hover:bg-black transition-colors cursor-pointer">
                <Activity className="w-4 h-4" />
                {stats.movimentacoesNaoLidas} movimentaç{stats.movimentacoesNaoLidas > 1 ? "ões" : "ão"} nova{stats.movimentacoesNaoLidas > 1 ? "s" : ""}
              </div>
            </Link>
          )}
          {stats.publicacoesNaoLidas > 0 && (
            <Link href="/dashboard/publicacoes">
              <div className="flex items-center gap-2.5 bg-gray-900 rounded-xl px-4 py-3 text-white text-sm font-medium hover:bg-black transition-colors cursor-pointer">
                <Bell className="w-4 h-4" />
                {stats.publicacoesNaoLidas} publicaç{stats.publicacoesNaoLidas > 1 ? "ões" : "ão"} não {stats.publicacoesNaoLidas > 1 ? "lidas" : "lida"}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={<FolderOpen className="w-5 h-5 text-gray-600" />} label="Processos Ativos" value={stats.processosAtivos} sub={`${stats.totalProcessos} total`} href="/dashboard/processos" />
        <StatCard icon={<Users className="w-5 h-5 text-gray-600" />} label="Atendimentos" value={stats.atendimentosProximos} sub="próximos 7 dias" href="/dashboard/atendimentos" />
        <StatCard icon={<Clock className="w-5 h-5 text-gray-600" />} label="Prazos Próximos" value={stats.prazosProximos} sub={stats.prazosVencidos > 0 ? `${stats.prazosVencidos} vencidos` : "próximos 7 dias"} subColor={stats.prazosVencidos > 0 ? "text-red-500" : undefined} href="/dashboard/prazos" />
        <StatCard icon={<Calendar className="w-5 h-5 text-gray-600" />} label="Audiências" value={stats.audienciasProximas} sub="próximos 7 dias" href="/dashboard/audiencias" />
        <StatCard icon={<DollarSign className="w-5 h-5 text-gray-600" />} label="Recebido no Mês" value={formatCurrency(stats.honorariosRecebidosMes)} sub={`${formatCurrency(stats.honorariosPendentes)} a receber`} href="/dashboard/financeiro" />
      </div>

      {/* Agenda da Semana */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agenda da Semana</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">{weekLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors"
                >
                  Hoje
                </button>
              )}
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <div className="grid grid-cols-7 divide-x divide-gray-100 border-t border-gray-100 min-w-[560px]">
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const eventos = eventosPorDia.get(dateKey(day)) ?? [];
              const totalEventos = eventos.length;

              return (
                <div
                  key={dateKey(day)}
                  className={`min-h-[180px] p-3 flex flex-col ${isToday ? "bg-gray-900" : isWeekend ? "bg-gray-50/60" : "bg-white"}`}
                >
                  {/* Day header */}
                  <div className="mb-2.5">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-gray-400" : "text-gray-400"}`}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                    </p>
                    <p className={`text-lg font-black leading-tight ${isToday ? "text-white" : isWeekend ? "text-gray-400" : "text-gray-900"}`}>
                      {day.getDate()}
                    </p>
                    {isToday && (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">hoje</span>
                    )}
                  </div>

                  {/* Eventos */}
                  <div className="flex flex-col gap-1 flex-1">
                    {totalEventos === 0 && (
                      <p className={`text-[10px] ${isToday ? "text-gray-600" : "text-gray-300"} mt-1`}>—</p>
                    )}
                    {eventos.map((ev, i) => (
                      <EventoChip key={i} evento={ev} isOnDark={isToday} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          </div>{/* end overflow-x-auto */}
          {/* Legenda */}
          <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-xs text-gray-500">Prazo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span className="text-xs text-gray-500">Audiência</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              <span className="text-xs text-gray-500">Atendimento</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listas */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Prazos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Próximos Prazos</CardTitle>
              <Link href="/dashboard/prazos">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs">
                  Ver todos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {prazos.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-gray-300" />} text="Nenhum prazo pendente" />
            ) : (
              <ul className="divide-y divide-gray-50">
                {prazos.map((prazo) => {
                  const days = daysUntil(prazo.data_prazo);
                  return (
                    <li key={prazo.id} className="px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{prazo.titulo}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {prazo.processo?.cliente_nome ?? "—"} · <span className="font-mono">{prazo.processo?.numero ?? "—"}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${prazoColor(days)}`}>
                            {days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days}d`}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{formatDate(prazo.data_prazo)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Audiências */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Próximas Audiências</CardTitle>
              <Link href="/dashboard/audiencias">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 text-xs">
                  Ver todas <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {audiencias.length === 0 ? (
              <EmptyState icon={<Calendar className="w-8 h-8 text-gray-200" />} text="Nenhuma audiência agendada" />
            ) : (
              <ul className="divide-y divide-gray-50">
                {audiencias.map((aud) => (
                  <li key={aud.id} className="px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{aud.titulo}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {aud.processo?.cliente_nome ?? "—"} · {aud.local ?? "Local não informado"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg tabular-nums">
                          {formatDateTime(aud.data_hora).split(" ")[1]}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(aud.data_hora)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EventoChip({ evento, isOnDark }: { evento: Evento; isOnDark: boolean }) {
  if (evento.kind === "prazo") {
    const days = daysUntil(evento.data.data_prazo);
    const isUrgent = days <= 2;
    return (
      <div className={`rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight truncate ${
        isOnDark
          ? isUrgent ? "bg-red-500/30 text-red-300" : "bg-amber-400/20 text-amber-300"
          : isUrgent ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-800 border border-amber-200"
      }`}>
        <span className="mr-0.5">⚖</span>
        {evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "audiencia") {
    const hora = evento.data.data_hora.slice(11, 16);
    return (
      <div className={`rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight truncate ${
        isOnDark ? "bg-blue-500/25 text-blue-300" : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}>
        <span className="mr-0.5 tabular-nums">{hora && hora !== "00:00" ? hora : "⚖"}</span>
        {evento.data.titulo}
      </div>
    );
  }

  if (evento.kind === "atendimento") {
    const hora = evento.data.data_hora.slice(11, 16);
    return (
      <div className={`rounded-md px-1.5 py-1 text-[10px] font-medium leading-tight truncate ${
        isOnDark ? "bg-violet-500/25 text-violet-300" : "bg-violet-50 text-violet-700 border border-violet-200"
      }`}>
        <span className="mr-0.5 tabular-nums">{hora && hora !== "00:00" ? hora : "👤"}</span>
        {evento.data.cliente_nome}
      </div>
    );
  }

  return null;
}

function StatCard({ icon, label, value, sub, subColor, href }: { icon: React.ReactNode; label: string; value: string | number; sub: string; subColor?: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mb-4">{icon}</div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">{label}</p>
          <p className={`text-xs mt-1 ${subColor ?? "text-gray-400"}`}>{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-6">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
