"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, ChevronRight, Search, Plus, Trash2, FileText, Calendar, Loader2, AlertTriangle, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComboBox } from "@/components/ui/combobox";
import { SelectComOutro } from "@/components/ui/select-com-outro";
import {
  getClientesSummary,
  getClientes,
  getProcessos,
  createCliente,
  deleteCliente,
  importarClientesExistentes,
  contarVinculosClienteNome,
  getVinculosClienteNaoCadastrado,
  excluirClienteNaoCadastrado,
  vincularClienteNaoCadastradoAExistente,
  type ClienteSummary,
  type ClienteNaoCadastradoVinculos,
} from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { formatCPF, formatRG, formatCEP, buscarCep } from "@/lib/format";
import {
  ajustarGenero,
  estadoCivilOptions,
  mergeOptions,
  nacionalidadeOptions,
  profissaoOptions,
  valuesToOptions,
} from "@/lib/cadastro-options";
import { NovoProcessoModal } from "@/app/dashboard/processos/novo-processo-modal";
import type { Cliente, Processo } from "@/types";

const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

type Summary = ClienteSummary & { id?: string; cadastrado: boolean };

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Primeira letra do nome, sem acento e maiúscula (ex.: "Ávila" -> "A"). Não-letras viram "#".
function primeiraLetra(nome: string): string {
  const ch = nome.trim().charAt(0).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleUpperCase("pt-BR");
  return /[A-Z]/.test(ch) ? ch : "#";
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Summary[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showProcessoModal, setShowProcessoModal] = useState(false);
  const [preNome, setPreNome] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Summary | null>(null);
  const [deleteVinculos, setDeleteVinculos] = useState<ClienteNaoCadastradoVinculos | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteActionBusy, setDeleteActionBusy] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({ atendimentos: true, processos: false });
  const [linkTarget, setLinkTarget] = useState<Summary | null>(null);
  const [letra, setLetra] = useState("");

  const naoCadastrados = clientes.filter((c) => !c.cadastrado).length;

  const keyOf = (c: Summary) => c.id ?? c.nome;

  function toggleSelecionado(key: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  function encerrarSelecao() {
    limparSelecao();
    setSelectionMode(false);
  }

  async function handleImportar() {
    const count = await importarClientesExistentes();
    if (count > 0) {
      load();
    }
  }

  async function handleDeleteCliente(cliente: Summary) {
    if (!cliente.id) return;
    if (!window.confirm(`Excluir o cliente "${cliente.nome}"? Os processos vinculados continuam cadastrados.`)) return;
    await deleteCliente(cliente.id);
    await load();
  }

  async function handleDeleteNaoCadastrado(cliente: Summary) {
    if (cliente.id) return;
    setDeleteTarget(cliente);
    setDeleteVinculos(null);
    setDeleteLoading(true);
    try {
      const vinculos = await getVinculosClienteNaoCadastrado(cliente.nome);
      setDeleteVinculos(vinculos);
      setDeleteOptions({
        atendimentos: vinculos.atendimentos.length > 0,
        processos: vinculos.atendimentos.length === 0 && vinculos.processos.length > 0,
      });
    } catch (err: any) {
      window.alert(err instanceof Error ? err.message : "Não foi possível carregar os vínculos deste nome.");
      setDeleteTarget(null);
      return;
      window.alert(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel carregar os vÃ­nculos deste nome.");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteNaoCadastradoAntigo(cliente: Summary) {
    if (cliente.id) return;
    const v = await contarVinculosClienteNome(cliente.nome);
    const partes: string[] = [];
    if (v.processos > 0) partes.push(`${v.processos} processo${v.processos !== 1 ? "s" : ""}`);
    if (v.atendimentos > 0) partes.push(`${v.atendimentos} atendimento${v.atendimentos !== 1 ? "s" : ""}`);
    const detalhe = partes.length ? ` Isso também vai apagar ${partes.join(" e ")} vinculado${v.processos + v.atendimentos !== 1 ? "s" : ""} a este nome.` : "";
    if (!window.confirm(`Remover "${cliente.nome}" da lista?${detalhe}\n\nEsta ação não pode ser desfeita.`)) return;
    await excluirClienteNaoCadastrado(cliente.nome);
    await load();
  }

  function fecharDeleteNaoCadastrado() {
    if (deleteActionBusy) return;
    setDeleteTarget(null);
    setDeleteVinculos(null);
    setDeleteOptions({ atendimentos: true, processos: false });
  }

  async function confirmarDeleteNaoCadastrado() {
    if (!deleteTarget || !deleteVinculos) return;
    const apagarAtendimentos = deleteOptions.atendimentos && deleteVinculos.atendimentos.length > 0;
    const apagarProcessos = deleteOptions.processos && deleteVinculos.processos.length > 0;

    if (!apagarAtendimentos && !apagarProcessos) {
      window.alert("Escolha pelo menos um tipo de vinculo para excluir.");
      return;
    }

    setDeleteActionBusy(true);
    try {
      await excluirClienteNaoCadastrado(deleteTarget.nome, {
        atendimentos: apagarAtendimentos,
        processos: apagarProcessos,
      });
      await load();
      fecharDeleteNaoCadastrado();
    } finally {
      setDeleteActionBusy(false);
    }
  }

  function abrirVinculoNaoCadastrado(cliente: Summary) {
    if (cliente.id) return;
    setLinkTarget(cliente);
  }

  const load = useCallback(async () => {
    setClientes(await getClientesSummary());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clientes
    .filter((c) => c.nome.toLowerCase().includes(query.toLowerCase()))
    .filter((c) => !letra || primeiraLetra(c.nome) === letra)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

  const letrasDisponiveis = new Set(
    clientes
      .filter((c) => c.nome.toLowerCase().includes(query.toLowerCase()))
      .map((c) => primeiraLetra(c.nome))
  );

  const cadastrados = clientes.filter((c) => c.cadastrado).length;

  const todosSelecionados = filtered.length > 0 && filtered.every((c) => selecionados.has(keyOf(c)));
  const algumSelecionado = selecionados.size > 0;
  const deleteHasSelection = !!deleteVinculos && (
    (deleteOptions.atendimentos && deleteVinculos.atendimentos.length > 0) ||
    (deleteOptions.processos && deleteVinculos.processos.length > 0)
  );

  function toggleTodos() {
    if (todosSelecionados) limparSelecao();
    else setSelecionados(new Set(filtered.map(keyOf)));
  }

  async function excluirSelecionados() {
    const alvos = filtered.filter((c) => selecionados.has(keyOf(c)));
    if (alvos.length === 0) return;
    const comProcessos = alvos.filter((c) => !c.cadastrado);
    const aviso = comProcessos.length > 0
      ? `\n\nAtenção: ${comProcessos.length} não cadastrado${comProcessos.length !== 1 ? "s" : ""} — isso também apaga os processos e atendimentos vinculados a esses nomes.`
      : "";
    if (!window.confirm(`Excluir ${alvos.length} cliente${alvos.length !== 1 ? "s" : ""} selecionado${alvos.length !== 1 ? "s" : ""}?${aviso}\n\nEsta ação não pode ser desfeita.`)) return;
    setBulkBusy(true);
    try {
      for (const c of alvos) {
        if (c.id) await deleteCliente(c.id);
        else await excluirClienteNaoCadastrado(c.nome, { processos: true, atendimentos: true });
      }
      await load();
      encerrarSelecao();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {cadastrados} cadastrado{cadastrados !== 1 ? "s" : ""} · {clientes.length} no total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {naoCadastrados > 0 && (
            <Button variant="secondary" onClick={handleImportar}>
              Importar {naoCadastrados} dos processos
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowProcessoModal(true)}>
            <Plus className="w-4 h-4" /> Novo Processo
          </Button>
          <Button onClick={() => { setPreNome(""); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>
      </div>


      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nome…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-400 transition-colors bg-white"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setLetra("")}
          className={`h-7 min-w-7 rounded-md px-1.5 text-xs font-semibold transition-colors ${letra === "" ? "bg-[#21181d] text-white" : "text-gray-500 hover:bg-gray-100"}`}
        >
          Todas
        </button>
        {ALFABETO.map((l) => {
          const disponivel = letrasDisponiveis.has(l);
          return (
            <button
              key={l}
              type="button"
              disabled={!disponivel}
              onClick={() => setLetra((atual) => (atual === l ? "" : l))}
              className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${
                letra === l
                  ? "bg-[#21181d] text-white"
                  : disponivel
                    ? "text-gray-600 hover:bg-gray-100"
                    : "cursor-not-allowed text-gray-300"
              }`}
            >
              {l}
            </button>
          );
        })}
        {letrasDisponiveis.has("#") && (
          <button
            type="button"
            onClick={() => setLetra((atual) => (atual === "#" ? "" : "#"))}
            className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${letra === "#" ? "bg-[#21181d] text-white" : "text-gray-600 hover:bg-gray-100"}`}
            title="Outros (números/símbolos)"
          >
            #
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          {!selectionMode ? (
            <Button variant="secondary" size="sm" onClick={() => setSelectionMode(true)}>
              Selecionar
            </Button>
          ) : (
            <>
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
                <span className="text-sm text-gray-500">{selecionados.size} selecionado{selecionados.size !== 1 ? "s" : ""}</span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                {algumSelecionado && (
                  <Button variant="danger" size="sm" onClick={excluirSelecionados} disabled={bulkBusy}>
                    <Trash2 className="w-3.5 h-3.5" /> Excluir selecionados
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={encerrarSelecao} disabled={bulkBusy}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum cliente encontrado</p>
          </div>
        </Card>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {filtered.map((c) => (
            <Card key={c.id ?? c.nome} className={`p-4 ${selectionMode && selecionados.has(keyOf(c)) ? "ring-2 ring-[#21181d]" : ""}`}>
              <div className="flex items-start gap-3">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selecionados.has(keyOf(c))}
                    onChange={() => toggleSelecionado(keyOf(c))}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#21181d]"
                  />
                )}
                <div className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${c.cadastrado ? "bg-[#21181d]" : "bg-gray-300"}`}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.id ? (
                      <Link href={`/dashboard/clientes/${c.id}`} className="inline-flex items-center gap-1 break-words text-sm font-semibold leading-snug text-gray-900 hover:text-blue-600">
                        {c.nome}
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </Link>
                    ) : (
                      <p className="break-words text-sm font-semibold leading-snug text-gray-900">{c.nome}</p>
                    )}
                    {!c.cadastrado && (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        nao cadastrado
                      </span>
                    )}
                  </div>
                  {c.ultimoContato && (
                    <p className="mt-1 text-xs text-gray-400">Ultimo contato: {formatDate(c.ultimoContato)}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Processos:</span> {c.totalProcessos}
                    {c.processosAtivos > 0 && (
                      <span className="ml-1 text-green-600 font-medium">({c.processosAtivos} ativo{c.processosAtivos !== 1 ? "s" : ""})</span>
                    )}
                  </p>
                </div>
              </div>

              {c.id ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteCliente(c)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Excluir cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => abrirVinculoNaoCadastrado(c)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Vincular
                  </button>
                  <button
                    onClick={() => {
                      setPreNome(c.nome);
                      setShowModal(true);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    + Cadastrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNaoCadastrado(c)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                    title="Remover da lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                {selectionMode && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onChange={toggleTodos}
                      className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                    />
                  </th>
                )}
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-center px-4 py-3">Processos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                  <tr key={c.id ?? c.nome} className={`transition-colors ${selectionMode && selecionados.has(keyOf(c)) ? "bg-[#21181d]/[0.04]" : "hover:bg-gray-50/60"}`}>
                    {selectionMode && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selecionados.has(keyOf(c))}
                          onChange={() => toggleSelecionado(keyOf(c))}
                          className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${c.cadastrado ? "bg-[#21181d]" : "bg-gray-300"}`}>
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {c.id ? (
                              <Link href={`/dashboard/clientes/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600 hover:underline">
                                {c.nome}
                              </Link>
                            ) : (
                              <p className="font-semibold text-gray-900">{c.nome}</p>
                            )}
                            {!c.cadastrado && (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                não cadastrado
                              </span>
                            )}
                          </div>
                          {c.ultimoContato && (
                            <p className="text-xs text-gray-400 mt-0.5">Último contato: {formatDate(c.ultimoContato)}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{c.totalProcessos}</span>
                      {c.processosAtivos > 0 && (
                        <span className="ml-1.5 text-xs text-green-600 font-medium">({c.processosAtivos} ativo{c.processosAtivos !== 1 ? "s" : ""})</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {c.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            title="Ver cliente"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteCliente(c)}
                            title="Excluir cliente"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => abrirVinculoNaoCadastrado(c)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 whitespace-nowrap"
                          >
                            <Link2 className="h-3.5 w-3.5" /> Vincular
                          </button>
                          <button
                            onClick={() => {
                              setPreNome(c.nome);
                              setShowModal(true);
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 whitespace-nowrap"
                          >
                            + Cadastrar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNaoCadastrado(c)}
                            title="Remover da lista"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}

      <NovoClienteModal
        open={showModal}
        preNome={preNome}
        onClose={() => setShowModal(false)}
        onCreated={() => { load(); setShowModal(false); }}
      />
      {showProcessoModal && (
        <NovoProcessoModal
          open
          onClose={() => setShowProcessoModal(false)}
          onCreated={() => { load(); setShowProcessoModal(false); }}
        />
      )}
      <VincularClienteNaoCadastradoModal
        target={linkTarget}
        onClose={() => setLinkTarget(null)}
        onSaved={() => { setLinkTarget(null); load(); }}
      />
      <Modal
        open={!!deleteTarget}
        onClose={fecharDeleteNaoCadastrado}
        title="Remover cliente não cadastrado"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{deleteTarget?.nome}</p>
                <p className="mt-1">
                  Esse nome aparece como não cadastrado porque ainda existe atendimento ou processo usando esse nome.
                  Escolha o que deseja excluir junto.
                </p>
              </div>
            </div>
          </div>

          {deleteLoading || !deleteVinculos ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando vínculos...
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${deleteOptions.atendimentos ? "border-[#21181d] bg-[#21181d]/5" : "border-gray-200 bg-white"} ${deleteVinculos.atendimentos.length === 0 ? "cursor-not-allowed opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={deleteOptions.atendimentos && deleteVinculos.atendimentos.length > 0}
                    disabled={deleteVinculos.atendimentos.length === 0 || deleteActionBusy}
                    onChange={(e) => setDeleteOptions((prev) => ({ ...prev, atendimentos: e.target.checked }))}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#21181d]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">
                      Excluir atendimento{deleteVinculos.atendimentos.length !== 1 ? "s" : ""}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {deleteVinculos.atendimentos.length} encontrado{deleteVinculos.atendimentos.length !== 1 ? "s" : ""}.
                    </span>
                  </span>
                </label>

                <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${deleteOptions.processos ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"} ${deleteVinculos.processos.length === 0 ? "cursor-not-allowed opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={deleteOptions.processos && deleteVinculos.processos.length > 0}
                    disabled={deleteVinculos.processos.length === 0 || deleteActionBusy}
                    onChange={(e) => setDeleteOptions((prev) => ({ ...prev, processos: e.target.checked }))}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-red-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">
                      Excluir processo{deleteVinculos.processos.length !== 1 ? "s" : ""}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {deleteVinculos.processos.length} encontrado{deleteVinculos.processos.length !== 1 ? "s" : ""}. Isso também apaga prazos, audiências e honorários do processo.
                    </span>
                  </span>
                </label>
              </div>

              {deleteVinculos.atendimentos.length === 0 && deleteVinculos.processos.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  Não encontrei vínculos ativos para esse nome. Atualize a página; ele deve sair da lista.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {deleteVinculos.atendimentos.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        <Calendar className="h-3.5 w-3.5" /> Atendimentos encontrados
                      </h3>
                      <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
                        {deleteVinculos.atendimentos.map((a) => (
                          <div key={a.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                            <p className="font-semibold text-gray-900">{formatDate(a.data_hora)} · {a.status}</p>
                            {a.notas && <p className="mt-1 max-h-16 overflow-hidden text-xs leading-5 text-gray-500">{a.notas}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {deleteVinculos.processos.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        <FileText className="h-3.5 w-3.5" /> Processos encontrados
                      </h3>
                      <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
                        {deleteVinculos.processos.map((p) => (
                          <div key={p.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                            <p className="font-semibold text-gray-900">{p.titulo || "Processo sem título"}</p>
                            {p.numero && <p className="mt-1 break-all text-xs text-gray-500">Nº {p.numero}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={fecharDeleteNaoCadastrado} disabled={deleteActionBusy}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmarDeleteNaoCadastrado}
                  disabled={!deleteHasSelection || deleteActionBusy}
                >
                  {deleteActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir selecionados
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function processoLabel(p: Processo): string {
  const numero = p.numero || (p.tipo === "inquerito_policial" ? p.numero_inquerito || "Inquérito sem número" : "Sem número");
  return `${numero} — ${p.titulo || "Processo sem título"} — ${p.cliente_nome || "sem cliente"}`;
}

function VincularClienteNaoCadastradoModal({
  target,
  onClose,
  onSaved,
}: {
  target: Summary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!target;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClienteId("");
    setProcessoId("");
    setErro(null);
    Promise.all([getClientes(), getProcessos()]).then(([cls, procs]) => {
      setClientes(cls);
      setProcessos(procs);
    });
  }, [open, target?.nome]);

  const processosOrdenados = [...processos].sort((a, b) => {
    const aDoCliente = clienteId && a.cliente_id === clienteId ? 0 : 1;
    const bDoCliente = clienteId && b.cliente_id === clienteId ? 0 : 1;
    if (aDoCliente !== bDoCliente) return aDoCliente - bDoCliente;
    return processoLabel(a).localeCompare(processoLabel(b), "pt-BR");
  });

  const clienteSelecionado = clientes.find((c) => c.id === clienteId);
  const processoSelecionado = processos.find((p) => p.id === processoId);
  const processoDeOutroCliente = !!processoSelecionado?.cliente_id && processoSelecionado.cliente_id !== clienteId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !clienteId) return;
    setSaving(true);
    setErro(null);
    try {
      await vincularClienteNaoCadastradoAExistente(target.nome, clienteId, { processoId: processoId || undefined });
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível vincular agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vincular cliente não cadastrado" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{target?.nome}</p>
          <p className="mt-1">
            Esse nome veio de atendimento/triagem ou processo sem vínculo. Escolha o cliente já cadastrado e, se for o caso, o processo existente.
          </p>
        </div>

        <ComboBox
          label="Cliente existente *"
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          value={clienteId}
          onChange={(value) => {
            setClienteId(value);
            const processoAtual = processos.find((p) => p.id === processoId);
            if (value && processoAtual?.cliente_id && processoAtual.cliente_id !== value) setProcessoId("");
          }}
          placeholder="Buscar cliente cadastrado..."
        />

        <ComboBox
          label="Processo existente (opcional)"
          options={processosOrdenados.map((p) => ({ value: p.id, label: processoLabel(p) }))}
          value={processoId}
          onChange={setProcessoId}
          placeholder="Sem processo específico"
        />

        {clienteSelecionado && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Os atendimentos/triagens de <strong>{target?.nome}</strong> passarão a aparecer em <strong>{clienteSelecionado.nome}</strong>
            {processoSelecionado ? <> e também no processo <strong>{processoSelecionado.numero || processoSelecionado.titulo}</strong></> : null}.
          </div>
        )}

        {processoDeOutroCliente && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Este processo está em outro cliente. Ao salvar, ele também será vinculado ao cliente escolhido acima.
          </div>
        )}

        {erro && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!clienteId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {saving ? "Vinculando..." : "Vincular"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NovoClienteModal({ open, preNome, onClose, onCreated }: { open: boolean; preNome?: string; onClose: () => void; onCreated: () => void }) {
  const empty = {
    nome: "", cpf: "", rg: "", sexo: "", nacionalidade: "", estado_civil: "", profissao: "",
    email: "", celular: "",
    cep: "", logradouro: "", numero_end: "", complemento: "",
    bairro: "", cidade: "", uf: "", observacoes: "",
  };
  const [form, setForm] = useState(empty);
  const [clientesExistentes, setClientesExistentes] = useState<Cliente[]>([]);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...empty, nome: preNome ?? "" }));
      setCepStatus("idle");
      getClientes().then(setClientesExistentes);
    }
  }, [open, preNome]);

  function set(field: string, value: string) {
    setForm((f) => {
      if (field !== "sexo") return { ...f, [field]: value };
      return {
        ...f,
        sexo: value,
        nacionalidade: ajustarGenero(f.nacionalidade, value),
        estado_civil: ajustarGenero(f.estado_civil, value),
        profissao: ajustarGenero(f.profissao, value),
      };
    });
  }

  const nacionalidadeBase = mergeOptions(nacionalidadeOptions(form.sexo), valuesToOptions(clientesExistentes.map((c) => c.nacionalidade).map((v) => ajustarGenero(v, form.sexo))));
  const estadoCivilBase = mergeOptions(estadoCivilOptions(form.sexo), valuesToOptions(clientesExistentes.map((c) => c.estado_civil).map((v) => ajustarGenero(v, form.sexo))));
  const profissaoBase = mergeOptions(profissaoOptions(form.sexo), valuesToOptions(clientesExistentes.map((c) => c.profissao).map((v) => ajustarGenero(v, form.sexo))));

  async function handleCepChange(value: string) {
    const masked = formatCEP(value);
    setForm((f) => ({ ...f, cep: masked }));
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    const end = await buscarCep(digits);
    if (end) {
      setForm((f) => ({
        ...f,
        logradouro: end.logradouro,
        bairro: end.bairro,
        cidade: end.cidade,
        uf: end.uf,
      }));
      setCepStatus("ok");
    } else {
      setCepStatus("erro");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    await createCliente({
      nome: form.nome.trim(),
      cpf: form.cpf || undefined,
      rg: form.rg || undefined,
      sexo: form.sexo || undefined,
      nacionalidade: form.nacionalidade || undefined,
      estado_civil: form.estado_civil || undefined,
      profissao: form.profissao || undefined,
      email: form.email || undefined,
      celular: form.celular || undefined,
      cep: form.cep || undefined,
      logradouro: form.logradouro || undefined,
      numero_end: form.numero_end || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      uf: form.uf || undefined,
      observacoes: form.observacoes || undefined,
    });
    setForm(empty);
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Cliente" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
          <div className="space-y-3">
            <Input label="Nome completo *" placeholder="Nome do cliente" value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="CPF" placeholder="000.000.000-00" inputMode="numeric" value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} />
              <Input label="RG" placeholder="00.000.000-0" inputMode="numeric" value={form.rg} onChange={(e) => set("rg", formatRG(e.target.value))} />
              <Select label="Sexo" placeholder="—" options={[{ value: "F", label: "Feminino" }, { value: "M", label: "Masculino" }]} value={form.sexo} onChange={(e) => set("sexo", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectComOutro label="Nacionalidade" category={`cliente_nacionalidade_${form.sexo || "geral"}`} baseOptions={nacionalidadeBase} placeholder="Selecione..." value={form.nacionalidade} onChange={(v) => set("nacionalidade", v)} />
              <SelectComOutro label="Estado civil" category={`cliente_estado_civil_${form.sexo || "geral"}`} baseOptions={estadoCivilBase} placeholder="Selecione..." value={form.estado_civil} onChange={(v) => set("estado_civil", v)} />
              <SelectComOutro label="Profissão" category={`cliente_profissao_${form.sexo || "geral"}`} baseOptions={profissaoBase} placeholder="Selecione..." value={form.profissao} onChange={(v) => set("profissao", v)} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contato</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <Input label="Celular" placeholder="(21) 99999-9999" value={form.celular} onChange={(e) => set("celular", e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Endereço</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Input
                  label="CEP"
                  placeholder="00000-000"
                  inputMode="numeric"
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                />
                {cepStatus === "loading" && <p className="mt-1 text-xs text-gray-400">Buscando endereço…</p>}
                {cepStatus === "ok" && <p className="mt-1 text-xs text-green-600">Endereço preenchido — confira e ajuste se precisar.</p>}
                {cepStatus === "erro" && <p className="mt-1 text-xs text-amber-600">CEP não encontrado. Preencha manualmente.</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="col-span-2">
                <Input label="Logradouro" placeholder="Rua, Av., Travessa..." value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
              <Input label="Número" placeholder="123" value={form.numero_end} onChange={(e) => set("numero_end", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Complemento" placeholder="Apto, Bloco..." value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              <Input label="Bairro" placeholder="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Cidade" placeholder="Rio de Janeiro" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              <Select label="UF" options={ufs} placeholder="UF" value={form.uf} onChange={(e) => set("uf", e.target.value)} />
            </div>
          </div>
        </div>

        <Textarea label="Observações" placeholder="Informações adicionais sobre o cliente..." rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />

        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!form.nome.trim()}>Salvar Cliente</Button>
        </div>
      </form>
    </Modal>
  );
}
