"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle, Archive, CheckCircle2, CloudDownload, Copy,
  Eye, Filter, FolderOpen, Loader2, Plus, Search, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { createProcesso, deleteProcesso, getProcessos, updateProcesso } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Processo, ProcessoStatus, ProcessoTipo } from "@/types";
import { NovoProcessoModal } from "./novo-processo-modal";
import { getPerfilAdvogado } from "@/lib/perfil";
import {
  descobrirProcessosTribunaisSyncLocal,
  testarSyncLocal,
  type SyncLocalTribunalProcesso,
} from "@/lib/syncLocal";

const statusLabel: Record<ProcessoStatus, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  encerrado: "Encerrado",
};

const statusVariant: Record<ProcessoStatus, "default" | "warning" | "neutral" | "danger"> = {
  ativo: "default",
  suspenso: "warning",
  arquivado: "neutral",
  encerrado: "neutral",
};

const statusPriority: Record<ProcessoStatus, number> = {
  ativo: 0,
  suspenso: 1,
  arquivado: 2,
  encerrado: 3,
};

const tipoLabel: Record<string, string> = {
  civel: "Cível",
  familia: "Família",
  criminal: "Criminal",
  execucao_penal: "Execução penal",
  inquerito_policial: "Inquérito policial",
  bo_pm: "BO PM",
  trabalhista: "Trabalhista",
  previdenciario: "Previdenciário",
  tributario: "Tributário",
  federal: "Federal",
  outro: "Outro",
};

// Mostra o rótulo conhecido ou o próprio valor customizado
function tipoDisplay(tipo?: string): string {
  if (!tipo) return "—";
  return tipoLabel[tipo] ?? tipo;
}

const situacaoInqueritoLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  relatado: "Relatado",
  denunciado: "Denunciado",
  arquivado: "Arquivado",
  baixado: "Baixado",
  outro: "Outro",
};

function isInqueritoProcesso(processo: Processo): boolean {
  return processo.tipo === "inquerito_policial";
}

function situacaoInqueritoDisplay(value?: string): string {
  if (!value) return "Situação não informada";
  return situacaoInqueritoLabel[value] ?? value;
}

function clienteHref(processo: Processo): string | undefined {
  return processo.cliente_id ? `/dashboard/clientes/${processo.cliente_id}` : undefined;
}

type ImportState = {
  type: "success" | "error" | "info";
  message: string;
};

function numeroKey(numero: string): string {
  return numero.replace(/\D/g, "");
}

