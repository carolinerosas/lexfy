"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FolderOpen, DollarSign, Users,
  ChevronRight, TrendingUp, TrendingDown,
  Pencil, Trash2, Phone, Mail, MapPin, CreditCard, Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getCliente, updateCliente, deleteCliente,
  getProcessosByCliente, getHonorariosByCliente,
  getAtendimentosByCliente, getPrazosByCliente, getAudienciasByCliente,
} from "@/lib/store";
import { formatCurrency, formatDate, formatDateTime, daysUntil, prazoColor } from "@/lib/utils";
import type { Cliente, Processo, Honorario, Atendimento, Prazo, Audiencia } from "@/types";

const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

const statusVariant: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  ativo: "success", suspenso: "warning", arquivado: "neutral", encerrado: "neutral",
};

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.nome as string;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [prazos, setPrazos] = useState<(Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [audiencias, setAudiencias] = useState<(Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const c = await getCliente(id);
    if (!c) { router.push("/dashboard/clientes"); return; }
    setCliente(c);
    const dedup = <T extends { id: string }>(arr: T[]) =>
      arr.filter((item, i, self) => self.findIndex((x) => x.id === item.id) === i);
    const [procId, procNome, honId, honNome, atenId, atenNome, prazId, prazNome, audId, audNome] = await Promise.all([
      getProcessosByCliente(c.id),
      getProcessosByCliente(c.nome),
      getHonorariosByCliente(c.id),
      getHonorariosByCliente(c.nome),
      getAtendimentosByCliente(c.id),
      getAtendimentosByCliente(c.nome),
      getPrazosByCliente(c.id),
      getPrazosByCliente(c.nome),
      getAudienciasByCliente(c.id),
      getAudienciasByCliente(c.nome),
    ]);
    setProcessos(dedup([...procId, ...procNome]));
    setHonorarios(dedup([...honId, ...honNome]));
    setAtendimentos(dedup([...atenId, ...atenNome]));
    setPrazos(dedup([...prazId, ...prazNome]));
    setAudiencias(dedup([...audId, ...audNome]));
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (!cliente) return null;

  const cobracas = honorarios.filter((h) => h.categoria === "cobranca");
  const pagamentos = honorarios.filter((h) => h.categoria === "pagamento");
  const totalCobrado = cobracas.reduce((s, h) => s + h.valor, 0);
  const totalPago = pagamentos.reduce((s, h) => s + h.valor, 0);
  const saldo = Math.max(0, totalCobrado - totalPago);

  const prazosAbertos = prazos.filter((p) => !p.concluido);
  const audienciasProximas = audiencias.filter((a) => !a.realizada);

  const endereco = [
    cliente.logradouro,
    cliente.numero_end ? `nº ${cliente.numero_end}` : null,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade,
    cliente.uf,
    cliente.cep,
  ].filter(Boolean).join(", ");

  async function handleDelete() {
    if (!confirm(`Excluir o cliente "${cliente!.nome}"? Esta ação não pode ser desfeita.`)) return;
    await deleteCliente(id);
    router.push("/dashboard/clientes");
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <Link href="/dashboard/clientes" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Clientes
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-900 text-white text-xl font-bold flex items-center justify-center shrink-0">
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{cliente.nome}</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {processos.length} processo{processos.length !== 1 ? "s" : ""} · {atendimentos.length} atendimento{atendimentos.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Editar
            </Button>
            <button onClick={handleDelete} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors border border-gray-200">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dados Pessoais</p>
            {cliente.cpf && (
              <div className="flex items-center gap-2.5 text-sm">
                <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 w-8">CPF</span>
                <span className="text-gray-900 font-medium">{cliente.cpf}</span>
              </div>
            )}
            {cliente.rg && (
              <div className="flex items-center gap-2.5 text-sm">
                <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 w-8">RG</span>
                <span className="text-gray-900 font-medium">{cliente.rg}</span>
              </div>
            )}
            {!cliente.cpf && !cliente.rg && (
              <p className="text-sm text-gray-400">Nenhum documento cadastrado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contato</p>
            {cliente.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline">{cliente.email}</a>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <a href={`tel:${cliente.celular}`} className="text-gray-900 font-medium hover:text-blue-600">{cliente.celular}</a>
              </div>
            )}
            {endereco && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-700 leading-snug">{endereco}</span>
              </div>
            )}
            {!cliente.email && !cliente.celular && !endereco && (
              <p className="text-sm text-gray-400">Nenhum contato cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {cliente.observacoes && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observações</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{cliente.observacoes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <DollarSign className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xl font-black tracking-tight text-gray-900">{formatCurrency(totalCobrado)}</p>
            <p className="text-sm text-gray-500 mt-0.5">Total Cobrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <TrendingUp className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xl font-black tracking-tight text-green-700">{formatCurrency(totalPago)}</p>
            <p className="text-sm text-gray-500 mt-0.5">Total Recebido</p>
          </CardContent>
        </Card>
        <Card className={saldo > 0 ? "bg-gray-900 border-gray-800" : ""}>
          <CardContent className="p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${saldo > 0 ? "bg-white/10" : "bg-gray-100"}`}>
              <TrendingDown className={`w-4 h-4 ${saldo > 0 ? "text-gray-300" : "text-gray-400"}`} />
            </div>
            <p className={`text-xl font-black tracking-tight ${saldo > 0 ? "text-white" : "text-gray-400"}`}>{formatCurrency(saldo)}</p>
            <p className={`text-sm mt-0.5 ${saldo > 0 ? "text-gray-400" : "text-gray-500"}`}>Saldo Devedor</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Processos</CardTitle>
                <span className="text-xs text-gray-400">{processos.length} no total</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {processos.length === 0 ? (
                <EmptyState icon={<FolderOpen className="w-8 h-8 text-gray-200" />} text="Nenhum processo vinculado" />
              ) : (
                <ul className="divide-y divide-gray-50">
                  {processos.map((p) => (
                    <li key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <Link href={`/dashboard/processos/${p.id}`} className="flex items-center gap-3 px-6 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.titulo}</p>
                            <Badge variant={statusVariant[p.status]}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{p.numero}</p>
                          {p.tribunal && <p className="text-xs text-gray-400 mt-0.5">{p.tribunal}{p.vara ? ` · ${p.vara}` : ""}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Honorários</CardTitle>
              <Link href="/dashboard/financeiro" className="text-xs text-gray-400 hover:text-gray-700">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {honorarios.length === 0 ? (
              <EmptyState icon={<DollarSign className="w-8 h-8 text-gray-200" />} text="Nenhum honorário" />
            ) : (
              <ul className="divide-y divide-gray-50">
                {honorarios.slice(0, 6).map((h) => (
                  <li key={h.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{h.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.categoria === "pagamento"
                          ? h.data_recebimento ? formatDate(h.data_recebimento) : "—"
                          : h.data_lancamento ? formatDate(h.data_lancamento) : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${h.categoria === "pagamento" ? "text-green-700" : "text-blue-700"}`}>
                        {formatCurrency(h.valor)}
                      </p>
                      <Badge variant={h.categoria === "pagamento" ? "success" : "info"} className="mt-0.5">
                        {h.categoria === "pagamento" ? "Pagamento" : "Cobrança"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Atendimentos</CardTitle>
              <Link href="/dashboard/atendimentos" className="text-xs text-gray-400 hover:text-gray-700">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {atendimentos.length === 0 ? (
              <EmptyState icon={<Users className="w-8 h-8 text-gray-200" />} text="Nenhum atendimento" />
            ) : (
              <ul className="divide-y divide-gray-50">
                {atendimentos.slice(0, 5).map((a) => (
                  <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatDateTime(a.data_hora)}</p>
                      {a.notas && <p className="text-xs text-gray-400 truncate mt-0.5">{a.notas}</p>}
                    </div>
                    <Badge variant={a.status === "realizado" ? "success" : a.status === "cancelado" ? "danger" : "warning"}>
                      {a.status === "agendado" ? "Agendado" : a.status === "realizado" ? "Realizado" : "Cancelado"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {prazosAbertos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Prazos em Aberto</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-50">
                {prazosAbertos.slice(0, 5).map((p) => {
                  const days = daysUntil(p.data_prazo);
                  return (
                    <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.titulo}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.processo?.numero ?? "—"}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${prazoColor(days)}`}>
                        {days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? "Hoje" : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {audienciasProximas.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Audiências</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-50">
                {audienciasProximas.slice(0, 5).map((a) => {
                  const raw = a.data_hora ?? "";
                  const dt = raw ? new Date(raw.includes("T") ? raw : raw + "T00:00") : null;
                  const dia = dt ? dt.getDate().toString().padStart(2, "0") : "—";
                  const mes = dt
                    ? dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()
                    : "";
                  const hora = raw.slice(11, 16);
                  const temHora = hora && hora !== "00:00";
                  return (
                    <li key={a.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 shrink-0">
                        <span className="text-sm font-black text-blue-700 leading-none">{dia}</span>
                        <span className="text-[9px] font-bold text-blue-400 uppercase mt-0.5 tracking-wide">{mes}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.titulo}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {temHora ? `${hora}h` : ""}
                          {temHora && a.local ? " · " : ""}
                          {a.local ?? (!temHora ? "—" : "")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <EditClienteModal
        open={editOpen}
        cliente={cliente}
        onClose={() => setEditOpen(false)}
        onSaved={() => { load(); setEditOpen(false); }}
      />
    </div>
  );
}

function EditClienteModal({ open, cliente, onClose, onSaved }: {
  open: boolean; cliente: Cliente; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...cliente });
  useEffect(() => { setForm({ ...cliente }); }, [cliente]);
  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await updateCliente(cliente.id, {
      nome: form.nome, cpf: form.cpf || undefined, rg: form.rg || undefined,
      email: form.email || undefined, celular: form.celular || undefined,
      cep: form.cep || undefined, logradouro: form.logradouro || undefined,
      numero_end: form.numero_end || undefined, complemento: form.complemento || undefined,
      bairro: form.bairro || undefined, cidade: form.cidade || undefined,
      uf: form.uf || undefined, observacoes: form.observacoes || undefined,
    });
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar Cliente" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
          <div className="space-y-3">
            <Input label="Nome completo *" value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="CPF" placeholder="000.000.000-00" value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} />
              <Input label="RG" placeholder="00.000.000-0" value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contato</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="E-mail" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            <Input label="Celular" value={form.celular ?? ""} onChange={(e) => set("celular", e.target.value)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Endereço</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label="Logradouro" value={form.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
              <Input label="Número" value={form.numero_end ?? ""} onChange={(e) => set("numero_end", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Complemento" value={form.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
              <Input label="Bairro" value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="CEP" value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
              <Input label="Cidade" value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
              <Select label="UF" options={ufs} placeholder="UF" value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value)} />
            </div>
          </div>
        </div>
        <Textarea label="Observações" rows={3} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-6">
      <div className="mb-2">{icon}</div>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
