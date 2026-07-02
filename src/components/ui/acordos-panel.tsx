"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, CheckCircle2, ArrowDownCircle, ArrowUpCircle, Handshake, ChevronRight } from "lucide-react";
import { Modal } from "./modal";
import { Input } from "./input";
import { Button } from "./button";
import { Select } from "./select";
import { ComboBox } from "./combobox";
import { Badge } from "./badge";
import {
  getAcordoParcelas, getAcordoParcelasByProcesso, createAcordo,
  updateAcordoParcela, updateAcordoPagamento, deleteAcordoParcela, deleteAcordo, getProcessos,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AcordoParcela, AcordoDirecao, Processo } from "@/types";

function normalizarNome(v?: string): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function hojeISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function splitValor(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const arr = Array(n).fill(base);
  for (let i = 0; i < cents - base * n; i++) arr[i] += 1;
  return arr.map((c) => c / 100);
}

type Grupo = {
  grupoId: string;
  titulo?: string;
  direcao: AcordoDirecao;
  processoId?: string;
  clienteNome?: string;
  primeira?: AcordoParcela;
  parcelas: AcordoParcela[];
  total: number;
  pago: number;
};

function agrupar(parcelas: AcordoParcela[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const p of parcelas) {
    const g = mapa.get(p.grupo_id) ?? {
      grupoId: p.grupo_id, titulo: p.titulo, direcao: p.direcao,
      processoId: p.processo_id, clienteNome: p.cliente_nome, primeira: p, parcelas: [], total: 0, pago: 0,
    };
    g.parcelas.push(p);
    g.total += p.valor;
    if (p.pago) g.pago += p.valor;
    mapa.set(p.grupo_id, g);
  }
  const grupos = [...mapa.values()];
  grupos.forEach((g) => g.parcelas.sort((a, b) => a.numero - b.numero));
  return grupos.sort((a, b) => (a.parcelas[0]?.data_vencimento ?? "").localeCompare(b.parcelas[0]?.data_vencimento ?? ""));
}