function toProcessoTipo(value?: string): ProcessoTipo {
  const tipos: ProcessoTipo[] = [
    "civel",
    "familia",
    "criminal",
    "execucao_penal",
    "inquerito_policial",
    "bo_pm",
    "trabalhista",
    "previdenciario",
    "tributario",
    "federal",
    "outro",
  ];
  return tipos.includes(value as ProcessoTipo) ? (value as ProcessoTipo) : "outro";
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return undefined;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function processoFromTribunal(item: SyncLocalTribunalProcesso): Omit<Processo, "id" | "created_at" | "updated_at" | "user_id"> {
  const titulo = item.titulo || item.classe || "Processo TJRJ";
  return {
    numero: item.numero,
    titulo,
    descricao: item.url ? `Importado do ${item.origem || "TJRJ"}: ${item.url}` : `Importado do ${item.origem || "TJRJ"}`,
    status: "ativo",
    tribunal: item.tribunal || "TJRJ",
    vara: item.vara || item.orgao,
    comarca: item.comarca,
    uf: item.uf || "RJ",
    tipo: toProcessoTipo(item.tipo),
    fase: item.fase,
    cliente_nome: item.cliente_nome || "A conferir",
    parte_contraria: item.parte_contraria,
    data_distribuicao: toIsoDate(item.data_distribuicao),
    monitorar_datajud: true,
    ultimo_sync: new Date().toISOString(),
  };
}

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [tribunalFilter, setTribunalFilter] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyProcessoId, setBusyProcessoId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setProcessos(await getProcessos());
  }, []);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  useEffect(() => { load(); }, [load]);

  const importarDoTjrj = useCallback(async () => {
    setImportando(true);
    setImportState(null);
    try {
      const perfil = getPerfilAdvogado();
      if (!perfil.oab_numero && !perfil.nome) {
        throw new Error("Preencha seu nome e OAB em Configuracoes antes de buscar no TJRJ.");
      }

      const health = await testarSyncLocal();
      if (!health.ok) {
        throw new Error("O Justio Sync Local nao respondeu. Deixe o comando npm run sync:local aberto e tente de novo.");
      }

      const encontrados = await descobrirProcessosTribunaisSyncLocal({
        tribunal: "tjrj",
        nome: perfil.nome,
        oabNumero: perfil.oab_numero,
        oabUF: perfil.oab_uf || "RJ",
        anoInicial: 2000,
        anoFinal: new Date().getFullYear(),
      });

      const existentes = new Set(processos.map((p) => numeroKey(p.numero)).filter(Boolean));
      const novos = encontrados.filter((p) => {
        const key = numeroKey(p.numero);
        return key && !existentes.has(key);
      });

      for (const processo of novos) {
        await createProcesso(processoFromTribunal(processo));
      }

      await load();

      if (novos.length > 0) {
        const repetidos = encontrados.length - novos.length;
        setImportState({
          type: "success",
          message: `${novos.length} processo${novos.length === 1 ? "" : "s"} importado${novos.length === 1 ? "" : "s"} do TJRJ. ${repetidos} ja existia${repetidos === 1 ? "" : "m"} no Justio.`,
        });
      } else if (encontrados.length > 0) {
        setImportState({ type: "info", message: `Encontrei ${encontrados.length} processo${encontrados.length === 1 ? "" : "s"} no TJRJ, mas todos ja estavam cadastrados.` });
      } else {
        setImportState({ type: "info", message: "Nao encontrei processos no TJRJ para esse nome/OAB no periodo pesquisado." });
      }
    } catch (err) {
      setImportState({ type: "error", message: err instanceof Error ? err.message : "Nao consegui buscar processos no TJRJ." });
    } finally {
      setImportando(false);
    }
  }, [load, processos]);

  const copyNumero = useCallback(async (processo: Processo) => {
    await navigator.clipboard.writeText(processo.numero);
    setCopiedId(processo.id);
    setTimeout(() => setCopiedId((current) => current === processo.id ? null : current), 1400);
  }, []);

  const arquivarProcesso = useCallback(async (processo: Processo) => {
    if (processo.status === "arquivado") return;
    setBusyProcessoId(processo.id);
    try {
      await updateProcesso(processo.id, { status: "arquivado" });
      await load();
    } finally {
      setBusyProcessoId(null);
    }
  }, [load]);

  const excluirProcesso = useCallback(async (processo: Processo) => {
    const ok = window.confirm(`Excluir o processo ${processo.numero}? Esta acao nao pode ser desfeita.`);
    if (!ok) return;
    setBusyProcessoId(processo.id);
    try {
      await deleteProcesso(processo.id);
      await load();
    } finally {
      setBusyProcessoId(null);
    }
  }, [load]);

  const excluirSelecionados = useCallback(async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} processo${ids.length !== 1 ? "s" : ""} selecionado${ids.length !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    setBulkBusy(true);
    try {
      for (const id of ids) await deleteProcesso(id);
      await load();
      limparSelecao();
    } finally {
      setBulkBusy(false);
    }
  }, [selecionados, load]);

  const arquivarSelecionados = useCallback(async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of ids) await updateProcesso(id, { status: "arquivado" });
      await load();
      limparSelecao();
    } finally {
      setBulkBusy(false);
    }
  }, [selecionados, load]);

  // Opções distintas presentes nos processos para os filtros secundários
  const tiposDisponiveis = Array.from(new Set(processos.map((p) => p.tipo).filter(Boolean) as string[])).sort();
  const tribunaisDisponiveis = Array.from(new Set(processos.map((p) => p.tribunal).filter(Boolean) as string[])).sort();

  const filtered = processos
    .filter((p) => {
      const matchSearch =
        !search ||
        p.numero.toLowerCase().includes(search.toLowerCase()) ||
        (p.numero_inquerito ?? "").toLowerCase().includes(search.toLowerCase()) ||
        p.titulo.toLowerCase().includes(search.toLowerCase()) ||
        p.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.parte_contraria ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.delegacia ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "todos" || p.status === statusFilter;
      const matchTipo = tipoFilter === "todos" || p.tipo === tipoFilter;
      const matchTribunal = tribunalFilter === "todos" || p.tribunal === tribunalFilter;
      return matchSearch && matchStatus && matchTipo && matchTribunal;
    })
    .sort((a, b) => {
      const byStatus = statusPriority[a.status] - statusPriority[b.status];
      if (byStatus !== 0) return byStatus;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const todosSelecionados = filtered.length > 0 && filtered.every((p) => selecionados.has(p.id));
  const algumSelecionado = selecionados.size > 0;

  function toggleTodos() {
    if (todosSelecionados) {
      limparSelecao();
    } else {
      setSelecionados(new Set(filtered.map((p) => p.id)));
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processos</h1>
          <p className="text-gray-500 text-sm mt-1">{processos.length} processo{processos.length !== 1 ? "s" : ""} cadastrado{processos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" onClick={importarDoTjrj} disabled={importando}>
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            {importando ? "Buscando..." : "Buscar no TJRJ"}
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Processo
          </Button>
        </div>
      </div>

      {importState && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
          importState.type === "success"
            ? "bg-green-50 text-green-700"
            : importState.type === "error"
              ? "bg-red-50 text-red-600"
              : "bg-blue-50 text-blue-700"
        }`}>
          {importState.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{importState.message}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-full md:min-w-48 md:max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-colors"
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {(["ativo", "todos", "suspenso", "arquivado", "encerrado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-[#21181d] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "todos" ? "Todos" : statusLabel[s as ProcessoStatus]}
            </button>
          ))}
        </div>

        {(tiposDisponiveis.length > 0 || tribunaisDisponiveis.length > 0) && (
          <div className="flex w-full flex-wrap items-center gap-2">
            {tiposDisponiveis.length > 0 && (
              <div className="min-w-44">
                <Select
                  value={tipoFilter}
                  onChange={(e) => setTipoFilter(e.target.value)}
                  options={[
                    { value: "todos", label: "Todos os tipos" },
                    ...tiposDisponiveis.map((t) => ({ value: t, label: tipoDisplay(t) })),
                  ]}
                />
              </div>
            )}
            {tribunaisDisponiveis.length > 0 && (
              <div className="min-w-44">
                <Select
                  value={tribunalFilter}
                  onChange={(e) => setTribunalFilter(e.target.value)}
                  options={[
                    { value: "todos", label: "Todos os tribunais" },
                    ...tribunaisDisponiveis.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </div>
            )}
            {(tipoFilter !== "todos" || tribunalFilter !== "todos") && (
              <button
                onClick={() => { setTipoFilter("todos"); setTribunalFilter("todos"); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 underline underline-offset-2"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={toggleTodos}
              className="h-4 w-4 rounded border-gray-300 accent-[#21181d]"
            />
            Selecionar todos
          </label>
          {algumSelecionado && (
            <>
              <span className="text-sm text-gray-500">{selecionados.size} selecionado{selecionados.size !== 1 ? "s" : ""}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={arquivarSelecionados} disabled={bulkBusy}>
                  <Archive className="w-3.5 h-3.5" /> Arquivar
                </Button>
                <Button variant="danger" size="sm" onClick={excluirSelecionados} disabled={bulkBusy}>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={limparSelecao} disabled={bulkBusy}>
                  Limpar
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500 font-medium">Nenhum processo encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? "Tente outros termos de busca" : "Adicione seu primeiro processo"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" /> Novo Processo
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id} className={`p-4 ${selecionados.has(p.id) ? "ring-2 ring-[#21181d]" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={() => toggleSelecionado(p.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#21181d]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/processos/${p.id}`}
                        className="text-sm font-semibold tabular-nums tracking-tight leading-snug text-gray-900 hover:text-blue-600"
                      >
                        {p.numero}
                      </Link>
                      <button
                        type="button"
                        title="Copiar numero do processo"
                        onClick={() => copyNumero(p)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        {copiedId === p.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug text-gray-800">{p.titulo}</p>
                  </div>
                  <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                  <p className="break-words">
                    <span className="font-medium text-gray-700">Cliente:</span>{" "}
                    {clienteHref(p) ? (
                      <Link href={clienteHref(p)!} className="font-semibold text-gray-800 hover:text-blue-600 hover:underline">
                        {p.cliente_nome}
                      </Link>
                    ) : (
                      p.cliente_nome
                    )}
                  </p>
                  {p.parte_contraria && (
                    <p className="break-words">
                      <span className="font-medium text-gray-700">Parte contraria:</span> {p.parte_contraria}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-gray-700">Tribunal:</span> {p.tribunal ?? "—"}{p.uf ? `/${p.uf}` : ""}
                  </p>
                  {p.comarca && (
                    <p>
                      <span className="font-medium text-gray-700">Comarca:</span> {p.comarca}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-gray-700">Tipo:</span> {tipoDisplay(p.tipo)}
                  </p>
                  {isInqueritoProcesso(p) && (
                    <p className="break-words rounded-lg bg-gray-50 px-2 py-1.5">
                      <span className="font-medium text-gray-700">Inquérito:</span>{" "}
                      {p.numero_inquerito || "nº não informado"}
                      {p.delegacia ? ` · ${p.delegacia}` : ""}
                      {` · ${situacaoInqueritoDisplay(p.situacao_inquerito)}`}
                    </p>
                  )}
                  {p.data_distribuicao && (
                    <p>
                      <span className="font-medium text-gray-700">Distribuicao:</span> {formatDate(p.data_distribuicao)}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#21181d] px-2 text-xs font-semibold text-white transition-colors hover:bg-[#2b2027]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Detalhes
                  </Link>
                  <button
                    type="button"
                    onClick={() => arquivarProcesso(p)}
                    disabled={p.status === "arquivado" || busyProcessoId === p.id}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Arquivar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirProcesso(p)}
                    disabled={busyProcessoId === p.id}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-100 px-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleTodos}
                    className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                  />
                </th>
                <th className="text-left px-3 py-3">Número / Título</th>
                <th className="text-left px-3 py-3">Cliente</th>
                <th className="text-left px-3 py-3 hidden md:table-cell">Tribunal</th>
                <th className="text-left px-3 py-3 hidden lg:table-cell">Tipo</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3 hidden xl:table-cell">Distribuição</th>
                <th className="px-3 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className={`transition-colors group ${selecionados.has(p.id) ? "bg-[#21181d]/[0.04]" : "hover:bg-gray-50/60"}`}>
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSelecionado(p.id)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                    />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/processos/${p.id}`}
                        className="whitespace-nowrap text-xs font-semibold tabular-nums tracking-tight text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                      >
                        {p.numero}
                      </Link>
                      <button
                        type="button"
                        title="Copiar número do processo"
                        onClick={() => copyNumero(p)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        {copiedId === p.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <Link href={`/dashboard/processos/${p.id}`} className="mt-0.5 block text-gray-600 line-clamp-1 hover:text-gray-900">{p.titulo}</Link>
                    {isInqueritoProcesso(p) && (
                      <p className="mt-1 max-w-md text-xs text-gray-400">
                        IP {p.numero_inquerito || "nº não informado"}
                        {p.delegacia ? ` · ${p.delegacia}` : ""}
                        {` · ${situacaoInqueritoDisplay(p.situacao_inquerito)}`}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {clienteHref(p) ? (
                      <Link
                        href={clienteHref(p)!}
                        className="block max-w-32 truncate font-medium text-gray-800 hover:text-blue-600 hover:underline"
                      >
                        {p.cliente_nome}
                      </Link>
                    ) : (
                      <p className="text-gray-800 font-medium truncate max-w-32">{p.cliente_nome}</p>
                    )}
                    {p.parte_contraria && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate max-w-32">vs. {p.parte_contraria}</p>
                    )}
                  </td>
                  <td className="px-3 py-4 hidden md:table-cell text-gray-600">
                    <p>{p.tribunal ?? "—"}{p.uf ? `/${p.uf}` : ""}</p>
                    {p.comarca && <p className="mt-0.5 max-w-36 truncate text-xs text-gray-400">{p.comarca}</p>}
                  </td>
                  <td className="px-3 py-4 hidden lg:table-cell text-gray-600">
                    <div>{tipoDisplay(p.tipo)}</div>
                    {isInqueritoProcesso(p) && p.processo_principal_id && (
                      <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        Vinculado
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
                  </td>
                  <td className="px-3 py-4 hidden xl:table-cell text-gray-500">
                    {p.data_distribuicao ? formatDate(p.data_distribuicao) : "—"}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <Link
                        href={`/dashboard/processos/${p.id}`}
                        title="Ver detalhes"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {p.status !== "arquivado" && (
                        <button
                          type="button"
                          title="Arquivar processo"
                          onClick={() => arquivarProcesso(p)}
                          disabled={busyProcessoId === p.id}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Excluir processo"
                        onClick={() => excluirProcesso(p)}
                        disabled={busyProcessoId === p.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}

      <NovoProcessoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { load(); setShowModal(false); }}
      />
    </div>
  );
}
