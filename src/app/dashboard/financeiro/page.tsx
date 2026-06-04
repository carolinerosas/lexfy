"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Pencil,
  FolderOpen, UserRound, ArrowDownCircle,
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

interface Grupo {
  processoId: string;
  numero: string;
  clienteNome: string;
  clienteId?: string;
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

  // Resolve cliente id por nome (para o link do cliente)
  const clienteIdPorNome = new Map(clientes.map((c) => [c.nome.toLowerCase().trim(), c.id]));

  // Agrupa por processo
  const grupos: Grupo[] = processos
    .map((proc) => {
      const itens = honorarios
        .filter((h) => h.processo_id === proc.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (itens.length === 0) return null;
      const cobrado = itens.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
      const recebido = itens.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
      return {
        processoId: proc.id,
        numero: proc.numero,
        clienteNome: proc.cliente_nome,
        clienteId: proc.cliente_id ?? clienteIdPorNome.get((proc.cliente_nome ?? "").toLowerCase().trim()),
        cobrado,
        recebido,
        saldo: cobrado - recebido,
        itens,
      } as Grupo;
    })
    .filter((g): g is Grupo => g !== null)
    .sort((a, b) => b.saldo - a.saldo);

  async function handleDelete(h: Honorario) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await deleteHonorario(h.id);
    await load();
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Honorários por cliente e processo</p>
        </div>
        <Button onClick={() => setModal({ editing: null, processoId: "", categoria: "cobranca" })}>
          <Plus className="w-4 h-4" /> Novo lançamento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-white" />} dark label="Total Cobrado" value={formatCurrency(totalCobrado)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Total Recebido" value={formatCurrency(totalPago)} />
        <SummaryCard icon={<TrendingDown className="w-5 h-5 text-amber-600" />} label="Saldo a Receber" value={formatCurrency(saldoDevedor)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-gray-600" />} label="Recebido este Mês" value={formatCurrency(recebidoMes)} />
      </div>

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
              {/* Cabeçalho do grupo */}
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

              {/* Lançamentos do grupo */}
              <ul className="divide-y divide-gray-50">
                {g.itens.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${h.categoria === "pagamento" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                      {h.categoria === "pagamento" ? <ArrowDownCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{h.descricao}</p>
                      <p className="text-xs text-gray-400">
                        {h.categoria === "pagamento" ? "Recebimento" : `Cobrança${h.tipo ? ` · ${tipoLabel[h.tipo] ?? h.tipo}` : ""}`}
                        {" · "}
                        {formatDate(h.data_recebimento ?? h.data_lancamento ?? h.created_at)}
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

function SummaryCard({ icon, dark, label, value }: { icon: React.ReactNode; dark?: boolean; label: string; value: string }) {
  return (
    <Card className={dark ? "bg-[#21181d] border-[#2b2027]" : ""}>
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-xl ${dark ? "bg-white/10" : "bg-gray-100"} flex items-center justify-center mb-3`}>{icon}</div>
        <p className={`text-xl font-black tracking-tight tabular-nums ${dark ? "text-white" : "text-gray-900"}`}>{value}</p>
        <p className={`text-sm mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      </CardContent>
    </Card>
  );
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
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
  const [data, setData] = useState(
    editing?.data_recebimento ?? editing?.data_lancamento ?? todayISO()
  );
  const [saving, setSaving] = useState(false);

  const isPagamento = categoria === "pagamento";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor || !processoId) return;
    setSaving(true);
    try {
      const payload = {
        processo_id: processoId,
        descricao,
        valor: parseFloat(valor),
        tipo: (tipo || undefined) as Honorario["tipo"],
        categoria,
        status: (isPagamento ? "recebido" : "pendente") as Honorario["status"],
        data_lancamento: !isPagamento ? (data || undefined) : undefined,
        data_recebimento: isPagamento ? (data || undefined) : undefined,
      };
      if (editing) await updateHonorario(editing.id, payload);
      else await createHonorario(payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const title = editing
    ? "Editar lançamento"
    : isPagamento ? "Registrar recebimento" : "Nova cobrança";

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
          <Input label="Valor (R$) *" type="number" min="0" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
          {isPagamento ? (
            <Input label="Data do recebimento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          ) : (
            <Select label="Tipo" options={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          )}
        </div>
        {!isPagamento && (
          <Input label="Data do lançamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        )}
        <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-2 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!processoId || !descricao || !valor || saving}>
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
