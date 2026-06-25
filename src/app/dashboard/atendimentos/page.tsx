"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Plus, Trash2, CheckCircle, X, Clock, FileText,
  ChevronRight, Calendar, DollarSign, Search, CalendarPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import {
  getAtendimentosWithProcesso,
  getProcessos,
  getClientes,
  createAtendimento,
  updateAtendimento,
  deleteAtendimento,
  createPrazo,
  createAudiencia,
} from "@/lib/store";
import type { Cliente } from "@/types";
import { formatCurrency, formatDate, formatDateTime, daysUntil } from "@/lib/utils";
import type { Atendimento, AtendimentoStatus, Processo } from "@/types";

const tipoOptions = [
  { value: "consulta_inicial", label: "Consulta Inicial" },
  { value: "retorno", label: "Retorno" },
  { value: "orientacao", label: "Orientação Jurídica" },
  { value: "audiencia_prep", label: "Preparação para Audiência" },
  { value: "outro", label: "Outro" },
];

const tipoLabel: Record<string, string> = {
  consulta_inicial: "Consulta Inicial",
  retorno: "Retorno",
  orientacao: "Orientação",
  audiencia_prep: "Prep. Audiência",
  outro: "Outro",
};

const statusVariant: Record<AtendimentoStatus, "default" | "neutral" | "danger"> = {
  agendado: "default",
  realizado: "neutral",
  cancelado: "danger",
};

