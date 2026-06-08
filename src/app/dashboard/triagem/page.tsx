"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, CheckCircle, X, Trash2, ChevronDown, Phone, Clock, ExternalLink, Copy, CheckCircle2, FileText, Sparkles, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getTriagemLeads, updateTriagemLead, deleteTriagemLead,
  getTriagemImportacoes, updateTriagemImportacao, deleteTriagemImportacao,
  createCliente, updateCliente, createAtendimento, getClientes, getProcessos,
  createProcesso, createMovimentacao,
} from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { Cliente, Processo, TriagemImportacao, TriagemImportDraft, TriagemLead } from "@/types";

const urgenciaVariant: Record<string, "danger" | "warning" | "neutral"> = {
  alta: "danger",
  media: "warning",
  baixa: "neutral",
};

type ImportDraft = TriagemImportDraft;

function normalize(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function digits(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

function sameProcess(a?: string, b?: string): boolean {
  return Boolean(a && b && digits(a) === digits(b));
}

function findClienteMatch(clientes: Cliente[], draft?: ImportDraft["cliente"], fallbackName?: string): Cliente | undefined {
  const cpf = digits(draft?.cpf);
  const nome = normalize(draft?.nome || fallbackName);
  return clientes.find((c) => (cpf && digits(c.cpf) === cpf) || (nome && normalize(c.nome) === nome));
}

function buildProcessoDescricao(proc: ImportDraft["processos"][number], observacoesCaso?: string): string {
  const descricao = proc.descricao?.trim();
  const observacoes = observacoesCaso?.trim();
  const partes = [
    descricao && descricao !== "Importado pela triagem assistida." ? descricao : "",
    observacoes && observacoes !== descricao ? observacoes : "",
  ].filter(Boolean);

  return partes.join("\n\n") || descricao || "Importado pela triagem assistida.";
}

function buildClienteDados(draft: ImportDraft, primeiroProcesso?: ImportDraft["processos"][number]): Partial<Cliente> {
  return {
    cpf: draft.cliente?.cpf || primeiroProcesso?.cliente_cpf_cnpj,
    rg: draft.cliente?.rg,
    email: draft.cliente?.email,
    celular: draft.cliente?.celular,
    cep: draft.cliente?.cep,
    logradouro: draft.cliente?.logradouro,
    numero_end: draft.cliente?.numero_end,
    complemento: draft.cliente?.complemento,
    bairro: draft.cliente?.bairro,
    cidade: draft.cliente?.cidade,
    uf: draft.cliente?.uf,
  };
}

async function preencherClienteExistente(cliente: Cliente, dados: Partial<Cliente>): Promise<void> {
  const atualizacao: Partial<Cliente> = {};
  if (!cliente.cpf && dados.cpf) atualizacao.cpf = dados.cpf;
  if (!cliente.rg && dados.rg) atualizacao.rg = dados.rg;
  if (!cliente.email && dados.email) atualizacao.email = dados.email;
  if (!cliente.celular && dados.celular) atualizacao.celular = dados.celular;
  if (!cliente.cep && dados.cep) atualizacao.cep = dados.cep;
  if (!cliente.logradouro && dados.logradouro) atualizacao.logradouro = dados.logradouro;
  if (!cliente.numero_end && dados.numero_end) atualizacao.numero_end = dados.numero_end;
  if (!cliente.complemento && dados.complemento) atualizacao.complemento = dados.complemento;
  if (!cliente.bairro && dados.bairro) atualizacao.bairro = dados.bairro;
  if (!cliente.cidade && dados.cidade) atualizacao.cidade = dados.cidade;
  if (!cliente.uf && dados.uf) atualizacao.uf = dados.uf;

  if (Object.keys(atualizacao).length) {
    await updateCliente(cliente.id, atualizacao);
  }
}

export default function TriagemPage() {
  const [leads, setLeads] = useState<TriagemLead[]>([]);
  const [importacoes, setImportacoes] = useState<TriagemImportacao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [aba, setAba] = useState<"leads" | "importar">("leads");
  const [filter, setFilter] = useState<"novos" | "todos">("novos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [textoImportacao, setTextoImportacao] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [importacaoAtiva, setImportacaoAtiva] = useState<TriagemImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const [salvandoImportacao, setSalvandoImportacao] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [triagem, pendentes, cls, procs] = await Promise.all([
      getTriagemLeads(),
      getTriagemImportacoes(),
      getClientes(),
      getProcessos(),
    ]);
    setLeads(triagem);
    setImportacoes(pendentes);
    setClientes(cls);
    setProcessos(procs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = leads.filter((l) => (filter === "novos" ? l.status === "novo" : true));
  const novos = leads.filter((l) => l.status === "novo").length;
  const importacoesPendentes = importacoes.filter((imp) => imp.status === "pendente");

  const linkTriagem = typeof window !== "undefined" ? `${window.location.origin}/triagem` : "/triagem";

  async function aprovar(l: TriagemLead) {
    setBusy(l.id);
    try {
      const contato = l.contato ?? l.telefone ?? "";
      const email = contato.includes("@") ? contato : undefined;
      const celular = !email ? contato : undefined;
      const cli = await createCliente({
        nome: l.nome?.trim() || "Cliente (triagem)",
        email,
        celular,
        observacoes: [l.area ? `Área: ${l.area}` : "", l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : ""].filter(Boolean).join("\n"),
      });
      await createAtendimento({
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        data_hora: new Date().toISOString(),
        tipo: "consulta_inicial",
        status: "agendado",
        notas: [l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : "", l.area ? `Área: ${l.area}` : "", "(Origem: triagem automática)"].filter(Boolean).join("\n"),
      });
      await updateTriagemLead(l.id, { status: "aprovado" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function descartar(l: TriagemLead) {
    setBusy(l.id);
    try { await updateTriagemLead(l.id, { status: "descartado" }); await load(); }
    finally { setBusy(null); }
  }

  async function excluir(l: TriagemLead) {
    if (!window.confirm("Excluir este lead da triagem?")) return;
    setBusy(l.id);
    try { await deleteTriagemLead(l.id); await load(); }
    finally { setBusy(null); }
  }

  async function analisarImportacao() {
    const texto = textoImportacao.trim();
    if (!texto) return;
    setImportando(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/triagem/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = (await res.json()) as { draft?: ImportDraft; source?: string; error?: string };
      if (!res.ok || !data.draft) throw new Error(data.error || "Não consegui analisar o texto.");
      setDraft(data.draft);
      setImportacaoAtiva(null);
      setImportMsg(data.source === "ai" ? "Dados analisados com IA. Revise antes de salvar." : "Dados extraídos por leitura básica. Revise antes de salvar.");
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Não consegui analisar o texto.");
    } finally {
      setImportando(false);
    }
  }

  async function salvarImportacao() {
    if (!draft) return;
    setSalvandoImportacao(true);
    setImportMsg(null);
    try {
      const primeiroProcesso = draft.processos[0];
      const clienteExistente = findClienteMatch(clientes, draft.cliente, primeiroProcesso?.cliente_nome);
      const nomeCliente = draft.cliente?.nome || primeiroProcesso?.cliente_nome || "Cliente importado";
      const observacoesCaso = draft.cliente?.observacoes;
      const dadosCliente = buildClienteDados(draft, primeiroProcesso);
      const cliente = clienteExistente ?? await createCliente({
        nome: nomeCliente,
        ...dadosCliente,
        observacoes: [
          draft.avisos?.length ? `Avisos: ${draft.avisos.join("; ")}` : "",
        ].filter(Boolean).join("\n\n"),
      });
      if (clienteExistente) {
        await preencherClienteExistente(clienteExistente, dadosCliente);
      }

      let criados = 0;
      let ignorados = 0;
      const processosPorNumero = new Map<string, Processo>();
      processos.forEach((p) => processosPorNumero.set(digits(p.numero), p));

      for (const proc of draft.processos) {
        const existente = processos.find((p) => sameProcess(p.numero, proc.numero));
        if (existente) {
          processosPorNumero.set(digits(existente.numero), existente);
          ignorados += 1;
          continue;
        }

        const novo = await createProcesso({
          numero: proc.numero,
          titulo: proc.titulo || "Processo importado",
          descricao: buildProcessoDescricao(proc, observacoesCaso),
          status: "ativo",
          tribunal: proc.tribunal,
          vara: proc.vara,
          comarca: proc.comarca,
          uf: proc.uf,
          tipo: proc.tipo as Processo["tipo"],
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_cpf_cnpj: draft.cliente?.cpf || proc.cliente_cpf_cnpj,
          parte_contraria: proc.parte_contraria,
          data_distribuicao: proc.data_distribuicao,
          monitorar_datajud: true,
        });
        processosPorNumero.set(digits(novo.numero), novo);
        criados += 1;
      }

      let movs = 0;
      for (const mov of draft.movimentacoes ?? []) {
        const alvo = mov.processo_numero
          ? processosPorNumero.get(digits(mov.processo_numero))
          : draft.processos.length === 1
            ? processosPorNumero.get(digits(draft.processos[0].numero))
            : undefined;
        if (!alvo) continue;
        await createMovimentacao({
          processo_id: alvo.id,
          descricao: mov.descricao,
          data_movimentacao: mov.data_movimentacao || new Date().toISOString().slice(0, 10),
          tipo: mov.tipo || "Importada",
          fonte: mov.fonte || "Triagem assistida",
          lida: false,
        });
        movs += 1;
      }

      if (importacaoAtiva) {
        await updateTriagemImportacao(importacaoAtiva.id, { status: "aprovada" });
      }

      await load();
      setDraft(null);
      setImportacaoAtiva(null);
      setTextoImportacao("");
      setImportMsg(`Importação concluída: ${clienteExistente ? "cliente existente usado" : "cliente criado"}, ${criados} processo(s) criado(s), ${ignorados} já existente(s), ${movs} movimentação(ões).`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Erro ao salvar importação.");
    } finally {
      setSalvandoImportacao(false);
    }
  }

  function carregarImportacao(imp: TriagemImportacao) {
    setAba("importar");
    setImportacaoAtiva(imp);
    setDraft(imp.draft);
    setTextoImportacao(imp.texto_original);
    setImportMsg("Importação pendente carregada. Revise e confirme para salvar.");
  }

  async function descartarImportacao(imp: TriagemImportacao) {
    if (!window.confirm("Descartar esta importação pendente?")) return;
    await updateTriagemImportacao(imp.id, { status: "descartada" });
    if (importacaoAtiva?.id === imp.id) {
      setImportacaoAtiva(null);
      setDraft(null);
      setTextoImportacao("");
    }
    await load();
  }

  async function excluirImportacao(imp: TriagemImportacao) {
    if (!window.confirm("Excluir definitivamente esta importação?")) return;
    await deleteTriagemImportacao(imp.id);
    if (importacaoAtiva?.id === imp.id) {
      setImportacaoAtiva(null);
      setDraft(null);
      setTextoImportacao("");
    }
    await load();
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem</h1>
          <p className="text-gray-500 text-sm mt-1">
            {novos > 0 ? <span className="text-blue-600 font-medium">{novos} novo{novos !== 1 ? "s" : ""} para revisar</span> : "Leads do atendimento automático"}
          </p>
        </div>
        {aba === "leads" && <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["novos", "todos"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {f === "novos" ? "Novos" : "Todos"}
            </button>
          ))}
        </div>}
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {([
          ["leads", "Atendimentos recebidos", MessageSquare, novos],
          ["importar", "Importar dados", UploadCloud, importacoesPendentes.length],
        ] as const).map(([key, label, Icon, count]) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${aba === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count > 0 && (
              <span className="rounded-full bg-[#21181d] px-2 py-0.5 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === "importar" && (
        <ImportacaoAssistida
          texto={textoImportacao}
          setTexto={setTextoImportacao}
          draft={draft}
          onDraftChange={setDraft}
          clientes={clientes}
          processos={processos}
          importando={importando}
          salvando={salvandoImportacao}
          mensagem={importMsg}
          importacoes={importacoesPendentes}
          importacaoAtiva={importacaoAtiva}
          onAnalisar={analisarImportacao}
          onSalvar={salvarImportacao}
          onLimpar={() => { setDraft(null); setImportacaoAtiva(null); setTextoImportacao(""); setImportMsg(null); }}
          onCarregarImportacao={carregarImportacao}
          onDescartarImportacao={descartarImportacao}
          onExcluirImportacao={excluirImportacao}
        />
      )}

      {/* Link do atendimento */}
      {aba === "leads" && <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Link do atendimento automático</p>
            <p className="text-xs text-gray-500 mt-0.5 break-all">{linkTriagem}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(linkTriagem); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {copiado ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copiado ? "Copiado!" : "Copiar"}
          </button>
          <a href={linkTriagem} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#21181d] px-3 text-xs font-semibold text-white hover:bg-[#2b2027]">
            <ExternalLink className="w-4 h-4" /> Abrir
          </a>
        </CardContent>
      </Card>}

      {aba === "leads" && (filtrados.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <MessageSquare className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">{filter === "novos" ? "Nenhum lead novo" : "Nenhum lead ainda"}</p>
            <p className="text-gray-400 text-sm mt-1">Compartilhe o link acima para começar a receber triagens.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((l) => {
            const expandido = aberto === l.id;
            return (
              <Card key={l.id} className={l.status !== "novo" ? "opacity-70" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{l.nome || "Sem nome"}</p>
                        {l.area && <Badge variant="neutral">{l.area}</Badge>}
                        {l.urgencia && <Badge variant={urgenciaVariant[l.urgencia] ?? "neutral"}>{l.urgencia}</Badge>}
                        {l.status === "aprovado" && <span className="text-[11px] font-semibold text-green-600">✓ aprovado</span>}
                        {l.status === "descartado" && <span className="text-[11px] font-semibold text-gray-400">descartado</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {(l.contato || l.telefone) && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {l.contato || l.telefone}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(l.created_at)}</span>
                      </div>
                      {l.resumo && <p className="mt-2 text-sm text-gray-700 line-clamp-3">{l.resumo}</p>}
                      {l.detalhes && <p className="mt-1 text-xs text-gray-500">{l.detalhes}</p>}

                      {l.transcricao && (
                        <button onClick={() => setAberto(expandido ? null : l.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandido ? "rotate-180" : ""}`} />
                          {expandido ? "Ocultar conversa" : "Ver conversa completa"}
                        </button>
                      )}
                      {expandido && l.transcricao && (
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600 font-sans">{l.transcricao}</pre>
                      )}
                    </div>
                  </div>

                  {l.status === "novo" && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                      <Button variant="ghost" size="sm" onClick={() => excluir(l)} disabled={busy === l.id}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => descartar(l)} disabled={busy === l.id}>
                        <X className="w-3.5 h-3.5" /> Descartar
                      </Button>
                      <Button size="sm" onClick={() => aprovar(l)} disabled={busy === l.id}>
                        <CheckCircle className="w-3.5 h-3.5" /> {busy === l.id ? "Aprovando..." : "Aprovar (vira cliente)"}
                      </Button>
                    </div>
                  )}
                  {l.status !== "novo" && (
                    <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                      <Button variant="ghost" size="sm" onClick={() => excluir(l)} disabled={busy === l.id}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ImportacaoAssistida({
  texto,
  setTexto,
  draft,
  onDraftChange,
  clientes,
  processos,
  importando,
  salvando,
  mensagem,
  importacoes,
  importacaoAtiva,
  onAnalisar,
  onSalvar,
  onLimpar,
  onCarregarImportacao,
  onDescartarImportacao,
  onExcluirImportacao,
}: {
  texto: string;
  setTexto: (value: string) => void;
  draft: ImportDraft | null;
  onDraftChange: (draft: ImportDraft | null) => void;
  clientes: Cliente[];
  processos: Processo[];
  importando: boolean;
  salvando: boolean;
  mensagem: string | null;
  importacoes: TriagemImportacao[];
  importacaoAtiva: TriagemImportacao | null;
  onAnalisar: () => void;
  onSalvar: () => void;
  onLimpar: () => void;
  onCarregarImportacao: (imp: TriagemImportacao) => void;
  onDescartarImportacao: (imp: TriagemImportacao) => void;
  onExcluirImportacao: (imp: TriagemImportacao) => void;
}) {
  const clienteMatch = findClienteMatch(clientes, draft?.cliente, draft?.processos[0]?.cliente_nome);
  const processosNovos = draft?.processos.filter((p) => !processos.some((existente) => sameProcess(existente.numero, p.numero))).length ?? 0;
  const processosExistentes = (draft?.processos.length ?? 0) - processosNovos;

  function setClienteField(field: keyof NonNullable<ImportDraft["cliente"]>, value: string) {
    if (!draft) return;
    onDraftChange({
      ...draft,
      cliente: {
        ...(draft.cliente ?? {}),
        [field]: value || undefined,
      },
    });
  }

  function setProcessoField(index: number, field: keyof ImportDraft["processos"][number], value: string) {
    if (!draft) return;
    onDraftChange({
      ...draft,
      processos: draft.processos.map((proc, i) => (
        i === index ? { ...proc, [field]: value || undefined } : proc
      )),
    });
  }

  function setMovimentacaoField(
    index: number,
    field: keyof NonNullable<ImportDraft["movimentacoes"]>[number],
    value: string
  ) {
    if (!draft) return;
    onDraftChange({
      ...draft,
      movimentacoes: (draft.movimentacoes ?? []).map((mov, i) => (
        i === index ? { ...mov, [field]: value || undefined } : mov
      )),
    });
  }

  return (
    <div className="space-y-4">
      {importacoes.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Importações pendentes</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Recebidas pelo agente e aguardando sua revisão antes de criar cliente ou processo.
                </p>
              </div>
              <Badge variant="neutral">{importacoes.length}</Badge>
            </div>

            <div className="space-y-2">
              {importacoes.map((imp) => {
                const primeiro = imp.draft.processos[0];
                const titulo = imp.draft.cliente?.nome || primeiro?.cliente_nome || "Cliente não identificado";
                const detalhe = [primeiro?.numero || "Sem CNJ", formatDateTime(imp.created_at), imp.origem || "agente"]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={imp.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 ${importacaoAtiva?.id === imp.id ? "border-[#21181d] bg-gray-50" : "border-gray-100"}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{titulo}</p>
                      <p className="mt-1 text-xs text-gray-500">{detalhe}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => onCarregarImportacao(imp)}>
                        {importacaoAtiva?.id === imp.id ? "Carregada" : "Revisar"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onDescartarImportacao(imp)}>
                        Descartar
                      </Button>
                      <button
                        type="button"
                        onClick={() => onExcluirImportacao(imp)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Excluir importação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#21181d] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Importar cliente e processos</h2>
              <p className="mt-1 text-sm text-gray-500">
                Cole dados vindos do tribunal, WhatsApp, e-mail, planilha ou consulta processual. O Justio vai organizar e pedir sua confirmação antes de salvar.
              </p>
            </div>
          </div>

          <Textarea
            label="Dados para importar"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Exemplo:\nCliente: Maria Silva\nCPF: 000.000.000-00\nProcesso: 0000000-00.2024.8.19.0001\nComarca: Rio de Janeiro\nVara: 2ª Vara de Família\nParte contrária: João Silva\nResumo: ação de guarda..."}
            className="min-h-[220px] font-mono text-xs leading-relaxed"
          />

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" onClick={onLimpar} disabled={importando || salvando || (!texto && !draft)}>
              Limpar
            </Button>
            <Button onClick={onAnalisar} disabled={!texto.trim() || importando || salvando}>
              <FileText className="h-4 w-4" /> {importando ? "Analisando..." : "Analisar dados"}
            </Button>
          </div>

          {mensagem && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {mensagem}
            </div>
          )}
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardContent className="space-y-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">Prévia da importação</h3>
                  {importacaoAtiva && <Badge variant="neutral">pendente do agente</Badge>}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {processosNovos} processo(s) novo(s), {processosExistentes} já existente(s)
                </p>
              </div>
              <Button onClick={onSalvar} disabled={salvando || draft.processos.length === 0}>
                <CheckCircle className="h-4 w-4" /> {salvando ? "Salvando..." : "Confirmar e salvar"}
              </Button>
            </div>

            {draft.avisos?.length ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {draft.avisos.join(" ")}
              </div>
            ) : null}

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Cliente</p>
                {clienteMatch && <Badge variant="neutral">já existe: {clienteMatch.nome}</Badge>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Nome" value={draft.cliente?.nome ?? draft.processos[0]?.cliente_nome ?? ""} onChange={(e) => setClienteField("nome", e.target.value)} />
                <Input label="CPF" value={draft.cliente?.cpf ?? ""} onChange={(e) => setClienteField("cpf", e.target.value)} />
                <Input label="RG" value={draft.cliente?.rg ?? ""} onChange={(e) => setClienteField("rg", e.target.value)} />
                <Input label="E-mail" type="email" value={draft.cliente?.email ?? ""} onChange={(e) => setClienteField("email", e.target.value)} />
                <Input label="Celular" value={draft.cliente?.celular ?? ""} onChange={(e) => setClienteField("celular", e.target.value)} />
                <Input label="CEP" value={draft.cliente?.cep ?? ""} onChange={(e) => setClienteField("cep", e.target.value)} />
                <Input label="Logradouro" value={draft.cliente?.logradouro ?? ""} onChange={(e) => setClienteField("logradouro", e.target.value)} />
                <Input label="Número" value={draft.cliente?.numero_end ?? ""} onChange={(e) => setClienteField("numero_end", e.target.value)} />
                <Input label="Complemento" value={draft.cliente?.complemento ?? ""} onChange={(e) => setClienteField("complemento", e.target.value)} />
                <Input label="Bairro" value={draft.cliente?.bairro ?? ""} onChange={(e) => setClienteField("bairro", e.target.value)} />
                <Input label="Cidade" value={draft.cliente?.cidade ?? ""} onChange={(e) => setClienteField("cidade", e.target.value)} />
                <Input label="UF" maxLength={2} value={draft.cliente?.uf ?? ""} onChange={(e) => setClienteField("uf", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Processos</p>
              {draft.processos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                  Nenhum processo CNJ encontrado.
                </div>
              ) : (
                draft.processos.map((proc, index) => {
                  const existente = processos.find((p) => sameProcess(p.numero, proc.numero));
                  return (
                    <div key={index} className="rounded-xl border border-gray-100 p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Processo {index + 1}</p>
                        {existente ? <Badge variant="neutral">já existe</Badge> : <Badge variant="success">novo</Badge>}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input label="Número CNJ" value={proc.numero ?? ""} onChange={(e) => setProcessoField(index, "numero", e.target.value)} />
                        <Input label="Título / classe" value={proc.titulo ?? ""} onChange={(e) => setProcessoField(index, "titulo", e.target.value)} />
                        <Input label="Tribunal" value={proc.tribunal ?? ""} onChange={(e) => setProcessoField(index, "tribunal", e.target.value)} />
                        <Input label="UF" maxLength={2} value={proc.uf ?? ""} onChange={(e) => setProcessoField(index, "uf", e.target.value.toUpperCase())} />
                        <Input label="Comarca" value={proc.comarca ?? ""} onChange={(e) => setProcessoField(index, "comarca", e.target.value)} />
                        <Input label="Vara" value={proc.vara ?? ""} onChange={(e) => setProcessoField(index, "vara", e.target.value)} />
                        <Input label="Parte contrária" value={proc.parte_contraria ?? ""} onChange={(e) => setProcessoField(index, "parte_contraria", e.target.value)} />
                        <Input label="Tipo" value={proc.tipo ?? ""} onChange={(e) => setProcessoField(index, "tipo", e.target.value)} />
                        <Input label="Data de distribuição" type="date" value={proc.data_distribuicao ?? ""} onChange={(e) => setProcessoField(index, "data_distribuicao", e.target.value)} />
                        <div className="md:col-span-2">
                          <Textarea
                            label="Descrição do caso"
                            value={proc.descricao ?? ""}
                            onChange={(e) => setProcessoField(index, "descricao", e.target.value)}
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {draft.movimentacoes?.length ? (
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Movimentações detectadas</p>
                <div className="space-y-4">
                  {draft.movimentacoes.map((mov, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 md:grid-cols-2">
                      <Input label="Processo vinculado" value={mov.processo_numero ?? ""} onChange={(e) => setMovimentacaoField(index, "processo_numero", e.target.value)} />
                      <Input label="Data" type="date" value={mov.data_movimentacao ?? ""} onChange={(e) => setMovimentacaoField(index, "data_movimentacao", e.target.value)} />
                      <Input label="Tipo" value={mov.tipo ?? ""} onChange={(e) => setMovimentacaoField(index, "tipo", e.target.value)} />
                      <Input label="Fonte" value={mov.fonte ?? ""} onChange={(e) => setMovimentacaoField(index, "fonte", e.target.value)} />
                      <div className="md:col-span-2">
                        <Textarea
                          label="Descrição"
                          value={mov.descricao ?? ""}
                          onChange={(e) => setMovimentacaoField(index, "descricao", e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
