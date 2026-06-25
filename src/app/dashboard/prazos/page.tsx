"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Plus, CheckCircle, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { getPrazosWithProcesso, getProcessos, createPrazo, updatePrazo, deletePrazo } from "@/lib/store";
import { formatDate, daysUntil, prazoColor } from "@/lib/utils";
import type { Prazo, Processo } from "@/types";

const prazoTipoOptions = [
  { value: "recurso", label: "Recurso" },
  { value: "contestacao", label: "Contestação" },
  { value: "peticao", label: "Petição" },
  { value: "contrarrazoes", label: "Contrarrazões" },
  { value: "outro", label: "Outro" },
];

export default function PrazosPage() {
  const [prazos, setPrazos] = useState<(Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"pendentes" | "concluidos" | "todos">("pendentes");

  const load = useCallback(async () => {
    const data = await getPrazosWithProcesso();
    setPrazos(data.sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime()));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = prazos.filter((p) => {
    if (filter === "pendentes") return !p.concluido;
    if (filter === "concluidos") return p.concluido;
    return true;
  });

  const vencidos = prazos.filter((p) => !p.concluido && daysUntil(p.data_prazo) < 0).length;
  const proximos = prazos.filter((p) => !p.concluido && daysUntil(p.data_prazo) >= 0 && daysUntil(p.data_prazo) <= 7).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prazos</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {vencidos > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />{vencidos} vencido{vencidos > 1 ? "s" : ""}
              </span>
            )}
            {proximos > 0 && (
              <span className="text-xs text-amber-600 font-medium">{proximos} nos próximos 7 dias</span>
            )}
          </div>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Novo Prazo
        </Button>
      </div>

      <div className="mb-6 flex w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 sm:w-fit">
        {(["pendentes", "todos", "concluidos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {f === "pendentes" ? "Pendentes" : f === "concluidos" ? "Concluídos" : "Todos"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Clock className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum prazo {filter === "pendentes" ? "pendente" : filter === "concluidos" ? "concluído" : ""}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const days = daysUntil(p.data_prazo);
            return (
              <Card key={p.id} className={p.concluido ? "opacity-60" : ""}>
                <CardContent className="py-3.5 px-5">
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                    <button
                      onClick={async () => { await updatePrazo(p.id, { concluido: !p.concluido }); load(); }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${p.concluido ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}
                    >
                      {p.concluido && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`break-words text-sm font-semibold ${p.concluido ? "line-through text-gray-400" : "text-gray-900"}`}>{p.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.processo?.cliente_nome ?? "—"} · <span className="font-mono">{p.processo?.numero ?? "—"}</span>
                        {p.tipo ? ` · ${p.tipo}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      {!p.concluido ? (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${prazoColor(days)}`}>
                          {days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `em ${days}d`}
                        </span>
                      ) : (
                        <Badge variant="success">Concluído</Badge>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(p.data_prazo)}</p>
                    </div>
                    <button onClick={async () => { await deletePrazo(p.id); load(); }} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NovoPrazoModal open={showModal} onClose={() => setShowModal(false)} onCreated={() => { load(); setShowModal(false); }} />
    </div>
  );
}

function NovoPrazoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("");
  const [prioridade, setPrioridade] = useState("media");

  useEffect(() => { if (open) getProcessos().then(setProcessos); }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !data || !processoId) return;
    await createPrazo({ processo_id: processoId, titulo, data_prazo: data, tipo: tipo as any || undefined, prioridade: prioridade as any, concluido: false });
    setTitulo(""); setData(""); setTipo(""); setPrioridade("media"); setProcessoId("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Prazo" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <ComboBox
          label="Processo *"
          options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))}
          placeholder="Selecione o processo..."
          value={processoId}
          onChange={setProcessoId}
        />
        <Input label="Título *" placeholder="Ex: Recurso de Apelação" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Tipo" options={prazoTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <Select label="Prioridade" options={[{ value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }]} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
        <Input label="Data Limite *" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!processoId}>Salvar</Button></div>
      </form>
    </Modal>
  );
}
