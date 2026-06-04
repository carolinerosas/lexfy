"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Pencil,
  FolderOpen, UserRound, ArrowDownCircle, CalendarClock, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import {
  getHonorariosWithProcesso, getProcessos, getClientes,
  createHonorario, updateHonorario, deleteHonorario,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Honorario, Processo, Cliente } from "@/types";

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
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);

  const load = useCallback(async () => {
    const [hon, procs, cls] = await Promise.all([getHonorariosWithProcesso(), getProcessos(), getClientes()]);
    setHonorarios(hon);
    setProcessos(procs);
    setClientes(cls);
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

  async function marcarRecebido(h: HonorarioFull) {
    const hoje = todayISO();
    await updateHonorario(h.id, { status: "recebido", data_recebimento: hoje });
    await createHonorario({
      processo_id: h.processo_id,
      descricao: `Recebimento — ${h.descricao}`,
      valor: h.valor,
      categoria: "pagamento",
      status: "recebido",
      data_recebimento: hoje,
    });
    await load();
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
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
      <Card className="mb-6 overflow-hidden">
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
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
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
                  <span className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(h.valor)}</span>
                  <Button size="sm" onClick={() => marcarRecebido(h)}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Recebido
                  </Button>
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
            <Card key={g.processoId} className="overflow-hidden">
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
                    <p className={`text-base font-black tabular-nums ${g.saldo > 0 ? "text-amber-600" : "text-green-700"}`}>{formatCurrency(Math.max(0, g.saldo))}</p>
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
                  <li key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
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
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${h.categoria === "pagamento" ? "text-green-700" : "text-gray-900"}`}>
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
    </div>
  );
}

function SummaryCard({ icon, dark, highlight, label, value }: { icon: React.ReactNode; dark?: boolean; highlight?: boolean; label: string; value: string }) {
  return (
    <Card className={dark ? "bg-[#21181d] border-[#2b2027]" : highlight ? "border-blue-200 bg-blue-50/40" : ""}>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${dark ? "bg-white/10" : "bg-white"} flex items-center justify-center mb-2 border ${dark ? "border-white/10" : "border-gray-100"}`}>{icon}</div>
        <p className={`text-lg font-black tracking-tight tabular-nums ${dark ? "text-white" : "text-gray-900"}`}>{value}</p>
        <p className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      </CardContent>
    </Card>
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
  const [data, setData] = useState(editing?.data_recebimento ?? editing?.data_lancamento ?? todayISO());
  const [saving, setSaving] = useState(false);

  const isPagamento = categoria === "pagamento";
  const nParcelas = Math.max(1, Math.min(60, parseInt(parcelas) || 1));
  const podeParcelar = !isPagamento;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor || !processoId) return;
    setSaving(true);
    try {
      if (podeParcelar && nParcelas > 1) {
        // Parcelar (cria N parcelas com vencimentos mensais). Vale para nova cobrança ou ao editar.
        const valores = splitValor(parseFloat(valor), nParcelas);
        const base = descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim() || "Parcela";
        const lancamento = editing?.data_lancamento ?? todayISO();
        if (editing) {
          // O lançamento atual vira a 1ª parcela
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
        }
        const inicio = editing ? 1 : 0;
        for (let i = inicio; i < nParcelas; i++) {
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={podeParcelar && nParcelas > 1 ? "Valor total (R$) *" : "Valor (R$) *"}
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
          <div className="grid grid-cols-2 gap-3">
            <Input label={nParcelas > 1 ? "1º vencimento" : "Vencimento"} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            {podeParcelar && (
              <Input label="Parcelas (x)" type="number" min="1" max="60" step="1" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            )}
          </div>
        )}

        {podeParcelar && nParcelas > 1 && valor && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {nParcelas}x de aprox. {formatCurrency((parseFloat(valor) || 0) / nParcelas)} — vencimentos mensais a partir de {vencimento ? formatDate(vencimento) : "—"}.
          </p>
        )}

        <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-2 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!processoId || !descricao || !valor || saving}>
            {saving ? "Salvando..." : editing ? "Salvar alterações" : nParcelas > 1 ? `Lançar ${nParcelas} parcelas` : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
