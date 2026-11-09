"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, DollarSign, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { Modal } from "./modal";
import { Input } from "./input";
import { SelectComOutro } from "./select-com-outro";
import { RecebimentoModal } from "./recebimento-modal";
import { ReciboModal } from "./recibo-modal";
import {
  getHonorarios, createHonorario, excluirCobranca, alterarDataRecebimento,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Cliente, Honorario, Processo } from "@/types";

const honorarioTipoOptions = [
  { value: "contratual", label: "Contratual" },
  { value: "sucumbencial", label: "Sucumbencial" },
  { value: "exito", label: "Êxito" },
  { value: "outro", label: "Outro" },
];

function hojeISODate(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addMesesISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function dividirValor(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const arr = Array(n).fill(base);
  const rem = cents - base * n;
  for (let i = 0; i < rem; i++) arr[i] += 1;
  return arr.map((c) => c / 100);
}

export function totaisHonorarios(honorarios: Honorario[]) {
  const cobrado = honorarios.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
  const recebido = honorarios.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
  return { cobrado, recebido, saldo: cobrado - recebido };
}

export function ResumoHonorarios({ honorarios }: { honorarios: Honorario[] }) {
  const { cobrado, recebido, saldo } = totaisHonorarios(honorarios);
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-gray-50 rounded-xl px-2 py-3 text-center sm:px-4">
        <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Cobrado</p>
        <p className="text-[10px] font-black text-gray-900 tabular-nums sm:text-xs">{formatCurrency(cobrado)}</p>
      </div>
      <div className="bg-green-50 rounded-xl px-2 py-3 text-center sm:px-4">
        <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Recebido</p>
        <p className="text-[10px] font-black text-green-700 tabular-nums sm:text-xs">{formatCurrency(recebido)}</p>
      </div>
      <div className={`rounded-xl px-2 py-3 text-center sm:px-4 ${saldo > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
        <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Saldo a receber</p>
        <p className={`text-[10px] font-black tabular-nums sm:text-xs ${saldo > 0 ? "text-amber-700" : "text-gray-400"}`}>{formatCurrency(Math.max(0, saldo))}</p>
      </div>
    </div>
  );
}

// Honorários de UM processo: resumo, cobranças/parcelas, receber, recibo, corrigir data e excluir.
// Usado na aba Honorários do processo e na aba Honorários do cliente (um bloco por processo).
export function HonorariosPanel({ processo, cliente, mostrarResumo = true, onChange }: {
  processo: Pick<Processo, "id" | "numero" | "cliente_nome" | "cliente_id">;
  cliente?: Cliente;
  mostrarResumo?: boolean;
  onChange?: () => void;
}) {
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [novaOpen, setNovaOpen] = useState(false);
  const [recebendo, setRecebendo] = useState<Honorario | null>(null);
  const [recibo, setRecibo] = useState<Honorario | null>(null);
  const [editandoData, setEditandoData] = useState<Honorario | null>(null);

  const load = useCallback(async () => {
    const todos = await getHonorarios();
    setHonorarios(todos.filter((h) => h.processo_id === processo.id));
  }, [processo.id]);

  useEffect(() => { load(); }, [load]);

  const atualizar = useCallback(async () => {
    await load();
    onChange?.();
  }, [load, onChange]);

  async function excluir(h: Honorario) {
    const aviso = h.status === "recebido"
      ? `Excluir "${h.descricao}" (${formatCurrency(h.valor)})? O recebimento dela também sai do total recebido.`
      : `Excluir "${h.descricao}" (${formatCurrency(h.valor)})?`;
    if (!confirm(aviso)) return;
    await excluirCobranca(h);
    atualizar();
  }

  const cobrancas = honorarios
    .filter((h) => h.categoria === "cobranca")
    .sort((a, b) => (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999"));

  return (
    <div className="space-y-6">
      {mostrarResumo && <ResumoHonorarios honorarios={honorarios} />}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Cobranças e parcelas</h4>
          <Button size="sm" variant="outline" onClick={() => setNovaOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Cobrança
          </Button>
        </div>
        {cobrancas.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">Nenhuma cobrança registrada. Clique em “Cobrança” para lançar (à vista ou parcelada).</p>
        ) : (
          <div className="space-y-2">
            {cobrancas.map((h) => {
              const recebida = h.status === "recebido";
              const venc = h.data_vencimento ? new Date(h.data_vencimento + "T00:00:00") : null;
              const vencida = !recebida && venc && !isNaN(venc.getTime()) && venc < new Date(new Date().toDateString());
              return (
                <Card key={h.id}>
                  <CardContent className="py-3 px-5">
                    <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${recebida ? "bg-green-50 text-green-600" : vencida ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        {recebida ? <CheckCircle className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{h.descricao}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {recebida ? (
                            <button
                              type="button"
                              onClick={() => setEditandoData(h)}
                              title="Corrigir a data do recebimento"
                              className="inline-flex items-center gap-1 hover:text-gray-700"
                            >
                              Recebido{h.data_recebimento ? ` em ${formatDate(h.data_recebimento)}` : ""}
                              <Pencil className="w-3 h-3" />
                            </button>
                          ) : h.data_vencimento
                            ? <>vence {formatDate(h.data_vencimento)}{vencida && <span className="ml-1 font-semibold text-red-600">(vencida)</span>}</>
                            : (h.tipo ?? "Honorário")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-900">{formatCurrency(h.valor)}</span>
                      {!recebida && (
                        <Button size="sm" onClick={() => setRecebendo(h)}>
                          <CheckCircle className="w-3.5 h-3.5" /> Recebido
                        </Button>
                      )}
                      {recebida && (
                        <Button size="sm" variant="outline" onClick={() => setRecibo(h)} title="Emitir recibo no timbrado">
                          <FileText className="w-3.5 h-3.5" /> Recibo
                        </Button>
                      )}
                      <button onClick={() => excluir(h)} title="Excluir" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NovaCobrancaModal open={novaOpen} onClose={() => setNovaOpen(false)} processoId={processo.id} onCreated={() => { setNovaOpen(false); atualizar(); }} />
      <RecebimentoModal honorario={recebendo} onClose={() => setRecebendo(null)} onDone={() => { setRecebendo(null); atualizar(); }} />
      <ReciboModal
        honorario={recibo}
        cliente={cliente}
        processo={{ numero: processo.numero, cliente_nome: processo.cliente_nome, cliente_id: processo.cliente_id }}
        onClose={() => setRecibo(null)}
      />
      <DataRecebimentoModal honorario={editandoData} onClose={() => setEditandoData(null)} onSaved={() => { setEditandoData(null); atualizar(); }} />
    </div>
  );
}

function DataRecebimentoModal({ honorario, onClose, onSaved }: {
  honorario: Honorario | null; onClose: () => void; onSaved: () => void;
}) {
  const [data, setData] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (honorario) setData(honorario.data_recebimento ?? hojeISODate());
  }, [honorario]);

  if (!honorario) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!honorario || !data) return;
    setSaving(true);
    try {
      await alterarDataRecebimento(honorario, data);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Data do recebimento" size="sm">
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-gray-600">{honorario.descricao} · {formatCurrency(honorario.valor)}</p>
        <Input label="Recebido em" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!data || saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function NovaCobrancaModal({ open, onClose, processoId, onCreated }: {
  open: boolean; onClose: () => void; processoId: string; onCreated: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [entrada, setEntrada] = useState("");
  const [saving, setSaving] = useState(false);

  const nParcelas = Math.max(1, Math.min(60, parseInt(parcelas) || 1));
  const totalVal = parseFloat(valor) || 0;
  const entradaVal = parseFloat(entrada) || 0;
  const restanteVal = Math.max(0, Math.round((totalVal - entradaVal) * 100) / 100);
  const valorParcela = restanteVal > 0 ? restanteVal / nParcelas : 0;
  const qtdLanc = (entradaVal > 0 ? 1 : 0) + (restanteVal > 0 ? nParcelas : 0);

  useEffect(() => {
    if (open) {
      setDescricao(""); setValor(""); setTipo("");
      setVencimento(""); setParcelas("1"); setEntrada("");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor) return;
    setSaving(true);
    try {
      const base = descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim() || "Honorários";
      const hoje = hojeISODate();
      const lanc: { descricao: string; valor: number; venc?: string }[] = [];
      if (entradaVal > 0) lanc.push({ descricao: `${base} — Entrada`, valor: entradaVal, venc: hoje });
      if (restanteVal > 0) {
        const valores = dividirValor(restanteVal, nParcelas);
        for (let i = 0; i < nParcelas; i++) {
          lanc.push({
            descricao: nParcelas > 1 ? `${base} (${i + 1}/${nParcelas})` : base,
            valor: valores[i],
            venc: vencimento ? addMesesISO(vencimento, i) : undefined,
          });
        }
      }
      for (const l of lanc) {
        await createHonorario({
          processo_id: processoId,
          descricao: l.descricao,
          valor: l.valor,
          tipo: (tipo as Honorario["tipo"]) || undefined,
          categoria: "cobranca",
          status: "pendente",
          data_lancamento: hoje,
          data_vencimento: l.venc,
        });
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Cobrança" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Descrição *" placeholder="Ex: Honorários contratuais" value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={nParcelas > 1 || entradaVal > 0 ? "Valor total (R$) *" : "Valor (R$) *"}
            type="number" min="0" step="0.01" placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <SelectComOutro label="Tipo" category="honorario_tipo" baseOptions={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(v) => setTipo(v)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Entrada (R$)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="opcional" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          <Input label="Parcelas (x)" type="number" min="1" max="60" step="1" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
        </div>
        <Input label={nParcelas > 1 ? "1º vencimento das parcelas" : "Vencimento"} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        {valor && (entradaVal > 0 || nParcelas > 1) && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {[
              entradaVal > 0 ? `Entrada de ${formatCurrency(entradaVal)} (hoje)` : "",
              restanteVal > 0 ? `${nParcelas}x de aprox. ${formatCurrency(valorParcela)}${vencimento ? ` a partir de ${formatDate(vencimento)}` : ""}` : "",
            ].filter(Boolean).join(" + ")}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!descricao || !valor || saving}>
            {saving ? "Salvando..." : qtdLanc > 1 ? `Lançar ${qtdLanc} lançamentos` : "Registrar cobrança"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
