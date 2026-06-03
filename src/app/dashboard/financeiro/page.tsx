"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, Plus, CheckCircle, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { getHonorariosWithProcesso, getProcessos, createHonorario, deleteHonorario } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Honorario, Processo } from "@/types";

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

export default function FinanceiroPage() {
  const [honorarios, setHonorarios] = useState<(Honorario & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"todos" | "cobrancas" | "pagamentos">("todos");

  const load = useCallback(async () => {
    const data = await getHonorariosWithProcesso();
    setHonorarios(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = honorarios.filter((h) => {
    if (filter === "cobrancas") return h.categoria === "cobranca";
    if (filter === "pagamentos") return h.categoria === "pagamento";
    return true;
  });

  const totalCobrado = honorarios.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
  const totalPago = honorarios.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
  const saldoDevedor = Math.max(0, totalCobrado - totalPago);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const recebidoMes = honorarios
    .filter((h) => h.categoria === "pagamento" && h.data_recebimento && new Date(h.data_recebimento) >= inicioMes)
    .reduce((s, h) => s + h.valor, 0);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Controle de honorários</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Novo Honorário
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-gray-700" />} bg="bg-gray-900" label="Total Cobrado" value={formatCurrency(totalCobrado)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-gray-600" />} bg="bg-gray-100" label="Total Recebido" value={formatCurrency(totalPago)} />
        <SummaryCard icon={<TrendingDown className="w-5 h-5 text-gray-600" />} bg="bg-gray-100" label="Saldo Devedor" value={formatCurrency(saldoDevedor)} />
        <SummaryCard icon={<TrendingUp className="w-5 h-5 text-gray-600" />} bg="bg-gray-100" label="Recebido este Mês" value={formatCurrency(recebidoMes)} />
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(["todos", "cobrancas", "pagamentos"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {f === "todos" ? "Todos" : f === "cobrancas" ? "Cobranças" : "Pagamentos"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <DollarSign className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum honorário encontrado</p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-6 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Processo / Cliente</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-gray-900">{h.descricao}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-700 text-xs">{h.processo?.cliente_nome ?? "—"}</p>
                    <p className="text-gray-400 text-xs font-mono">{h.processo?.numero ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{h.tipo ? tipoLabel[h.tipo] : "—"}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">
                    {h.data_recebimento ? formatDate(h.data_recebimento) : h.data_lancamento ? formatDate(h.data_lancamento) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-bold ${h.categoria === "pagamento" ? "text-green-700" : "text-blue-700"}`}>
                      {formatCurrency(h.valor)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {h.categoria === "pagamento" ? (
                      <Badge variant="success"><CheckCircle className="w-3 h-3" /> Pagamento</Badge>
                    ) : (
                      <Badge variant="default">Cobrança</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={async () => { await deleteHonorario(h.id); load(); }} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NovoHonorarioModal open={showModal} onClose={() => setShowModal(false)} onCreated={() => { load(); setShowModal(false); }} />
    </div>
  );
}

function SummaryCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: string; textColor?: string }) {
  const isDark = bg === "bg-gray-900";
  return (
    <Card className={isDark ? "bg-gray-900 border-gray-800" : ""}>
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-xl ${isDark ? "bg-white/10" : bg} flex items-center justify-center mb-3`}>{icon}</div>
        <p className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
        <p className={`text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      </CardContent>
    </Card>
  );
}

function NovoHonorarioModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoria, setCategoria] = useState<"cobranca" | "pagamento">("cobranca");
  const [data, setData] = useState("");

  useEffect(() => { if (open) getProcessos().then(setProcessos); }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor || !processoId) return;
    await createHonorario({
      processo_id: processoId,
      descricao,
      valor: parseFloat(valor),
      tipo: tipo as any || undefined,
      categoria,
      status: categoria === "pagamento" ? "recebido" : "pendente",
      data_lancamento: categoria === "cobranca" ? (data || undefined) : undefined,
      data_recebimento: categoria === "pagamento" ? (data || undefined) : undefined,
    });
    setDescricao(""); setValor(""); setTipo(""); setCategoria("cobranca"); setData(""); setProcessoId("");
    onCreated();
  }

  const isPagamento = categoria === "pagamento";

  return (
    <Modal open={open} onClose={onClose} title={isPagamento ? "Registrar Pagamento" : "Nova Cobrança"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Categoria *"
          options={[{ value: "cobranca", label: "Cobrança (valor cobrado do cliente)" }, { value: "pagamento", label: "Pagamento (valor recebido)" }]}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as "cobranca" | "pagamento")}
        />
        <ComboBox label="Processo *" options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))} placeholder="Selecione o processo..." value={processoId} onChange={setProcessoId} />
        <Input label="Descrição *" placeholder={isPagamento ? "Ex: Pagamento parcela 1" : "Ex: Honorários contratuais"} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor (R$) *" type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          {!isPagamento && (
            <Select label="Tipo" options={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          )}
          {isPagamento && (
            <Input label="Data de Recebimento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          )}
        </div>
        {!isPagamento && (
          <Input label="Data de Lançamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!processoId || !descricao || !valor}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
