"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, Edit2, FolderOpen, ListTodo, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { createTarefa, deleteTarefa, getProcessos, getTarefasWithProcesso, updateTarefa } from "@/lib/store";
import { cn, daysUntil, formatDate, prazoColor } from "@/lib/utils";
import type { Prioridade, Processo, Tarefa } from "@/types";

type TarefaComProcesso = Tarefa & { processo?: Pick<Processo, "id" | "numero" | "titulo" | "cliente_nome"> };
type Filter = "pendentes" | "concluidas" | "todas";

const emptyForm = {
  processo_id: "",
  titulo: "",
  descricao: "",
  data_limite: "",
  prioridade: "media" as Prioridade,
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<TarefaComProcesso[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("pendentes");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<TarefaComProcesso | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [tarefasData, processosData] = await Promise.all([getTarefasWithProcesso(), getProcessos()]);
    setTarefas(tarefasData);
    setProcessos(processosData.filter((p) => p.status !== "arquivado" && p.status !== "encerrado"));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return tarefas.filter((tarefa) => {
      if (filter === "pendentes" && tarefa.concluida) return false;
      if (filter === "concluidas" && !tarefa.concluida) return false;
      if (!q) return true;
      return [
        tarefa.titulo,
        tarefa.descricao,
        tarefa.processo?.numero,
        tarefa.processo?.titulo,
        tarefa.processo?.cliente_nome,
      ].some((field) => field && normalize(field).includes(q));
    });
  }, [tarefas, query, filter]);

  function openCreate() {
    setEditingTarefa(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(tarefa: TarefaComProcesso) {
    setEditingTarefa(tarefa);
    setForm({
      processo_id: tarefa.processo_id,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao ?? "",
      data_limite: tarefa.data_limite ?? "",
      prioridade: tarefa.prioridade,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.processo_id || !form.titulo.trim()) return;
    setSaving(true);
    try {
      if (editingTarefa) {
        await updateTarefa(editingTarefa.id, {
          processo_id: form.processo_id,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || undefined,
          data_limite: form.data_limite || undefined,
          prioridade: form.prioridade,
        });
      } else {
        await createTarefa({
          processo_id: form.processo_id,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || undefined,
          data_limite: form.data_limite || undefined,
          prioridade: form.prioridade,
          concluida: false,
        });
      }
      setForm(emptyForm);
      setEditingTarefa(null);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tarefa: Tarefa) {
    await updateTarefa(tarefa.id, { concluida: !tarefa.concluida });
    await load();
  }

  async function handleDelete(tarefa: Tarefa) {
    if (!window.confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;
    await deleteTarefa(tarefa.id);
    await load();
  }

  const pendingCount = tarefas.filter((t) => !t.concluida).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tarefas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pendingCount} tarefa{pendingCount === 1 ? "" : "s"} pendente{pendingCount === 1 ? "" : "s"} vinculada{pendingCount === 1 ? "" : "s"} aos processos
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por tarefa, processo ou cliente..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div className="flex rounded-xl bg-gray-100 p-1">
          {([
            ["pendentes", "Pendentes"],
            ["concluidas", "Concluídas"],
            ["todas", "Todas"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                filter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <ListTodo className="mb-4 h-12 w-12 text-gray-200" />
              <p className="text-base font-semibold text-gray-700">Nenhuma tarefa encontrada</p>
              <p className="mt-1 text-sm text-gray-400">As tarefas criadas dentro dos processos aparecem aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((tarefa) => <TarefaRow key={tarefa.id} tarefa={tarefa} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} />)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTarefa(null); }} title={editingTarefa ? "Editar tarefa" : "Nova tarefa"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ComboBox
            label="Processo"
            placeholder="Selecione um processo"
            value={form.processo_id}
            onChange={(v) => setForm((f) => ({ ...f, processo_id: v }))}
            options={processos.map((processo) => ({
              value: processo.id,
              label: `${processo.numero} · ${processo.cliente_nome}`,
            }))}
          />
          <Input
            label="Título"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Conferir intimação"
            required
          />
          <Textarea
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Detalhes úteis para executar a tarefa"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Data limite"
              type="date"
              value={form.data_limite}
              onChange={(e) => setForm((f) => ({ ...f, data_limite: e.target.value }))}
            />
            <Select
              label="Prioridade"
              value={form.prioridade}
              onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as Prioridade }))}
              options={[
                { value: "alta", label: "Alta" },
                { value: "media", label: "Média" },
                { value: "baixa", label: "Baixa" },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setEditingTarefa(null); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {editingTarefa ? "Salvar alterações" : "Salvar tarefa"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TarefaRow({ tarefa, onToggle, onEdit, onDelete }: {
  tarefa: TarefaComProcesso;
  onToggle: (tarefa: Tarefa) => void;
  onEdit: (tarefa: TarefaComProcesso) => void;
  onDelete: (tarefa: Tarefa) => void;
}) {
  const days = tarefa.data_limite ? daysUntil(tarefa.data_limite) : undefined;
  const prazoClass = days === undefined ? "bg-gray-100 text-gray-500" : prazoColor(days);

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-gray-50/60 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(tarefa)}
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            tarefa.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-gray-300 hover:border-slate-500 hover:text-slate-600"
          )}
        >
          {tarefa.concluida ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-sm font-semibold text-gray-900", tarefa.concluida && "text-gray-400 line-through")}>{tarefa.titulo}</p>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              tarefa.prioridade === "alta" ? "bg-red-50 text-red-700" : tarefa.prioridade === "baixa" ? "bg-gray-100 text-gray-500" : "bg-amber-50 text-amber-700"
            )}>
              {tarefa.prioridade}
            </span>
          </div>
          {tarefa.descricao && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{tarefa.descricao}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <FolderOpen className="h-3.5 w-3.5" />
            {tarefa.processo ? (
              <Link href={`/dashboard/processos/${tarefa.processo.id}`} className="font-mono text-gray-600 hover:text-gray-900">
                {tarefa.processo.numero}
              </Link>
            ) : (
              <span>Processo não encontrado</span>
            )}
            <span>·</span>
            <span>{tarefa.processo?.cliente_nome ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="text-right">
          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${prazoClass}`}>
            {days === undefined ? "Sem data" : days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "Hoje" : `${days}d`}
          </span>
          {tarefa.data_limite && <p className="mt-1 text-xs text-gray-400">{formatDate(tarefa.data_limite)}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onEdit(tarefa)} title="Editar tarefa">
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(tarefa)} className="text-red-600 hover:bg-red-50 hover:text-red-700" title="Excluir tarefa">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