// Painel de acordos parcelados. Com processoId, mostra os do processo; sem ele, todos (financeiro).
export function AcordosPanel({
  processoId,
  clienteNome,
  clienteFiltro,
  onChanged,
}: {
  processoId?: string;
  clienteNome?: string;
  clienteFiltro?: string; // na ficha do cliente: mostra os acordos deste cliente (por nome)
  onChanged?: () => void;
}) {
  const [parcelas, setParcelas] = useState<AcordoParcela[]>([]);
  const [novoOpen, setNovoOpen] = useState(false);
  const [editando, setEditando] = useState<AcordoParcela | null>(null);
  const [editandoAcordo, setEditandoAcordo] = useState<Grupo | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [procNumero, setProcNumero] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!processoId) getProcessos().then((ps) => setProcNumero(new Map(ps.map((p) => [p.id, p.numero]))));
  }, [processoId]);

  function alternarAberto(grupoId: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  }

  const load = useCallback(async () => {
    setParcelas(processoId ? await getAcordoParcelasByProcesso(processoId) : await getAcordoParcelas());
  }, [processoId]);

  useEffect(() => { load(); }, [load]);

  const visiveis = clienteFiltro
    ? parcelas.filter((p) => normalizarNome(p.cliente_nome) === normalizarNome(clienteFiltro))
    : parcelas;
  const grupos = agrupar(visiveis);

  async function recarregar() {
    await load();
    onChanged?.();
  }

  async function alternarPago(p: AcordoParcela) {
    await updateAcordoParcela(p.id, p.pago
      ? { pago: false, data_pagamento: undefined }
      : { pago: true, data_pagamento: hojeISO() });
    await recarregar();
  }

  async function excluirParcela(p: AcordoParcela) {
    if (!window.confirm("Excluir esta parcela do acordo?")) return;
    await deleteAcordoParcela(p.id);
    await recarregar();
  }

  async function excluirAcordo(g: Grupo) {
    if (!window.confirm(`Excluir o acordo inteiro (${g.parcelas.length} parcela(s))?`)) return;
    await deleteAcordo(g.grupoId);
    await recarregar();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Acordos (parcelamento)</h4>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo acordo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Nenhum acordo cadastrado. Registre um parcelamento de acordo com valores e vencimentos.
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const receber = g.direcao === "receber";
            const saldo = Math.max(0, g.total - g.pago);
            const aberto = abertos.has(g.grupoId);
            return (
              <div key={g.grupoId} className="rounded-xl border border-gray-100">
                <div className={`flex items-center gap-2 bg-gray-50/60 px-4 py-3 ${aberto ? "border-b border-gray-100" : ""}`}>
                  <button type="button" onClick={() => alternarAberto(g.grupoId)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                    <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${aberto ? "rotate-90" : ""}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{g.titulo || "Acordo"}</p>
                        <Badge variant={receber ? "success" : "warning"}>{receber ? "a receber" : "a pagar"}</Badge>
                        {!processoId && (
                          <span className="text-xs text-gray-500">
                            · {g.processoId && procNumero.get(g.processoId) ? `Proc ${procNumero.get(g.processoId)}` : "sem processo"}
                            {!clienteFiltro && g.clienteNome ? ` · ${g.clienteNome}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {g.parcelas.length} parcela(s) · Total {formatCurrency(g.total)} · Pago {formatCurrency(g.pago)} · Falta {formatCurrency(saldo)}
                      </p>
                      {aberto && (() => {
                        const d = g.primeira;
                        const partes = [
                          d?.forma_pagamento,
                          d?.pix ? `PIX: ${d.pix}` : "",
                          d?.banco ? `Banco ${d.banco}` : "",
                          d?.agencia ? `Ag ${d.agencia}` : "",
                          d?.conta ? `C/C ${d.conta}` : "",
                        ].filter(Boolean);
                        return partes.length > 0 ? (
                          <p className="mt-1 text-xs text-gray-600"><span className="font-semibold text-gray-500">Pagamento:</span> {partes.join(" · ")}</p>
                        ) : null;
                      })()}
                      {aberto && g.primeira?.observacoes && <p className="mt-0.5 text-xs text-gray-500">{g.primeira.observacoes}</p>}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => setEditandoAcordo(g)} title="Editar dados do acordo" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => excluirAcordo(g)} title="Excluir acordo" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {aberto && (
                <ul className="divide-y divide-gray-50">
                  {g.parcelas.map((p) => {
                    const venc = p.data_vencimento ? new Date(p.data_vencimento + "T00:00:00") : null;
                    const vencida = !p.pago && venc && venc < new Date(new Date().toDateString());
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.pago ? "bg-green-50 text-green-600" : receber ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                          {p.pago ? <CheckCircle2 className="h-4 w-4" /> : receber ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">Parcela {p.numero}/{p.total_parcelas}</p>
                          <p className="text-xs text-gray-400">
                            {p.pago
                              ? `pago${p.data_pagamento ? ` em ${formatDate(p.data_pagamento)}` : ""}`
                              : p.data_vencimento
                                ? <>vence {formatDate(p.data_vencimento)}{vencida && <span className="ml-1 font-semibold text-red-600">(vencida)</span>}</>
                                : "sem vencimento"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{formatCurrency(p.valor)}</span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => alternarPago(p)}
                            title={p.pago ? "Desmarcar" : "Marcar como pago"}
                            className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors ${p.pago ? "text-green-600 hover:bg-green-50" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> {p.pago ? "Pago" : "Pago?"}
                          </button>
                          <button onClick={() => setEditando(p)} title="Editar parcela" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => excluirParcela(p)} title="Excluir parcela" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novoOpen && (
        <NovoAcordoModal
          processoId={processoId}
          clienteNome={clienteNome}
          clienteFiltro={clienteFiltro}
          onClose={() => setNovoOpen(false)}
          onCreated={() => { setNovoOpen(false); recarregar(); }}
        />
      )}
      {editando && (
        <EditarParcelaModal
          parcela={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
      {editandoAcordo && (
        <EditarAcordoModal
          grupo={editandoAcordo}
          onClose={() => setEditandoAcordo(null)}
          onSaved={() => { setEditandoAcordo(null); recarregar(); }}
        />
      )}
    </div>
  );
}

function NovoAcordoModal({
  processoId,
  clienteNome,
  clienteFiltro,
  onClose,
  onCreated,
}: {
  processoId?: string;
  clienteNome?: string;
  clienteFiltro?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [procId, setProcId] = useState(processoId ?? "");
  const [titulo, setTitulo] = useState("");
  const [direcao, setDirecao] = useState<AcordoDirecao>("receber");
  const [total, setTotal] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [nParcelas, setNParcelas] = useState("1");
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO());
  const [parcelas, setParcelas] = useState<Array<{ valor: string; venc: string }>>([]);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!processoId) getProcessos().then(setProcessos);
  }, [processoId]);

  // Na ficha do cliente, só mostra os processos daquele cliente.
  const processosDisponiveis = clienteFiltro
    ? processos.filter((p) => normalizarNome(p.cliente_nome) === normalizarNome(clienteFiltro))
    : processos;

  function gerarParcelas() {
    const n = Math.max(1, Math.min(360, parseInt(nParcelas) || 1));
    const parcelaNum = parseFloat(valorParcela.replace(",", ".")) || 0;
    let valores: number[];
    if (parcelaNum > 0) {
      // Valor da parcela informado: todas iguais e o total é calculado (parcela × nº).
      valores = Array(n).fill(parcelaNum);
      setTotal(String(Math.round(parcelaNum * n * 100) / 100));
    } else {
      const totalNum = parseFloat(total.replace(",", ".")) || 0;
      valores = totalNum > 0 ? splitValor(totalNum, n) : Array(n).fill(0);
    }
    setParcelas(valores.map((v, i) => ({
      valor: v ? String(v) : "",
      venc: primeiroVenc ? addMonthsISO(primeiroVenc, i) : "",
    })));
  }

  function setParcela(i: number, campo: "valor" | "venc", valor: string) {
    setParcelas((arr) => arr.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  }

  const clienteDoProcesso = processoId ? clienteNome : (processos.find((p) => p.id === procId)?.cliente_nome ?? clienteNome);
  const podeSalvar = parcelas.length > 0 && (!!procId || !!clienteNome);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSalvar) return;
    setSaving(true);
    try {
      await createAcordo({
        processo_id: procId || undefined,
        cliente_nome: clienteDoProcesso,
        direcao,
        titulo: titulo.trim() || "Acordo",
        parcelas: parcelas.map((p) => ({
          valor: parseFloat(p.valor.replace(",", ".")) || 0,
          data_vencimento: p.venc || undefined,
        })),
        forma_pagamento: formaPagamento.trim() || undefined,
        banco: banco.trim() || undefined,
        agencia: agencia.trim() || undefined,
        conta: conta.trim() || undefined,
        pix: pix.trim() || undefined,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo acordo (parcelamento)" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {!processoId && (
          <div>
            <ComboBox
              label={clienteNome ? "Processo de referência (opcional)" : "Processo *"}
              options={processosDisponiveis.map((p) => ({ value: p.id, label: `${p.numero || "Sem número"} · ${p.cliente_nome}` }))}
              value={procId}
              onChange={setProcId}
              placeholder={clienteNome ? "Sem processo — fica só na ficha do cliente" : "Selecione o processo do acordo"}
            />
            {clienteNome && <p className="mt-1 text-xs text-gray-400">Sem processo, o acordo fica só na ficha de {clienteNome}.</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Título do acordo" placeholder="Ex.: Acordo — ação de cobrança" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Select
            label="Direção"
            options={[{ value: "receber", label: "A receber (entra)" }, { value: "pagar", label: "A pagar (sai)" }]}
            value={direcao}
            onChange={(e) => setDirecao(e.target.value as AcordoDirecao)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Valor total" type="number" step="0.01" min="0" placeholder="0,00" value={total} onChange={(e) => setTotal(e.target.value)} />
          <Input label="Valor da parcela" type="number" step="0.01" min="0" placeholder="0,00" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} />
          <Input label="Nº parcelas" type="number" min="1" value={nParcelas} onChange={(e) => setNParcelas(e.target.value)} />
        </div>
        <p className="-mt-2 text-xs text-gray-400">Preencha o <strong>valor total</strong> (divide em parcelas iguais) ou o <strong>valor da parcela</strong> (calcula o total = parcela × nº). Depois dá pra ajustar cada linha.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input label="1º vencimento" type="date" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} />
          <Button type="button" variant="secondary" onClick={gerarParcelas}>Gerar parcelas</Button>
        </div>

        {parcelas.length > 0 && (
          <div className="space-y-2 rounded-xl border border-gray-100 p-3">
            <p className="text-xs font-semibold text-gray-500">Parcelas — ajuste valor e vencimento se precisar</p>
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">{i + 1}/{parcelas.length}</span>
                <Input type="number" step="0.01" min="0" placeholder="Valor" value={p.valor} onChange={(e) => setParcela(i, "valor", e.target.value)} />
                <Input type="date" value={p.venc} onChange={(e) => setParcela(i, "venc", e.target.value)} />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-semibold text-gray-500">Dados de pagamento (opcional)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Forma de pagamento"
              placeholder="—"
              options={[
                { value: "PIX", label: "PIX" },
                { value: "Transferência/TED", label: "Transferência / TED" },
                { value: "Boleto", label: "Boleto" },
                { value: "Depósito", label: "Depósito" },
                { value: "Dinheiro", label: "Dinheiro" },
                { value: "Cartão", label: "Cartão" },
                { value: "Outro", label: "Outro" },
              ]}
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            />
            <Input label="Chave PIX" placeholder="CPF, e-mail, telefone..." value={pix} onChange={(e) => setPix(e.target.value)} />
            <Input label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
            <Input label="Agência" value={agencia} onChange={(e) => setAgencia(e.target.value)} />
            <Input label="Conta" value={conta} onChange={(e) => setConta(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving || !podeSalvar}>
            {saving ? "Salvando..." : "Salvar acordo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditarAcordoModal({
  grupo,
  onClose,
  onSaved,
}: {
  grupo: Grupo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const d = grupo.primeira;
  const [titulo, setTitulo] = useState(grupo.titulo ?? "");
  const [direcao, setDirecao] = useState<AcordoDirecao>(grupo.direcao);
  const [formaPagamento, setFormaPagamento] = useState(d?.forma_pagamento ?? "");
  const [banco, setBanco] = useState(d?.banco ?? "");
  const [agencia, setAgencia] = useState(d?.agencia ?? "");
  const [conta, setConta] = useState(d?.conta ?? "");
  const [pix, setPix] = useState(d?.pix ?? "");
  const [observacoes, setObservacoes] = useState(d?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAcordoPagamento(grupo.grupoId, {
        titulo: titulo.trim() || "Acordo",
        direcao,
        forma_pagamento: formaPagamento.trim() || undefined,
        banco: banco.trim() || undefined,
        agencia: agencia.trim() || undefined,
        conta: conta.trim() || undefined,
        pix: pix.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar dados do acordo" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Título do acordo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Select
            label="Direção"
            options={[{ value: "receber", label: "A receber (entra)" }, { value: "pagar", label: "A pagar (sai)" }]}
            value={direcao}
            onChange={(e) => setDirecao(e.target.value as AcordoDirecao)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Forma de pagamento"
            placeholder="—"
            options={[
              { value: "PIX", label: "PIX" },
              { value: "Transferência/TED", label: "Transferência / TED" },
              { value: "Boleto", label: "Boleto" },
              { value: "Depósito", label: "Depósito" },
              { value: "Dinheiro", label: "Dinheiro" },
              { value: "Cartão", label: "Cartão" },
              { value: "Outro", label: "Outro" },
            ]}
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
          />
          <Input label="Chave PIX" placeholder="CPF, e-mail, telefone..." value={pix} onChange={(e) => setPix(e.target.value)} />
          <Input label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
          <Input label="Agência" value={agencia} onChange={(e) => setAgencia(e.target.value)} />
          <Input label="Conta" value={conta} onChange={(e) => setConta(e.target.value)} />
        </div>
        <Input label="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditarParcelaModal({
  parcela,
  onClose,
  onSaved,
}: {
  parcela: AcordoParcela;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valor, setValor] = useState(String(parcela.valor));
  const [venc, setVenc] = useState(parcela.data_vencimento ?? "");
  const [pago, setPago] = useState(parcela.pago);
  const [dataPag, setDataPag] = useState(parcela.data_pagamento ?? hojeISO());
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAcordoParcela(parcela.id, {
        valor: parseFloat(valor.replace(",", ".")) || 0,
        data_vencimento: venc || undefined,
        pago,
        data_pagamento: pago ? (dataPag || hojeISO()) : undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar parcela ${parcela.numero}/${parcela.total_parcelas}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Valor" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Vencimento" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[#21181d]" />
          Pago
        </label>
        {pago && (
          <Input label="Data do pagamento" type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
        )}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
