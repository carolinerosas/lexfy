"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, ChevronRight, Search, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getClientesSummary, createCliente, deleteCliente, importarClientesExistentes, contarVinculosClienteNome, excluirClienteNaoCadastrado, type ClienteSummary } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { formatCPF, formatRG, formatCEP, buscarCep } from "@/lib/format";

const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

type Summary = ClienteSummary & { id?: string; cadastrado: boolean };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Summary[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [preNome, setPreNome] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
    const v = await contarVinculosClienteNome(cliente.nome);
    const partes: string[] = [];
    if (v.processos > 0) partes.push(`${v.processos} processo${v.processos !== 1 ? "s" : ""}`);
    if (v.atendimentos > 0) partes.push(`${v.atendimentos} atendimento${v.atendimentos !== 1 ? "s" : ""}`);
    const detalhe = partes.length ? ` Isso também vai apagar ${partes.join(" e ")} vinculado${v.processos + v.atendimentos !== 1 ? "s" : ""} a este nome.` : "";
    if (!window.confirm(`Remover "${cliente.nome}" da lista?${detalhe}\n\nEsta ação não pode ser desfeita.`)) return;
    await excluirClienteNaoCadastrado(cliente.nome);
    await load();
  }

  const load = useCallback(async () => {
    setClientes(await getClientesSummary());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  );

  const cadastrados = clientes.filter((c) => c.cadastrado).length;

  const todosSelecionados = filtered.length > 0 && filtered.every((c) => selecionados.has(keyOf(c)));
  const algumSelecionado = selecionados.size > 0;

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
        else await excluirClienteNaoCadastrado(c.nome);
      }
      await load();
      limparSelecao();
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
                <Button variant="danger" size="sm" onClick={excluirSelecionados} disabled={bulkBusy}>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir selecionados
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
            <Users className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum cliente encontrado</p>
          </div>
        </Card>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {filtered.map((c) => (
            <Card key={c.id ?? c.nome} className={`p-4 ${selecionados.has(keyOf(c)) ? "ring-2 ring-[#21181d]" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selecionados.has(keyOf(c))}
                  onChange={() => toggleSelecionado(keyOf(c))}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#21181d]"
                />
                <div className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${c.cadastrado ? "bg-[#21181d]" : "bg-gray-300"}`}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold leading-snug text-gray-900">{c.nome}</p>
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

              <div className="mt-4">
                {c.id ? (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Link
                      href={`/dashboard/clientes/${c.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#21181d] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2b2027]"
                    >
                      Ver cliente
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteCliente(c)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      title="Excluir cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      onClick={() => {
                        setPreNome(c.nome);
                        setShowModal(true);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      + Cadastrar cliente
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
              </div>
            </Card>
          ))}
        </div>

        <Card className="hidden overflow-hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleTodos}
                    className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                  />
                </th>
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-center px-4 py-3">Processos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                  <tr key={c.id ?? c.nome} className={`transition-colors ${selecionados.has(keyOf(c)) ? "bg-[#21181d]/[0.04]" : "hover:bg-gray-50/60"}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selecionados.has(keyOf(c))}
                        onChange={() => toggleSelecionado(keyOf(c))}
                        className="h-4 w-4 rounded border-gray-300 accent-[#21181d] align-middle"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${c.cadastrado ? "bg-[#21181d]" : "bg-gray-300"}`}>
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{c.nome}</p>
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
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#21181d] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2b2027]"
                          >
                            Ver cliente
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteCliente(c)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
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
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                            title="Remover da lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover
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
    </div>
  );
}

function NovoClienteModal({ open, preNome, onClose, onCreated }: { open: boolean; preNome?: string; onClose: () => void; onCreated: () => void }) {
  const empty = {
    nome: "", cpf: "", rg: "", email: "", celular: "",
    cep: "", logradouro: "", numero_end: "", complemento: "",
    bairro: "", cidade: "", uf: "", observacoes: "",
  };
  const [form, setForm] = useState(empty);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");

  useEffect(() => {
    if (open) { setForm((f) => ({ ...empty, nome: preNome ?? "" })); setCepStatus("idle"); }
  }, [open, preNome]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
        logradouro: end.logradouro || f.logradouro,
        bairro: end.bairro || f.bairro,
        cidade: end.cidade || f.cidade,
        uf: end.uf || f.uf,
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
            <div className="grid grid-cols-2 gap-3">
              <Input label="CPF" placeholder="000.000.000-00" inputMode="numeric" value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} />
              <Input label="RG" placeholder="00.000.000-0" inputMode="numeric" value={form.rg} onChange={(e) => set("rg", formatRG(e.target.value))} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contato</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <Input label="Celular" placeholder="(21) 99999-9999" value={form.celular} onChange={(e) => set("celular", e.target.value)} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Endereço</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Logradouro" placeholder="Rua, Av., Travessa..." value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
              <Input label="Número" placeholder="123" value={form.numero_end} onChange={(e) => set("numero_end", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Complemento" placeholder="Apto, Bloco..." value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              <Input label="Bairro" placeholder="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cidade" placeholder="Rio de Janeiro" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              <Select label="UF" options={ufs} placeholder="UF" value={form.uf} onChange={(e) => set("uf", e.target.value)} />
            </div>
          </div>
        </div>

        <Textarea label="Observações" placeholder="Informações adicionais sobre o cliente..." rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />

        <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-2 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!form.nome.trim()}>Salvar Cliente</Button>
        </div>
      </form>
    </Modal>
  );
}
