"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, TrendingUp, FolderOpen, ChevronRight, Search, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getClientesSummary, createCliente, importarClientesExistentes, type ClienteSummary } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

type Summary = ClienteSummary & { id?: string; cadastrado: boolean };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Summary[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [preNome, setPreNome] = useState("");

  const naoCadastrados = clientes.filter((c) => !c.cadastrado).length;

  async function handleImportar() {
    const count = await importarClientesExistentes();
    if (count > 0) {
      load();
    }
  }

  const load = useCallback(async () => {
    setClientes(await getClientesSummary());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  );

  const totalPago = clientes.reduce((s, c) => s + c.totalPago, 0);
  const totalSaldo = clientes.reduce((s, c) => s + c.saldo, 0);
  const cadastrados = clientes.filter((c) => c.cadastrado).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {cadastrados} cadastrado{cadastrados !== 1 ? "s" : ""} · {clientes.length} no total
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-xl font-black tracking-tight text-gray-900">{clientes.length}</p>
            <p className="text-sm text-gray-500 mt-0.5">Total de Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-xl font-black tracking-tight text-gray-900">{formatCurrency(totalPago)}</p>
            <p className="text-sm text-gray-500 mt-0.5">Total Recebido</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <FolderOpen className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xl font-black tracking-tight text-white">{formatCurrency(totalSaldo)}</p>
            <p className="text-sm text-gray-400 mt-0.5">Saldo a Receber</p>
          </CardContent>
        </Card>
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

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum cliente encontrado</p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-center px-4 py-3">Processos</th>
                <th className="text-right px-4 py-3">Cobrado</th>
                <th className="text-right px-4 py-3">Recebido</th>
                <th className="text-right px-4 py-3">Saldo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                  <tr key={c.id ?? c.nome} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${c.cadastrado ? "bg-gray-900" : "bg-gray-300"}`}>
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
                    <td className="px-4 py-4 text-right text-sm text-gray-700 font-medium">{formatCurrency(c.totalCobrado)}</td>
                    <td className="px-4 py-4 text-right text-sm text-green-700 font-medium">{formatCurrency(c.totalPago)}</td>
                    <td className="px-4 py-4 text-right">
                      <span className={`text-sm font-bold ${c.saldo > 0 ? "text-amber-700" : "text-gray-400"}`}>
                        {formatCurrency(c.saldo)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {c.id ? (
                        <Link href={`/dashboard/clientes/${c.id}`} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            setPreNome(c.nome);
                            setShowModal(true);
                          }}
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                        >
                          + Cadastrar
                        </button>
                      )}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </Card>
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

  useEffect(() => {
    if (open) setForm((f) => ({ ...empty, nome: preNome ?? "" }));
  }, [open, preNome]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
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
              <Input label="CPF" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
              <Input label="RG" placeholder="00.000.000-0" value={form.rg} onChange={(e) => set("rg", e.target.value)} />
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
              <div className="col-span-2">
                <Input label="Logradouro" placeholder="Rua, Av., Travessa..." value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
              <Input label="Número" placeholder="123" value={form.numero_end} onChange={(e) => set("numero_end", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Complemento" placeholder="Apto, Bloco..." value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
              <Input label="Bairro" placeholder="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="CEP" placeholder="00000-000" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
              <Input label="Cidade" placeholder="Rio de Janeiro" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              <Select label="UF" options={ufs} placeholder="UF" value={form.uf} onChange={(e) => set("uf", e.target.value)} />
            </div>
          </div>
        </div>

        <Textarea label="Observações" placeholder="Informações adicionais sobre o cliente..." rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!form.nome.trim()}>Salvar Cliente</Button>
        </div>
      </form>
    </Modal>
  );
}
