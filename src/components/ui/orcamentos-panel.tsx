"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createOrcamento, deleteOrcamento, getOrcamentos, lancarHonorariosContratados, updateOrcamento } from "@/lib/store";
import type { Cliente, Orcamento, Processo } from "@/types";

// Aba "Orçamentos" do cliente: o valor proposto antes de fechar o contrato. Quando o cliente
// fecha, "Cliente fechou" lança entrada e parcelas como honorários no processo escolhido.

const reais = (v?: number | null) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const campo = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";

function numero(texto: string): number | undefined {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && !Number.isNaN(n) ? n : undefined;
}

function resumo(o: Pick<Orcamento, "valor_total" | "entrada" | "parcelas" | "valor_parcela">): string {
  const partes = [reais(o.valor_total)];
  if (o.entrada) partes.push(`entrada de ${reais(o.entrada)}`);
  if (o.parcelas) partes.push(`${o.parcelas}x de ${reais(o.valor_parcela ?? (o.valor_total - (o.entrada ?? 0)) / o.parcelas)}`);
  return partes.join(", ");
}

const STATUS: Record<Orcamento["status"], string> = { enviado: "Aguardando resposta", aceito: "Fechou ✓", recusado: "Recusado" };

export function OrcamentosPanel({ cliente, processos }: { cliente: Cliente; processos: Processo[] }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [form, setForm] = useState<{ descricao: string; total: string; entrada: string; parcelas: string; parcela: string; vencimento: string; obs: string } | null>(null);
  const [fechando, setFechando] = useState<{ o: Orcamento; processoId: string } | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    getOrcamentos(cliente.id).then(setOrcamentos).catch((e) => setErro(e.message));
  }, [cliente.id]);

  useEffect(() => {
    getOrcamentos(cliente.id).then(setOrcamentos).catch((e) => setErro(e.message));
  }, [cliente.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const total = numero(form.total);
    if (!form.descricao.trim() || !total) return setErro("Informe a descrição e o valor total.");
    setErro("");
    await createOrcamento({
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      descricao: form.descricao.trim(),
      valor_total: total,
      entrada: numero(form.entrada) ?? null,
      parcelas: numero(form.parcelas) ?? null,
      valor_parcela: numero(form.parcela) ?? null,
      primeiro_vencimento: form.vencimento || null,
      observacoes: form.obs.trim() || null,
    });
    setForm(null);
    carregar();
  }

  async function confirmarFechamento() {
    if (!fechando) return;
    const { o, processoId } = fechando;
    if (!processoId) return setErro("Escolha o processo onde os honorários serão lançados.");
    const n = await lancarHonorariosContratados(processoId, o);
    await updateOrcamento(o.id, { status: "aceito", processo_id: processoId, aceito_em: new Date().toISOString() });
    setFechando(null);
    setErro("");
    window.alert(`${n} lançamento(s) de honorários criados no processo.`);
    carregar();
  }

  const mensagem = (o: Orcamento) =>
    `Olá, ${cliente.nome.split(" ")[0]}! Segue a proposta de honorários para ${o.descricao}: ${resumo(o)}${o.primeiro_vencimento ? `, com a primeira parcela em ${dataBR(o.primeiro_vencimento)}` : ""}.${o.observacoes ? ` ${o.observacoes}` : ""} Qualquer dúvida, estou à disposição. Dra. Caroline Fraga`;
  const fone = (cliente.celular ?? "").replace(/\D/g, "");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Orçamentos</p>
              <p className="mt-1 text-xs text-gray-500">O valor que você propõe antes do contrato. Quando o cliente fechar, os honorários são lançados no processo.</p>
            </div>
            {!form && (
              <Button size="sm" onClick={() => setForm({ descricao: "", total: "", entrada: "", parcelas: "", parcela: "", vencimento: "", obs: "" })}>
                <Plus className="w-3.5 h-3.5" /> Novo orçamento
              </Button>
            )}
          </div>
          {form && (
            <form onSubmit={salvar} className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
              <input className={`${campo} sm:col-span-3`} placeholder="Serviço (ex.: Divórcio com partilha, guarda e alimentos)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              <input className={campo} placeholder="Valor total (R$)" inputMode="decimal" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
              <input className={campo} placeholder="Entrada (R$)" inputMode="decimal" value={form.entrada} onChange={(e) => setForm({ ...form, entrada: e.target.value })} />
              <input className={campo} placeholder="Nº de parcelas" inputMode="numeric" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} />
              <input className={campo} placeholder="Valor da parcela (R$)" inputMode="decimal" value={form.parcela} onChange={(e) => setForm({ ...form, parcela: e.target.value })} />
              <label className="text-xs text-gray-500 sm:col-span-2">
                1ª parcela em
                <input className={campo} type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
              </label>
              <input className={`${campo} sm:col-span-3`} placeholder="Observações (o que está incluído, validade...)" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
              <div className="flex justify-end gap-2 sm:col-span-3">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar orçamento</Button>
              </div>
            </form>
          )}
          {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </CardContent>
      </Card>

      {orcamentos.map((o) => (
        <Card key={o.id} className={o.status === "recusado" ? "opacity-60" : ""}>
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{o.descricao}</p>
                <p className="text-sm text-gray-700">{resumo(o)}{o.primeiro_vencimento ? ` · 1ª parcela ${dataBR(o.primeiro_vencimento)}` : ""}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {STATUS[o.status]} · proposto em {dataBR(o.created_at)}
                  {o.observacoes ? ` · ${o.observacoes}` : ""}
                </p>
              </div>
              {o.status === "enviado" && (
                <div className="flex flex-wrap items-center gap-1">
                  {fone && (
                    <a href={`https://wa.me/55${fone}?text=${encodeURIComponent(mensagem(o))}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-[#25D366] hover:bg-gray-50" title="Mandar a proposta pelo WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setFechando({ o, processoId: processos.length === 1 ? processos[0].id : "" })}>
                    <Check className="w-3.5 h-3.5" /> Cliente fechou
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await updateOrcamento(o.id, { status: "recusado" }); carregar(); }} title="Recusado">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm("Excluir este orçamento?")) { await deleteOrcamento(o.id); carregar(); } }} title="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {fechando?.o.id === o.id && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                <p className="mb-2 text-sm text-emerald-900">Lançar como honorários em qual processo?</p>
                {processos.length === 0 ? (
                  <p className="text-xs text-emerald-900">Este cliente ainda não tem processo. Cadastre o processo (pode ser &quot;a ajuizar&quot;, sem número) e volte aqui.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select className={`${campo} max-w-md`} value={fechando.processoId} onChange={(e) => setFechando({ ...fechando, processoId: e.target.value })}>
                      <option value="">Escolha o processo…</option>
                      {processos.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.numero ? ` — ${p.numero}` : " (a ajuizar)"}</option>)}
                    </select>
                    <Button size="sm" onClick={confirmarFechamento}>Lançar honorários</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFechando(null)}>Cancelar</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