const statusLabel: Record<AtendimentoStatus, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export default function AtendimentosPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"agendados" | "realizados" | "todos">("agendados");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const data = await getAtendimentosWithProcesso();
    setAtendimentos(data.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = atendimentos.find((a) => a.id === selectedId) ?? null;

  const filtered = atendimentos.filter((a) => {
    const matchFilter =
      filter === "todos" ? true :
      filter === "agendados" ? a.status === "agendado" :
      a.status === "realizado";
    const matchSearch = !search ||
      a.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      (a.processo?.numero ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.notas ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const agendados = atendimentos.filter((a) => a.status === "agendado").length;
  const proximos7 = atendimentos.filter((a) => {
    const diff = daysUntil(a.data_hora);
    return a.status === "agendado" && diff >= 0 && diff <= 7;
  }).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Atendimentos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {agendados} agendado{agendados !== 1 ? "s" : ""}{proximos7 > 0 ? ` · ${proximos7} nos próximos 7 dias` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowModal(true)}>
            <CalendarPlus className="w-4 h-4" /> Agendar
          </Button>
          <Link href="/dashboard/atendimentos/novo">
            <Button>
              <Plus className="w-4 h-4" /> Iniciar Atendimento
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente, processo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["agendados", "todos", "realizados"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {f === "agendados" ? "Agendados" : f === "realizados" ? "Realizados" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          {filtered.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center py-16 text-center">
                <Users className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-gray-500">Nenhum atendimento encontrado</p>
                <Link href="/dashboard/atendimentos/novo" className="mt-4">
                  <Button>
                    <Plus className="w-4 h-4" /> Iniciar atendimento
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => {
                const days = daysUntil(a.data_hora);
                const isToday = days === 0;
                const isPast = days < 0;
                const isSelected = selectedId === a.id;
                return (
                  <Card
                    key={a.id}
                    className={`cursor-pointer transition-all hover:shadow-sm ${isSelected ? "ring-2 ring-gray-900" : ""} ${a.status === "cancelado" ? "opacity-50" : ""}`}
                    onClick={() => setSelectedId(isSelected ? null : a.id)}
                  >
                    <CardContent className="py-3.5 px-5">
                      <div className="flex items-center gap-4">
                        <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${a.status === "realizado" ? "bg-gray-100" : isToday ? "bg-[#21181d]" : isPast ? "bg-red-50" : "bg-gray-100"}`}>
                          <span className={`text-base font-black leading-none ${a.status === "realizado" ? "text-gray-400" : isToday ? "text-white" : isPast ? "text-red-600" : "text-gray-900"}`}>
                            {new Date(a.data_hora).getDate()}
                          </span>
                          <span className={`text-[10px] font-semibold ${a.status === "realizado" ? "text-gray-400" : isToday ? "text-gray-400" : isPast ? "text-red-400" : "text-gray-500"}`}>
                            {new Date(a.data_hora).toLocaleDateString("pt-BR", { month: "short" })}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{a.cliente_nome}</p>
                            {isToday && a.status === "agendado" && <Badge variant="default">Hoje</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {a.tipo && <span className="text-xs text-gray-400">{tipoLabel[a.tipo]}</span>}
                            {a.processo && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs font-mono text-gray-400">{a.processo.numero}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {formatDateTime(a.data_hora).split(" ")[1]}h
                          </span>
                        </div>

                        <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <AtendimentoDetail
            atendimento={selected}
            onClose={() => setSelectedId(null)}
            onUpdate={() => load()}
            onDelete={() => { setSelectedId(null); load(); }}
          />
        )}
      </div>

      <NovoAtendimentoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(id) => { load(); setShowModal(false); setSelectedId(id); }}
      />
    </div>
  );
}

function AtendimentoDetail({
  atendimento,
  onClose,
  onUpdate,
  onDelete,
}: {
  atendimento: Atendimento;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [showPrazoModal, setShowPrazoModal] = useState(false);
  const [showAudModal, setShowAudModal] = useState(false);

  async function marcarRealizado() {
    await updateAtendimento(atendimento.id, { status: "realizado" });
    onUpdate();
  }

  async function marcarCancelado() {
    await updateAtendimento(atendimento.id, { status: "cancelado" });
    onUpdate();
  }

  async function handleDelete() {
    await deleteAtendimento(atendimento.id);
    onDelete();
  }

  return (
    <div className="w-80 shrink-0">
      <Card className="sticky top-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Detalhe</CardTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          <div>
            <p className="text-lg font-bold text-gray-900">{atendimento.cliente_nome}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariant[atendimento.status]}>{statusLabel[atendimento.status]}</Badge>
              {atendimento.tipo && <span className="text-xs text-gray-500">{tipoLabel[atendimento.tipo]}</span>}
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            <Row icon={<Calendar className="w-3.5 h-3.5" />} label="Data e hora" value={formatDateTime(atendimento.data_hora)} />
            {atendimento.duracao_min && (
              <Row icon={<Clock className="w-3.5 h-3.5" />} label="Duração" value={`${atendimento.duracao_min} min`} />
            )}
            {atendimento.valor_cobrado && (
              <Row icon={<DollarSign className="w-3.5 h-3.5" />} label="Valor cobrado" value={formatCurrency(atendimento.valor_cobrado)} />
            )}
            {atendimento.processo && (
              <Row icon={<FileText className="w-3.5 h-3.5" />} label="Processo" value={`${atendimento.processo.numero}`} />
            )}
          </div>

          {atendimento.notas && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Anotações</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{atendimento.notas}</p>
            </div>
          )}

          {atendimento.status === "agendado" && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</p>
              <Button className="w-full" size="sm" onClick={marcarRealizado}>
                <CheckCircle className="w-3.5 h-3.5" /> Marcar como Realizado
              </Button>
              <Button className="w-full" variant="outline" size="sm" onClick={marcarCancelado}>
                <X className="w-3.5 h-3.5" /> Cancelar Atendimento
              </Button>
            </div>
          )}

          {atendimento.processo_id && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Criar para este processo</p>
              <Button className="w-full" variant="secondary" size="sm" onClick={() => setShowPrazoModal(true)}>
                <Clock className="w-3.5 h-3.5" /> Novo Prazo
              </Button>
              <Button className="w-full" variant="secondary" size="sm" onClick={() => setShowAudModal(true)}>
                <Calendar className="w-3.5 h-3.5" /> Nova Audiência
              </Button>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <Button className="w-full" variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      {atendimento.processo_id && (
        <>
          <CriarPrazoModal
            open={showPrazoModal}
            onClose={() => setShowPrazoModal(false)}
            processoId={atendimento.processo_id}
            clienteNome={atendimento.cliente_nome}
            onCreated={() => { setShowPrazoModal(false); onUpdate(); }}
          />
          <CriarAudienciaModal
            open={showAudModal}
            onClose={() => setShowAudModal(false)}
            processoId={atendimento.processo_id}
            clienteNome={atendimento.cliente_nome}
            onCreated={() => { setShowAudModal(false); onUpdate(); }}
          />
        </>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function NovoAtendimentoModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [form, setForm] = useState({
    cliente_nome: "",
    processo_id: "",
    data_hora: "",
    tipo: "",
    duracao_min: "",
    status: "agendado" as const,
    notas: "",
    valor_cobrado: "",
  });

  useEffect(() => {
    if (open) {
      getProcessos().then(setProcessos);
      getClientes().then(setClientes);
    }
  }, [open]);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  function handleClienteSelect(id: string) {
    setClienteId(id);
    if (!id) return;
    const c = clientes.find((cl) => cl.id === id);
    if (c) set("cliente_nome", c.nome);
  }

  function handleProcessoChange(processoId: string) {
    set("processo_id", processoId);
    if (processoId && !form.cliente_nome) {
      const proc = processos.find((p) => p.id === processoId);
      if (proc) set("cliente_nome", proc.cliente_nome);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_nome || !form.data_hora) return;
    const novo = await createAtendimento({
      cliente_id: clienteId || undefined,
      cliente_nome: form.cliente_nome,
      processo_id: form.processo_id || undefined,
      data_hora: form.data_hora,
      tipo: form.tipo as any || undefined,
      duracao_min: form.duracao_min ? parseInt(form.duracao_min) : undefined,
      status: form.status,
      notas: form.notas || undefined,
      valor_cobrado: form.valor_cobrado ? parseFloat(form.valor_cobrado) : undefined,
    });
    setForm({ cliente_nome: "", processo_id: "", data_hora: "", tipo: "", duracao_min: "", status: "agendado", notas: "", valor_cobrado: "" });
    setClienteId("");
    onCreated(novo.id);
  }

  return (
    <Modal open={open} onClose={onClose} title="Agendar Atendimento" size="md">
      <p className="text-xs text-gray-500 mb-3 -mt-1">
        Para registrar um atendimento já realizado com anotações completas, use <strong>Iniciar Atendimento</strong>.
      </p>
      <form onSubmit={submit} className="space-y-4">
        {clientes.length > 0 && (
          <ComboBox
            label="Cliente cadastrado"
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar da lista de clientes…"
            value={clienteId}
            onChange={handleClienteSelect}
          />
        )}
        <ComboBox
          label="Processo (opcional)"
          options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))}
          placeholder="Selecione se vinculado a processo..."
          value={form.processo_id}
          onChange={handleProcessoChange}
        />
        <Input
          label="Nome do Cliente *"
          placeholder="Nome completo"
          value={form.cliente_nome}
          onChange={(e) => set("cliente_nome", e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de Atendimento"
            options={tipoOptions}
            placeholder="Tipo..."
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
          />
          <Input
            label="Data e Hora *"
            type="datetime-local"
            value={form.data_hora}
            onChange={(e) => set("data_hora", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Duração (minutos)"
            type="number"
            min="15"
            step="15"
            placeholder="60"
            value={form.duracao_min}
            onChange={(e) => set("duracao_min", e.target.value)}
          />
          <Input
            label="Valor Cobrado (R$)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={form.valor_cobrado}
            onChange={(e) => set("valor_cobrado", e.target.value)}
          />
        </div>
        <Textarea
          label="Pauta / assuntos a tratar"
          placeholder="Breve pauta para o atendimento agendado..."
          rows={3}
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Agendar</Button>
        </div>
      </form>
    </Modal>
  );
}

function CriarPrazoModal({
  open, onClose, processoId, clienteNome, onCreated,
}: {
  open: boolean; onClose: () => void; processoId: string; clienteNome: string; onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !data) return;
    await createPrazo({ processo_id: processoId, titulo, data_prazo: data, tipo: tipo as any || undefined, prioridade: "media", concluido: false });
    setTitulo(""); setData(""); setTipo("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Prazo" size="sm">
      <p className="text-xs text-gray-500 mb-4">Cliente: <strong>{clienteNome}</strong></p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Entregar documentos" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Select label="Tipo" options={[
          { value: "recurso", label: "Recurso" },
          { value: "contestacao", label: "Contestação" },
          { value: "peticao", label: "Petição" },
          { value: "contrarrazoes", label: "Contrarrazões" },
          { value: "outro", label: "Outro" },
        ]} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <Input label="Data Limite *" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Criar Prazo</Button>
        </div>
      </form>
    </Modal>
  );
}

function CriarAudienciaModal({
  open, onClose, processoId, clienteNome, onCreated,
}: {
  open: boolean; onClose: () => void; processoId: string; clienteNome: string; onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [local, setLocal] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !dataHora) return;
    await createAudiencia({ processo_id: processoId, titulo, data_hora: dataHora, local: local || undefined, realizada: false });
    setTitulo(""); setDataHora(""); setLocal("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Audiência" size="sm">
      <p className="text-xs text-gray-500 mb-4">Cliente: <strong>{clienteNome}</strong></p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Audiência de instrução" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Input label="Data e Hora *" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
        <Input label="Local" placeholder="Fórum, sala, zoom..." value={local} onChange={(e) => setLocal(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Criar Audiência</Button>
        </div>
      </form>
    </Modal>
  );
}
