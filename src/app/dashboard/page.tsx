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
  Clock,
  FolderOpen,
  Handshake,
  ListTodo,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgendaCalendario } from "@/components/ui/agenda-calendario";
import {
  getAudienciasWithProcesso,
  getDashboardStats,
  getPrazosWithProcesso,
  getTarefasWithProcesso,
  getAcordoParcelas,
  type DashboardStats,
} from "@/lib/store";
import { daysUntil, formatCurrency, formatDate, formatDateTime, prazoColor } from "@/lib/utils";
import type { Audiencia, Prazo, Processo, Tarefa, AcordoParcela } from "@/types";

type ProcessoResumo = Pick<Processo, "numero" | "titulo" | "cliente_nome">;
type ProcessoResumoComId = Pick<Processo, "id" | "numero" | "titulo" | "cliente_nome">;
type PrazoComProcesso = Prazo & { processo?: ProcessoResumo };
type TarefaComProcesso = Tarefa & { processo?: ProcessoResumoComId };
type AudienciaComProcesso = Audiencia & { processo?: ProcessoResumo };

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [prazos, setPrazos] = useState<PrazoComProcesso[]>([]);
  const [tarefas, setTarefas] = useState<TarefaComProcesso[]>([]);
  const [audiencias, setAudiencias] = useState<AudienciaComProcesso[]>([]);
  const [acordosAlerta, setAcordosAlerta] = useState<AcordoParcela[]>([]);

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
    async function carregarAcordos() {
      const acordos = await getAcordoParcelas();
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const limite = new Date(hoje); limite.setDate(limite.getDate() + 7);
      setAcordosAlerta(
        acordos
          .filter((p) => !p.pago && p.data_vencimento && new Date(p.data_vencimento + "T00:00:00") <= limite)
          .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))
      );
    }
    carregarAcordos();
  }, []);

  if (!stats) return null;

  const today = new Date();

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

      {(stats.prazosVencidos > 0 || stats.tarefasVencidas > 0 || stats.publicacoesNaoLidas > 0 || stats.movimentacoesNaoLidas > 0 || acordosAlerta.length > 0) && (
        <div className="mb-6 flex min-w-0 flex-wrap gap-3">
          {acordosAlerta.length > 0 && (
            <Link href="/dashboard/financeiro" className="min-w-0 w-full sm:w-auto">
              <div className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100">
                <Handshake className="h-4 w-4 shrink-0" />
                {acordosAlerta.length} parcela{acordosAlerta.length > 1 ? "s" : ""} de acordo vencendo (próx. {formatCurrency(acordosAlerta.reduce((s, p) => s + p.valor, 0))})
              </div>
            </Link>
          )}
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

      <div className="mb-6"><AgendaCalendario /></div>

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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
