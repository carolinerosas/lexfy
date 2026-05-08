"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, CheckCircle, Trash2, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getAudienciasWithProcesso, getProcessos, createAudiencia, updateAudiencia, deleteAudiencia } from "@/lib/store";
import { formatDate, formatDateTime, daysUntil } from "@/lib/utils";
import type { Audiencia, Processo } from "@/types";

const audienciaTipoOptions = [
  { value: "instrucao", label: "Instrução" },
  { value: "conciliacao", label: "Conciliação" },
  { value: "julgamento", label: "Julgamento" },
  { value: "una", label: "Una" },
  { value: "outro", label: "Outro" },
];

const tipoLabel: Record<string, string> = {
  instrucao: "Instrução",
  conciliacao: "Conciliação",
  julgamento: "Julgamento",
  una: "Una",
  outro: "Outro",
};

export default function AudienciasPage() {
  const [audiencias, setAudiencias] = useState<(Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"proximas" | "realizadas" | "todas">("proximas");

  const load = useCallback(() => {
    setAudiencias(
      getAudienciasWithProcesso().sort(
        (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      )
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const filtered = audiencias.filter((a) => {
    if (filter === "proximas") return !a.realizada && new Date(a.data_hora) >= now;
    if (filter === "realizadas") return a.realizada;
    return true;
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audiências</h1>
          <p className="text-gray-500 text-sm mt-1">
            {audiencias.filter((a) => !a.realizada).length} aguardando realização
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Nova Audiência
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(["proximas", "todas", "realizadas"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {f === "proximas" ? "Próximas" : f === "realizadas" ? "Realizadas" : "Todas"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Calendar className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhuma audiência encontrada</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const days = daysUntil(a.data_hora);
            const isToday = days === 0;
            const isPast = days < 0;
            return (
              <Card key={a.id} className={`transition-all ${a.realizada ? "opacity-60" : isToday ? "ring-2 ring-gray-400" : ""}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    {/* Date badge */}
                    <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center ${a.realizada ? "bg-gray-100" : isToday ? "bg-gray-900" : isPast ? "bg-red-50" : "bg-gray-100"}`}>
                      <span className={`text-lg font-bold leading-none ${a.realizada ? "text-gray-400" : isToday ? "text-white" : isPast ? "text-red-600" : "text-gray-900"}`}>
                        {new Date(a.data_hora).getDate()}
                      </span>
                      <span className={`text-xs font-medium ${a.realizada ? "text-gray-400" : isToday ? "text-gray-400" : isPast ? "text-red-400" : "text-gray-500"}`}>
                        {new Date(a.data_hora).toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${a.realizada ? "line-through text-gray-400" : "text-gray-900"}`}>{a.titulo}</p>
                        {a.tipo && <Badge variant="neutral">{tipoLabel[a.tipo] ?? a.tipo}</Badge>}
                        {isToday && !a.realizada && <Badge variant="default">Hoje</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{a.processo?.cliente_nome ?? "—"} · {a.processo?.numero ?? "—"}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{formatDateTime(a.data_hora).split(" ")[1]}h</span>
                        {a.local && <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin className="w-3 h-3" />{a.local}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { updateAudiencia(a.id, { realizada: !a.realizada }); load(); }}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${a.realizada ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}
                        title={a.realizada ? "Marcar como não realizada" : "Marcar como realizada"}
                      >
                        {a.realizada && <CheckCircle className="w-4 h-4 text-white" />}
                      </button>
                      <button onClick={() => { deleteAudiencia(a.id); load(); }} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NovaAudienciaModal open={showModal} onClose={() => setShowModal(false)} onCreated={() => { load(); setShowModal(false); }} />
    </div>
  );
}

function NovaAudienciaModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");

  useEffect(() => { if (open) setProcessos(getProcessos()); }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !dataHora || !processoId) return;
    createAudiencia({ processo_id: processoId, titulo, data_hora: dataHora, local: local || undefined, tipo: tipo as any || undefined, realizada: false });
    setTitulo(""); setDataHora(""); setLocal(""); setTipo(""); setProcessoId("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Audiência" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Select label="Processo *" options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))} placeholder="Selecione o processo..." value={processoId} onChange={(e) => setProcessoId(e.target.value)} />
        <Input label="Título *" placeholder="Ex: Audiência de Instrução" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Select label="Tipo" options={audienciaTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <Input label="Data e Hora *" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
        <Input label="Local" placeholder="Fórum, Sala 3, Zoom..." value={local} onChange={(e) => setLocal(e.target.value)} />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!processoId}>Salvar</Button></div>
      </form>
    </Modal>
  );
}
