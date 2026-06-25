"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Pencil,
  FolderOpen, UserRound, ArrowDownCircle, CalendarClock, CheckCircle2,
  Receipt, AlertTriangle, Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComboBox } from "@/components/ui/combobox";
import {
  getHonorariosWithProcesso, getProcessos, getClientes,
  createHonorario, updateHonorario, deleteHonorario,
  getContasEscritorio, createContaEscritorio, updateContaEscritorio, deleteContaEscritorio,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Honorario, Processo, Cliente, ContaEscritorio } from "@/types";

const honorarioTipoOptions = [
  { value: "contratual", label: "Contratual" },
  { value: "sucumbencial", label: "Sucumbencial" },
  { value: "exito", label: "Êxito" },
  { value: "outro", label: "Outro" },
];

const tipoLabel: Record<string, string> = {
  contratual: "Contratual",
  sucumbencial: "Sucumbencial",
  exito: "Êxito",
  outro: "Outro",
};

type HonorarioFull = Honorario & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> };

const contaCategoriaOptions = [
  { value: "aluguel", label: "Aluguel" },
  { value: "condominio", label: "Condomínio" },
  { value: "internet", label: "Internet" },
  { value: "telefone", label: "Telefone" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Água" },
  { value: "software", label: "Software" },
  { value: "contador", label: "Contador" },
  { value: "tributos", label: "Tributos" },
  { value: "marketing", label: "Marketing" },
  { value: "material", label: "Material de escritório" },
  { value: "servicos", label: "Serviços" },
  { value: "outro", label: "Outro" },
];

const contaCategoriaLabel = Object.fromEntries(contaCategoriaOptions.map((opt) => [opt.value, opt.label]));

interface ProcInfo { numero: string; clienteNome: string; clienteId?: string; }

interface Grupo extends ProcInfo {
  processoId: string;
  cobrado: number;
  recebido: number;
  saldo: number;
  itens: HonorarioFull[];
}

interface ModalState {
  editing: Honorario | null;
  processoId: string;
  categoria: "cobranca" | "pagamento";
}

interface ContaModalState {
  editing: ContaEscritorio | null;
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function isThisMonth(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isBeforeToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function splitValor(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const arr = Array(n).fill(base);
  const rem = cents - base * n;
  for (let i = 0; i < rem; i++) arr[i] += 1;
  return arr.map((c) => c / 100);
}

export default function FinanceiroPage() {
  const [honorarios, setHonorarios] = useState<HonorarioFull[]>([]);
  const [contas, setContas] = useState<ContaEscritorio[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [contaModal, setContaModal] = useState<ContaModalState | null>(null);
  const [pagandoConta, setPagandoConta] = useState<ContaEscritorio | null>(null);
  const [dataPagamentoConta, setDataPagamentoConta] = useState(todayISO());
  const [recebendo, setRecebendo] = useState<HonorarioFull | null>(null);
  const [dataRecebida, setDataRecebida] = useState(todayISO());

  const load = useCallback(async () => {
    const [hon, procs, cls, contasEsc] = await Promise.all([
      getHonorariosWithProcesso(),
      getProcessos(),
      getClientes(),
      getContasEscritorio(),
    ]);
    setHonorarios(hon);
    setProcessos(procs);
    setClientes(cls);
    setContas(contasEsc);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCobrado = honorarios.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
  const totalPago = honorarios.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
  const saldoDevedor = Math.max(0, totalCobrado - totalPago);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const recebidoMes = honorarios
    .filter((h) => h.categoria === "pagamento" && h.data_recebimento && new Date(h.data_recebimento) >= inicioMes)
    .reduce((s, h) => s + h.valor, 0);

  const clienteIdPorNome = new Map(clientes.map((c) => [c.nome.toLowerCase().trim(), c.id]));
  const procInfo = new Map<string, ProcInfo>(
    processos.map((p) => [p.id, {
      numero: p.numero,
      clienteNome: p.cliente_nome,
      clienteId: p.cliente_id ?? clienteIdPorNome.get((p.cliente_nome ?? "").toLowerCase().trim()),
    }])
  );

  // Recebíveis do mês: cobranças com vencimento neste mês ainda não recebidas
  const aReceberMes = honorarios
    .filter((h) => h.categoria === "cobranca" && h.status !== "recebido" && h.status !== "cancelado" && isThisMonth(h.data_vencimento))
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const totalReceberMes = aReceberMes.reduce((s, h) => s + h.valor, 0);

  const contasPendentes = contas.filter((c) => c.status === "pendente");
  const contasVencidas = contasPendentes.filter((c) => isBeforeToday(c.data_vencimento));
  const contasMes = contasPendentes.filter((c) => isThisMonth(c.data_vencimento));
  const contasPagasMes = contas.filter((c) => c.status === "paga" && isThisMonth(c.data_pagamento));
  const totalContasPendentes = contasPendentes.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalContasVencidas = contasVencidas.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalContasMes = contasMes.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalContasPagasMes = contasPagasMes.reduce((s, c) => s + Number(c.valor || 0), 0);
  const contasOrdenadas = [...contas].sort((a, b) => {
    const priority = (c: ContaEscritorio) => {
      if (c.status === "pendente" && isBeforeToday(c.data_vencimento)) return 0;
      if (c.status === "pendente") return 1;
      if (c.status === "paga") return 2;
      return 3;
    };
    const p = priority(a) - priority(b);
    if (p !== 0) return p;
    return (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "");
  });

  const grupos: Grupo[] = processos
    .map((proc) => {
      const itens = honorarios
        .filter((h) => h.processo_id === proc.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (itens.length === 0) return null;
      const cobrado = itens.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
      const recebido = itens.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
      const info = procInfo.get(proc.id)!;
      return { processoId: proc.id, ...info, cobrado, recebido, saldo: cobrado - recebido, itens } as Grupo;
    })
    .filter((g): g is Grupo => g !== null)
    .sort((a, b) => b.saldo - a.saldo);

  async function handleDelete(h: Honorario) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await deleteHonorario(h.id);
    await load();
  }

  async function marcarRecebido(h: HonorarioFull, dataRec: string) {
    const quando = dataRec || todayISO();
    await updateHonorario(h.id, { status: "recebido", data_recebimento: quando });
    await createHonorario({
      processo_id: h.processo_id,
      descricao: `Recebimento — ${h.descricao}`,
      valor: h.valor,
      categoria: "pagamento",
      status: "recebido",
      data_recebimento: quando,
    });
    await load();
  }

  async function handleDeleteConta(conta: ContaEscritorio) {
    if (!window.confirm("Excluir esta conta do escritório?")) return;
    await deleteContaEscritorio(conta.id);
    await load();
  }

  async function marcarContaPaga(conta: ContaEscritorio, dataPagamento: string) {
    await updateContaEscritorio(conta.id, {
      status: "paga",
      data_pagamento: dataPagamento || todayISO(),
    });
    await load();
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Honorários, recebíveis e parcelas</p>
        </div>
        <Button onClick={() => setModal({ editing: null, processoId: "", categoria: "cobranca" })}>
          <Plus className="w-4 h-4" /> Novo lançamento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-white" />} dark label="Total Cobrado" value={formatCurrency(totalCobrado)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Total Recebido" value={formatCurrency(totalPago)} />
        <SummaryCard icon={<TrendingDown className="w-5 h-5 text-amber-600" />} label="Saldo a Receber" value={formatCurrency(saldoDevedor)} />
        <SummaryCard icon={<CalendarClock className="w-5 h-5 text-blue-600" />} label="A receber este mês" value={formatCurrency(totalReceberMes)} highlight />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-gray-600" />} label="Recebido este mês" value={formatCurrency(recebidoMes)} />
      </div>

      {/* Recebíveis do mês */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-blue-50/50 px-5 py-3">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-gray-900">A receber este mês</h2>
          {aReceberMes.length > 0 && (
            <Badge variant="neutral">{aReceberMes.length} parcela{aReceberMes.length !== 1 ? "s" : ""} · {formatCurrency(totalReceberMes)}</Badge>
          )}
        </div>
        {aReceberMes.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Nenhuma parcela vencendo este mês. Defina o vencimento ao lançar uma cobrança.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {aReceberMes.map((h) => {
              const info = procInfo.get(h.processo_id);
              const venc = new Date((h.data_vencimento ?? "") + "T00:00:00");
              const vencida = !isNaN(venc.getTime()) && venc < new Date(new Date().toDateString());
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50/50 sm:flex-nowrap">
                  <div className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg ${vencida ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{h.descricao}</p>
                    <p className="text-xs text-gray-400">
                      {info?.clienteNome ?? h.processo?.cliente_nome ?? "—"}
                      {" · vence "}{formatDate(h.data_vencimento)}
                      {vencida && <span className="ml-1 font-semibold text-red-600">(vencida)</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900">{formatCurrency(h.valor)}</span>
                  <Button size="sm" onClick={() => { setRecebendo(h); setDataRecebida(todayISO()); }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Recebido
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-[#2a2027]/[0.04] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2a2027] text-white">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Contas do escritório</h2>
              <p className="text-xs text-gray-500">Aluguel, sistemas, contador e despesas fixas</p>
            </div>
          </div>
          <Button onClick={() => setContaModal({ editing: null })}>
            <Plus className="w-4 h-4" /> Nova conta
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-b border-gray-100 px-5 py-4 md:grid-cols-4">
          <MiniMetric label="Pendente" value={formatCurrency(totalContasPendentes)} icon={<Wallet className="w-4 h-4" />} />
          <MiniMetric label="Vencidas" value={formatCurrency(totalContasVencidas)} icon={<AlertTriangle className="w-4 h-4" />} danger={contasVencidas.length > 0} />
          <MiniMetric label="Este mês" value={formatCurrency(totalContasMes)} icon={<CalendarClock className="w-4 h-4" />} />
          <MiniMetric label="Pagas no mês" value={formatCurrency(totalContasPagasMes)} icon={<CheckCircle2 className="w-4 h-4" />} />
        </div>

        {contasOrdenadas.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm font-medium text-gray-600">Nenhuma conta cadastrada ainda</p>
            <p className="mt-1 text-xs text-gray-400">Cadastre as contas que o escritório precisa pagar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {contasOrdenadas.map((conta) => {
              const vencida = conta.status === "pendente" && isBeforeToday(conta.data_vencimento);
              const paga = conta.status === "paga";
              return (
                <li key={conta.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50/60">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${vencida ? "bg-red-50 text-red-600" : paga ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-600"}`}>
                    {paga ? <CheckCircle2 className="h-4 w-4" /> : vencida ? <AlertTriangle className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{conta.descricao}</p>
                      <Badge variant={paga ? "success" : vencida ? "danger" : "neutral"}>
                        {paga ? "paga" : vencida ? "vencida" : "pendente"}
                      </Badge>
                      {conta.recorrente && <Badge variant="neutral">recorrente</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {contaCategoriaLabel[conta.categoria] ?? conta.categoria}
                      {" · vence "}{formatDate(conta.data_vencimento)}
                      {conta.data_pagamento && ` · paga em ${formatDate(conta.data_pagamento)}`}
                    </p>
                  </div>
                  <span className="ml-12 w-full text-sm font-black tabular-nums text-gray-900 sm:ml-0 sm:w-auto sm:shrink-0">{formatCurrency(Number(conta.valor || 0))}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {conta.status === "pendente" && (
                      <Button size="sm" onClick={() => { setPagandoConta(conta); setDataPagamentoConta(todayISO()); }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pagar
                      </Button>
                    )}
                    <button onClick={() => setContaModal({ editing: conta })} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteConta(conta)} title="Excluir" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {grupos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <DollarSign className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum honorário lançado ainda</p>
            <Button className="mt-4" onClick={() => setModal({ editing: null, processoId: "", categoria: "cobranca" })}>
              <Plus className="w-4 h-4" /> Lançar primeira cobrança
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <Card key={g.processoId}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {g.clienteId ? (
                      <Link href={`/dashboard/clientes/${g.clienteId}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 hover:text-blue-600">
                        <UserRound className="w-3.5 h-3.5 text-gray-400" /> {g.clienteNome}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900"><UserRound className="w-3.5 h-3.5 text-gray-400" /> {g.clienteNome}</span>
                    )}
                    <Link href={`/dashboard/processos/${g.processoId}`} className="inline-flex items-center gap-1.5 text-xs tabular-nums text-gray-500 hover:text-blue-600">
                      <FolderOpen className="w-3.5 h-3.5 text-gray-400" /> {g.numero}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    <span>Cobrado: <strong className="text-gray-700">{formatCurrency(g.cobrado)}</strong></span>
                    <span>Recebido: <strong className="text-green-700">{formatCurrency(g.recebido)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-1">
                    <p className={`text-sm font-black tabular-nums ${g.saldo > 0 ? "text-amber-600" : "text-green-700"}`}>{formatCurrency(Math.max(0, g.saldo))}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{g.saldo > 0 ? "a receber" : "quitado"}</p>
                  </div>
                  {g.saldo > 0 && (
                    <Button size="sm" onClick={() => setModal({ editing: null, processoId: g.processoId, categoria: "pagamento" })}>
                      <ArrowDownCircle className="w-3.5 h-3.5" /> Receber
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setModal({ editing: null, processoId: g.processoId, categoria: "cobranca" })}>
                    <Plus className="w-3.5 h-3.5" /> Cobrança
                  </Button>
                </div>
              </div>

              <ul className="divide-y divide-gray-50">
                {g.itens.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50/50 sm:flex-nowrap">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${h.categoria === "pagamento" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                      {h.categoria === "pagamento" ? <ArrowDownCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {h.descricao}
                        {h.categoria === "cobranca" && h.status === "recebido" && (
                          <span className="ml-2 align-middle text-[10px] font-semibold text-green-600">✓ recebida</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {h.categoria === "pagamento" ? "Recebimento" : `Cobrança${h.tipo ? ` · ${tipoLabel[h.tipo] ?? h.tipo}` : ""}`}
                        {h.categoria === "cobranca" && h.data_vencimento && ` · vence ${formatDate(h.data_vencimento)}`}
                        {h.categoria === "pagamento" && ` · ${formatDate(h.data_recebimento ?? h.created_at)}`}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold tabular-nums ${h.categoria === "pagamento" ? "text-green-700" : "text-gray-900"}`}>
                      {h.categoria === "pagamento" ? "+" : ""}{formatCurrency(h.valor)}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button onClick={() => setModal({ editing: h, processoId: h.processo_id, categoria: h.categoria })} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(h)} title="Excluir" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <HonorarioModal
          state={modal}
          processos={processos}
          onClose={() => setModal(null)}
          onSaved={() => { load(); setModal(null); }}
        />
      )}

      {contaModal && (
        <ContaEscritorioModal
          state={contaModal}
          onClose={() => setContaModal(null)}
          onSaved={() => { load(); setContaModal(null); }}
        />
      )}

      {pagandoConta && (
        <Modal open onClose={() => setPagandoConta(null)} title="Confirmar pagamento" size="sm">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">{pagandoConta.descricao}</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(pagandoConta.valor || 0))}</p>
            </div>
            <Input
              label="Quando você pagou? *"
              type="date"
              value={dataPagamentoConta}
              onChange={(e) => setDataPagamentoConta(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPagandoConta(null)}>Cancelar</Button>
              <Button
                onClick={async () => { const conta = pagandoConta; setPagandoConta(null); await marcarContaPaga(conta, dataPagamentoConta); }}
                disabled={!dataPagamentoConta}
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar pagamento
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {recebendo && (
        <Modal open onClose={() => setRecebendo(null)} title="Confirmar recebimento" size="sm">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">{recebendo.descricao}</p>
              <p className="text-sm font-bold text-green-700">{formatCurrency(recebendo.valor)}</p>
            </div>
            <Input
              label="Quando você recebeu? *"
              type="date"
              value={dataRecebida}
              onChange={(e) => setDataRecebida(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRecebendo(null)}>Cancelar</Button>
              <Button
                onClick={async () => { const h = recebendo; setRecebendo(null); await marcarRecebido(h, dataRecebida); }}
                disabled={!dataRecebida}
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar recebimento
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ icon, dark, highlight, label, value }: { icon: React.ReactNode; dark?: boolean; highlight?: boolean; label: string; value: string }) {
  return (
    <Card className={dark ? "bg-[#21181d] border-[#2b2027]" : highlight ? "border-blue-200 bg-blue-50/40" : ""}>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${dark ? "bg-white/10" : "bg-white"} flex items-center justify-center mb-2 border ${dark ? "border-white/10" : "border-gray-100"}`}>{icon}</div>
        <p className={`text-xs font-black tracking-tight tabular-nums sm:text-sm ${dark ? "text-white" : "text-gray-900"}`}>{value}</p>
        <p className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${danger ? "border-red-100 bg-red-50" : "border-gray-100 bg-white"}`}>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${danger ? "text-red-600" : "text-gray-500"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-sm font-black tabular-nums ${danger ? "text-red-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function ContaEscritorioModal({
  state, onClose, onSaved,
}: {
  state: ContaModalState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state.editing;
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [valor, setValor] = useState(editing ? String(editing.valor) : "");
  const [categoria, setCategoria] = useState<ContaEscritorio["categoria"]>(editing?.categoria ?? "outro");
  const [status, setStatus] = useState<ContaEscritorio["status"]>(editing?.status ?? "pendente");
  const [vencimento, setVencimento] = useState(editing?.data_vencimento ?? todayISO());
  const [dataPagamento, setDataPagamento] = useState(editing?.data_pagamento ?? "");
  const [formaPagamento, setFormaPagamento] = useState(editing?.forma_pagamento ?? "");
  const [recorrente, setRecorrente] = useState(Boolean(editing?.recorrente));
  const [observacoes, setObservacoes] = useState(editing?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor || !vencimento) return;
    setSaving(true);
    try {
      const payload = {
        descricao,
        valor: parseFloat(valor),
        categoria,
        status,
        data_vencimento: vencimento,
        data_pagamento: status === "paga" ? (dataPagamento || todayISO()) : undefined,
        forma_pagamento: formaPagamento || undefined,
        recorrente,
        observacoes: observacoes || undefined,
      };

      if (editing) {
        await updateContaEscritorio(editing.id, payload);
      } else {
        await createContaEscritorio(payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Editar conta do escritório" : "Nova conta do escritório"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Descrição *"
          placeholder="Ex: Aluguel, contador, certificado digital"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Valor (R$) *"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <Input
            label="Vencimento *"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Categoria"
            options={contaCategoriaOptions}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as ContaEscritorio["categoria"])}
          />
          <Select
            label="Status"
            options={[
              { value: "pendente", label: "Pendente" },
              { value: "paga", label: "Paga" },
              { value: "cancelada", label: "Cancelada" },
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value as ContaEscritorio["status"])}
          />
        </div>
        {status === "paga" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Data do pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
            <Input
              label="Forma de pagamento"
              placeholder="Pix, boleto, cartão..."
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            />
          </div>
        )}
        <label className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={recorrente}
            onChange={(e) => setRecorrente(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Conta recorrente
        </label>
        <Textarea
          label="Observações"
          placeholder="Notas internas, link do boleto, competência..."
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!descricao || !valor || !vencimento || saving}>
            {saving ? "Salvando..." : "Salvar conta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HonorarioModal({
  state, processos, onClose, onSaved,
}: {
  state: ModalState;
  processos: Processo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state.editing;
  const [processoId, setProcessoId] = useState(editing?.processo_id ?? state.processoId);
  const [categoria, setCategoria] = useState<"cobranca" | "pagamento">(editing?.categoria ?? state.categoria);
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [valor, setValor] = useState(editing ? String(editing.valor) : "");
  const [tipo, setTipo] = useState(editing?.tipo ?? "");
  const [vencimento, setVencimento] = useState(editing?.data_vencimento ?? "");
  const [parcelas, setParcelas] = useState("1");
  const [entrada, setEntrada] = useState("");
  const [data, setData] = useState(editing?.data_recebimento ?? editing?.data_lancamento ?? todayISO());
  const [saving, setSaving] = useState(false);

  const isPagamento = categoria === "pagamento";
  const nParcelas = Math.max(1, Math.min(60, parseInt(parcelas) || 1));
  const podeParcelar = !isPagamento;
  const totalVal = parseFloat(valor) || 0;
  const entradaVal = editing ? 0 : (parseFloat(entrada) || 0);
  const restanteVal = Math.max(0, Math.round((totalVal - entradaVal) * 100) / 100);
  const valorParcela = restanteVal > 0 ? restanteVal / nParcelas : 0;
  const qtdLanc = (entradaVal > 0 ? 1 : 0) + (restanteVal > 0 ? nParcelas : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor || !processoId) return;
    setSaving(true);
    try {
      if (!editing && !isPagamento) {
        // Nova cobrança: entrada (opcional) + parcelas do restante, com vencimentos mensais.
        const base = descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim() || "Honorários";
        const hoje = todayISO();
        const lanc: { descricao: string; valor: number; venc?: string }[] = [];
        if (entradaVal > 0) lanc.push({ descricao: `${base} — Entrada`, valor: entradaVal, venc: hoje });
        if (restanteVal > 0) {
          const valores = splitValor(restanteVal, nParcelas);
          for (let i = 0; i < nParcelas; i++) {
            lanc.push({
              descricao: nParcelas > 1 ? `${base} (${i + 1}/${nParcelas})` : base,
              valor: valores[i],
              venc: vencimento ? addMonthsISO(vencimento, i) : undefined,
            });
          }
        }
        for (const l of lanc) {
          await createHonorario({
            processo_id: processoId,
            descricao: l.descricao,
            valor: l.valor,
            tipo: (tipo || undefined) as Honorario["tipo"],
            categoria: "cobranca",
            status: "pendente",
            data_lancamento: hoje,
            data_vencimento: l.venc,
          });
        }
      } else if (editing && podeParcelar && nParcelas > 1) {
        // Ao editar, transformar em N parcelas com vencimentos mensais.
        const valores = splitValor(parseFloat(valor), nParcelas);
        const base = descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim() || "Parcela";
        const lancamento = editing.data_lancamento ?? todayISO();
        await updateHonorario(editing.id, {
          descricao: `${base} (1/${nParcelas})`,
          valor: valores[0],
          tipo: (tipo || undefined) as Honorario["tipo"],
          categoria: "cobranca",
          status: "pendente",
          data_lancamento: lancamento,
          data_recebimento: undefined,
          data_vencimento: vencimento ? addMonthsISO(vencimento, 0) : undefined,
        });
        for (let i = 1; i < nParcelas; i++) {
          await createHonorario({
            processo_id: processoId,
            descricao: `${base} (${i + 1}/${nParcelas})`,
            valor: valores[i],
            tipo: (tipo || undefined) as Honorario["tipo"],
            categoria: "cobranca",
            status: "pendente",
            data_lancamento: lancamento,
            data_vencimento: vencimento ? addMonthsISO(vencimento, i) : undefined,
          });
        }
      } else if (editing) {
        await updateHonorario(editing.id, {
          processo_id: processoId,
          descricao,
          valor: parseFloat(valor),
          tipo: (tipo || undefined) as Honorario["tipo"],
          categoria,
          status: (isPagamento ? "recebido" : (editing.status ?? "pendente")) as Honorario["status"],
          data_lancamento: !isPagamento ? (data || undefined) : undefined,
          data_recebimento: isPagamento ? (data || undefined) : undefined,
          data_vencimento: !isPagamento ? (vencimento || undefined) : undefined,
        });
      } else {
        await createHonorario({
          processo_id: processoId,
          descricao,
          valor: parseFloat(valor),
          tipo: (tipo || undefined) as Honorario["tipo"],
          categoria,
          status: (isPagamento ? "recebido" : "pendente") as Honorario["status"],
          data_lancamento: !isPagamento ? (data || undefined) : undefined,
          data_recebimento: isPagamento ? (data || undefined) : undefined,
          data_vencimento: !isPagamento ? (vencimento || undefined) : undefined,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const title = editing ? "Editar lançamento" : isPagamento ? "Registrar recebimento" : "Nova cobrança";

  return (
    <Modal open onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Tipo de lançamento *"
          options={[
            { value: "cobranca", label: "Cobrança (valor que você cobrou)" },
            { value: "pagamento", label: "Recebimento (valor que entrou)" },
          ]}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as "cobranca" | "pagamento")}
        />
        <ComboBox
          label="Processo *"
          options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))}
          placeholder="Selecione o processo..."
          value={processoId}
          onChange={setProcessoId}
        />
        <Input
          label="Descrição *"
          placeholder={isPagamento ? "Ex: Entrada / parcela 1" : "Ex: Honorários contratuais"}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={podeParcelar && (nParcelas > 1 || entradaVal > 0) ? "Valor total (R$) *" : "Valor (R$) *"}
            type="number" min="0" step="0.01" inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          {isPagamento ? (
            <Input label="Data do recebimento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          ) : (
            <Select label="Tipo" options={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          )}
        </div>

        {!isPagamento && (
          <>
            {!editing && (
              <Input label="Entrada (R$)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="opcional" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={nParcelas > 1 ? "1º vencimento das parcelas" : "Vencimento"} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              <Input label="Parcelas (x)" type="number" min="1" max="60" step="1" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </div>
          </>
        )}

        {!isPagamento && valor && (entradaVal > 0 || nParcelas > 1) && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {[
              entradaVal > 0 ? `Entrada de ${formatCurrency(entradaVal)} (hoje)` : "",
              restanteVal > 0 ? `${nParcelas}x de aprox. ${formatCurrency(valorParcela)}${vencimento ? ` a partir de ${formatDate(vencimento)}` : ""}` : "",
            ].filter(Boolean).join(" + ")}
          </p>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!processoId || !descricao || !valor || saving}>
            {saving ? "Salvando..." : editing ? "Salvar alterações" : qtdLanc > 1 ? `Lançar ${qtdLanc} lançamentos` : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
