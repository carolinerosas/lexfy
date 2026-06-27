"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, CheckCircle, X, Trash2, ChevronDown, Phone, Clock, ExternalLink, Copy, CheckCircle2, FileText, Sparkles, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ComboBox } from "@/components/ui/combobox";
import { SelectComOutro } from "@/components/ui/select-com-outro";
import {
  getTriagemLeads, updateTriagemLead, deleteTriagemLead,
  getTriagemImportacoes, updateTriagemImportacao, deleteTriagemImportacao,
  createCliente, updateCliente, createAtendimento, getClientes, getProcessos,
  createProcesso, createMovimentacao, updateProcesso,
} from "@/lib/store";
import { comarcaBaseOptions, mergeOptions, tipoPenalBaseOptions, unidadePrisionalBaseOptions, valuesToOptions, varaBaseOptions } from "@/lib/cadastro-options";
import { partesDoProcesso } from "@/lib/processo-partes";
import { formatCEP, buscarCep } from "@/lib/format";
import { buscarNoDataJud, DataJudError, formatarCNJ, parseCNJ, ufFromTribunalDataJud } from "@/lib/datajud";
import { inferirTipoDataJud, descricaoDataJud } from "@/app/dashboard/processos/novo-processo-modal";
import { formatDateTime } from "@/lib/utils";
import type { Cliente, Processo, ProcessoClienteParte, TriagemImportacao, TriagemImportDraft, TriagemLead } from "@/types";

const urgenciaVariant: Record<string, "danger" | "warning" | "neutral"> = {
  alta: "danger",
  media: "warning",
  baixa: "neutral",
};

type ImportDraft = TriagemImportDraft;

const processoTipoLabels: Record<string, string> = {
  civel: "Cível",
  familia: "Família",
  criminal: "Criminal",
  juri: "Júri",
  execucao_penal: "Execução penal",
  inquerito_policial: "Inquérito policial",
  bo_pm: "BO PM",
  trabalhista: "Trabalhista",
  previdenciario: "Previdenciário",
  tributario: "Tributário",
  federal: "Federal",
  outro: "Outro",
};

const processoTipoOptions = Object.entries(processoTipoLabels).map(([value, label]) => ({ value, label }));

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

function processoLabel(processo: Processo): string {
  const numero = processo.numero || (processo.tipo === "inquerito_policial" ? processo.numero_inquerito || "Inquérito sem número" : "Sem número");
  const classe = processo.tipo ? processoTipoLabels[processo.tipo] ?? processo.tipo : "Sem classificação";
  const penal = isPenalTipo(processo.tipo) && processo.tipo_penal ? ` — ${processo.tipo_penal}` : "";
  return `${numero} — ${classe}${penal} — ${processo.titulo || "Processo sem título"} — ${processo.cliente_nome || "sem cliente"}`;
}

function isPenalTipo(tipo?: string): boolean {
  const normalized = (tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[\s-]+/g, "_");
  return ["criminal", "juri", "execucao_penal"].includes(normalized);
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
  const [leadParaAprovar, setLeadParaAprovar] = useState<TriagemLead | null>(null);
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

  async function aprovar(l: TriagemLead, vinculos: { clienteId?: string; processoId?: string } = {}) {
    setBusy(l.id);
    try {
      const contato = l.contato ?? l.telefone ?? "";
      const email = contato.includes("@") ? contato : undefined;
      const celular = !email ? contato : undefined;
      const processo = vinculos.processoId ? processos.find((p) => p.id === vinculos.processoId) : undefined;
      const clienteExistente = vinculos.clienteId ? clientes.find((c) => c.id === vinculos.clienteId) : undefined;
      const cli = clienteExistente ?? await createCliente({
        nome: l.nome?.trim() || processo?.cliente_nome || "Cliente (triagem)",
        email,
        celular,
        observacoes: [l.area ? `Área: ${l.area}` : "", l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : ""].filter(Boolean).join("\n"),
      });
      if (clienteExistente) {
        await preencherClienteExistente(clienteExistente, { email, celular });
      }
      if (processo && (processo.cliente_id !== cli.id || processo.cliente_nome !== cli.nome)) {
        await updateProcesso(processo.id, { cliente_id: cli.id, cliente_nome: cli.nome });
      }
      await createAtendimento({
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        processo_id: processo?.id,
        data_hora: new Date().toISOString(),
        tipo: "consulta_inicial",
        status: "agendado",
        notas: [l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : "", l.area ? `Área: ${l.area}` : "", "(Origem: triagem automática)"].filter(Boolean).join("\n"),
      });
      await updateTriagemLead(l.id, { status: "aprovado" });
      await load();
      setLeadParaAprovar(null);
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
      // Remove partes duplicadas (mesmo cliente_id ou mesmo nome).
      const dedupPartes = (lista: ProcessoClienteParte[]): ProcessoClienteParte[] => {
        const seen = new Set<string>();
        const out: ProcessoClienteParte[] = [];
        for (const p of lista) {
          const k = p.cliente_id || p.nome.trim().toLocaleLowerCase("pt-BR");
          if (!k || seen.has(k)) continue;
          seen.add(k);
          out.push(p);
        }
        return out;
      };
      // Mantém os litisconsortes como foram preenchidos. NÃO cria cliente automaticamente:
      // só vira cliente quando a usuária clica em "+ cliente" (aí a parte já vem com cliente_id).
      const resolverPartes = (extras?: ProcessoClienteParte[]): ProcessoClienteParte[] =>
        (extras ?? [])
          .filter((p) => p.nome?.trim())
          .map((p) => ({ ...p, nome: p.nome.trim(), papel: p.papel || "Litisconsorte" }));

      const primeiroProcesso = draft.processos[0];
      const clienteEscolhido = draft.cliente_id ? clientes.find((c) => c.id === draft.cliente_id) : undefined;
      const clienteExistente = draft.cliente_id === ""
        ? undefined
        : clienteEscolhido ?? findClienteMatch(clientes, draft.cliente, primeiroProcesso?.cliente_nome);
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

      const hoje = new Date().toISOString().slice(0, 10);
      let criados = 0;
      let reusados = 0;
      const processosPorNumero = new Map<string, Processo>();
      processos.forEach((p) => {
        const key = digits(p.numero);
        if (key) processosPorNumero.set(key, p);
      });
      const comMovimentacao = new Set<string>();

      // 1) Resolve cada processo: cria se for novo, reaproveita se já existe.
      for (const proc of draft.processos) {
        const existente = proc.processo_id
          ? processos.find((p) => p.id === proc.processo_id)
          : processos.find((p) => sameProcess(p.numero, proc.numero));
        if (existente) {
          const upd: Partial<Processo> = {};
          if (existente.cliente_id !== cliente.id) upd.cliente_id = cliente.id;
          if (existente.cliente_nome !== cliente.nome) upd.cliente_nome = cliente.nome;
          const partesAtuais = partesDoProcesso(existente);
          const extrasResolvidas = resolverPartes(proc.clientes_partes);
          upd.clientes_partes = dedupPartes([
            ...partesAtuais,
            { cliente_id: cliente.id, nome: cliente.nome, cpf_cnpj: draft.cliente?.cpf || proc.cliente_cpf_cnpj, papel: partesAtuais.length === 0 ? "Cliente principal" : "Cliente" },
            ...extrasResolvidas,
          ]);
          if (isPenalTipo(existente.tipo)) {
            if (proc.unidade_prisional && !existente.unidade_prisional) upd.unidade_prisional = proc.unidade_prisional;
            if (proc.tipo_penal && !existente.tipo_penal) upd.tipo_penal = proc.tipo_penal;
            if (proc.tipo_penal && !(existente.tipos_penais ?? []).includes(proc.tipo_penal)) upd.tipos_penais = [...(existente.tipos_penais ?? []), proc.tipo_penal];
          }
          if (Object.keys(upd).length) {
            await updateProcesso(existente.id, upd);
          }
          const keyExistente = digits(existente.numero);
          const keyDraft = digits(proc.numero);
          if (keyExistente) processosPorNumero.set(keyExistente, existente);
          if (keyDraft) processosPorNumero.set(keyDraft, existente);
          reusados += 1;
          continue;
        }

        const extrasNovo = resolverPartes(proc.clientes_partes);
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
          clientes_partes: dedupPartes([
            { cliente_id: cliente.id, nome: cliente.nome, cpf_cnpj: draft.cliente?.cpf || proc.cliente_cpf_cnpj, papel: "Cliente principal" },
            ...extrasNovo,
          ]),
          parte_contraria: proc.parte_contraria,
          data_distribuicao: proc.data_distribuicao,
          unidade_prisional: isPenalTipo(proc.tipo) ? proc.unidade_prisional : undefined,
          tipo_penal: isPenalTipo(proc.tipo) ? proc.tipo_penal : undefined,
          tipos_penais: isPenalTipo(proc.tipo) && proc.tipo_penal ? [proc.tipo_penal] : undefined,
          monitorar_datajud: true,
        });
        const keyNovo = digits(novo.numero);
        if (keyNovo) processosPorNumero.set(keyNovo, novo);
        criados += 1;
      }

      let movs = 0;
      // 2) Movimentações explícitas detectadas pela IA.
      for (const mov of draft.movimentacoes ?? []) {
        const alvo = mov.processo_numero
          ? processosPorNumero.get(digits(mov.processo_numero))
          : draft.processos.length === 1
            ? processosPorNumero.get(digits(draft.processos[0].numero))
            : undefined;
        if (!alvo || !mov.descricao?.trim()) continue;
        await createMovimentacao({
          processo_id: alvo.id,
          descricao: mov.descricao,
          data_movimentacao: mov.data_movimentacao || hoje,
          tipo: mov.tipo || "Andamento",
          fonte: mov.fonte || "Triagem assistida",
          lida: false,
        });
        comMovimentacao.add(alvo.id);
        movs += 1;
      }

      // 3) Garante uma movimentação por processo (novo OU existente), com o andamento
      //    do import — sem duplicar quando a IA já gerou uma para o mesmo processo.
      for (const proc of draft.processos) {
        const alvo = processosPorNumero.get(digits(proc.numero));
        if (!alvo || comMovimentacao.has(alvo.id)) continue;
        const conteudo = buildProcessoDescricao(proc, observacoesCaso);
        if (!conteudo.trim() || conteudo === "Importado pela triagem assistida.") continue;
        await createMovimentacao({
          processo_id: alvo.id,
          descricao: conteudo,
          data_movimentacao: proc.data_distribuicao || hoje,
          tipo: "Andamento",
          fonte: "Triagem assistida",
          lida: false,
        });
        comMovimentacao.add(alvo.id);
        movs += 1;
      }

      if (importacaoAtiva) {
        await updateTriagemImportacao(importacaoAtiva.id, { status: "aprovada" });
      }

      await load();
      setDraft(null);
      setImportacaoAtiva(null);
      setTextoImportacao("");
      setImportMsg(`Importação concluída: ${clienteExistente ? "cliente existente usado" : "cliente criado"}, ${criados} processo(s) novo(s), ${reusados} já existente(s), ${movs} movimentação(ões) lançada(s).`);
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
          recarregar={load}
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
                      <Button size="sm" onClick={() => setLeadParaAprovar(l)} disabled={busy === l.id}>
                        <CheckCircle className="w-3.5 h-3.5" /> {busy === l.id ? "Aprovando..." : "Aprovar / vincular"}
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
      <AprovarTriagemModal
        lead={leadParaAprovar}
        clientes={clientes}
        processos={processos}
        saving={!!leadParaAprovar && busy === leadParaAprovar.id}
        onClose={() => setLeadParaAprovar(null)}
        onConfirm={(vinculos) => {
          if (!leadParaAprovar) return;
          aprovar(leadParaAprovar, vinculos);
        }}
      />
    </div>
  );
}

function AprovarTriagemModal({
  lead,
  clientes,
  processos,
  saving,
  onClose,
  onConfirm,
}: {
  lead: TriagemLead | null;
  clientes: Cliente[];
  processos: Processo[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (vinculos: { clienteId?: string; processoId?: string }) => void;
}) {
  const open = !!lead;
  const [clienteId, setClienteId] = useState("");
  const [processoId, setProcessoId] = useState("");

  useEffect(() => {
    if (!open) return;
    setClienteId("");
    setProcessoId("");
  }, [open, lead?.id]);

  const processosOrdenados = [...processos].sort((a, b) => {
    const aDoCliente = clienteId && a.cliente_id === clienteId ? 0 : 1;
    const bDoCliente = clienteId && b.cliente_id === clienteId ? 0 : 1;
    if (aDoCliente !== bDoCliente) return aDoCliente - bDoCliente;
    return processoLabel(a).localeCompare(processoLabel(b), "pt-BR");
  });
  const clienteSelecionado = clientes.find((c) => c.id === clienteId);
  const processoSelecionado = processos.find((p) => p.id === processoId);

  function handleProcessoChange(value: string) {
    setProcessoId(value);
    const processo = processos.find((p) => p.id === value);
    if (processo?.cliente_id) setClienteId(processo.cliente_id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm({ clienteId: clienteId || undefined, processoId: processoId || undefined });
  }

  return (
    <Modal open={open} onClose={onClose} title="Aprovar triagem" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">{lead?.nome || "Triagem sem nome"}</p>
          {lead?.resumo && <p className="mt-1 line-clamp-3">{lead.resumo}</p>}
        </div>

        <ComboBox
          label="Cliente existente (opcional)"
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          value={clienteId}
          onChange={setClienteId}
          placeholder="Criar novo cliente a partir da triagem"
        />

        <ComboBox
          label="Processo existente (opcional)"
          options={processosOrdenados.map((p) => ({ value: p.id, label: processoLabel(p) }))}
          value={processoId}
          onChange={handleProcessoChange}
          placeholder="Sem processo específico"
        />

        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Ao aprovar, o Justio cria um atendimento desta triagem
          {clienteSelecionado ? <> para <strong>{clienteSelecionado.nome}</strong></> : " e cria um novo cliente"}
          {processoSelecionado ? <> vinculado ao processo <strong>{processoSelecionado.numero || processoSelecionado.titulo}</strong></> : null}.
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            <CheckCircle className="h-4 w-4" /> {saving ? "Aprovando..." : "Aprovar triagem"}
          </Button>
        </div>
      </form>
    </Modal>
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
  recarregar,
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
  recarregar?: () => void;
}) {
  const [dataJud, setDataJud] = useState<Record<number, { status: "loading" | "ok" | "erro"; msg: string }>>({});

  const clienteMatch = findClienteMatch(clientes, draft?.cliente, draft?.processos[0]?.cliente_nome);
  const clienteSelecionado = draft?.cliente_id === ""
    ? undefined
    : clientes.find((c) => c.id === draft?.cliente_id) ?? clienteMatch;
  const clienteProcessos = clienteSelecionado
    ? processos.filter((p) => p.cliente_id === clienteSelecionado.id || normalize(p.cliente_nome) === normalize(clienteSelecionado.nome))
    : [];
  const unidadePrisionalOptions = mergeOptions(unidadePrisionalBaseOptions, valuesToOptions(processos.map((p) => p.unidade_prisional)));
  const tipoPenalOptions = mergeOptions(tipoPenalBaseOptions, valuesToOptions(processos.map((p) => p.tipo_penal)));
  const comarcaOptions = mergeOptions(comarcaBaseOptions, valuesToOptions(processos.map((p) => p.comarca)));
  const varaOptions = mergeOptions(varaBaseOptions, valuesToOptions(processos.map((p) => p.vara)));
  const processosNovos = draft?.processos.filter((p) => !p.processo_id && !processos.some((existente) => sameProcess(existente.numero, p.numero))).length ?? 0;
  const processosExistentes = (draft?.processos.length ?? 0) - processosNovos;

  function processoParaDraft(processo?: Processo): ImportDraft["processos"][number] {
    return {
      processo_id: processo?.id,
      numero: processo?.numero ?? "",
      titulo: processo?.titulo ?? "",
      descricao: processo?.descricao ?? "",
      tribunal: processo?.tribunal ?? "",
      vara: processo?.vara ?? "",
      comarca: processo?.comarca ?? "",
      uf: processo?.uf ?? draft?.cliente?.uf ?? "",
      tipo: processo?.tipo ?? "outro",
      parte_contraria: processo?.parte_contraria ?? "",
      cliente_nome: processo?.cliente_nome ?? clienteSelecionado?.nome ?? draft?.cliente?.nome ?? "",
      cliente_cpf_cnpj: processo?.cliente_cpf_cnpj ?? clienteSelecionado?.cpf ?? draft?.cliente?.cpf ?? "",
      data_distribuicao: processo?.data_distribuicao ?? "",
      unidade_prisional: processo?.unidade_prisional ?? "",
      tipo_penal: processo?.tipo_penal ?? "",
    };
  }

  function adicionarProcessoManual(processoId?: string) {
    if (!draft) return;
    const processo = processoId ? processos.find((p) => p.id === processoId) : undefined;
    onDraftChange({
      ...draft,
      processos: [...draft.processos, processoParaDraft(processo)],
    });
  }

  function removerProcesso(index: number) {
    if (!draft) return;
    onDraftChange({
      ...draft,
      processos: draft.processos.filter((_, i) => i !== index),
    });
  }

  function selecionarCliente(clienteId: string) {
    if (!draft) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    onDraftChange({
      ...draft,
      cliente_id: clienteId,
      cliente: cliente ? {
        ...(draft.cliente ?? {}),
        nome: cliente.nome,
        cpf: cliente.cpf,
        rg: cliente.rg,
        email: cliente.email,
        celular: cliente.celular,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero_end: cliente.numero_end,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        uf: cliente.uf,
        observacoes: draft.cliente?.observacoes,
      } : draft.cliente,
      processos: draft.processos.map((proc) => ({ ...proc, processo_id: undefined })),
    });
  }

  function selecionarProcesso(index: number, processoId: string) {
    if (!draft) return;
    const processo = processos.find((p) => p.id === processoId);
    onDraftChange({
      ...draft,
      processos: draft.processos.map((proc, i) => (
        i === index
          ? {
              ...proc,
              processo_id: processo?.id,
              numero: processo ? processo.numero : proc.numero,
              titulo: processo ? processo.titulo : proc.titulo,
              tribunal: processo ? processo.tribunal : proc.tribunal,
              vara: processo ? processo.vara : proc.vara,
              comarca: processo ? processo.comarca : proc.comarca,
              uf: processo ? processo.uf : proc.uf,
              tipo: processo ? processo.tipo : proc.tipo,
              cliente_nome: processo ? processo.cliente_nome : proc.cliente_nome,
              cliente_cpf_cnpj: processo ? processo.cliente_cpf_cnpj : proc.cliente_cpf_cnpj,
              unidade_prisional: processo ? processo.unidade_prisional : proc.unidade_prisional,
              tipo_penal: processo ? processo.tipo_penal : proc.tipo_penal,
            }
          : proc
      )),
    });
  }

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

  // CEP do cliente: aplica máscara e, com 8 dígitos, busca o endereço e preenche os campos vazios.
  async function preencherCepCliente(valor: string) {
    if (!draft) return;
    const masked = formatCEP(valor);
    const base = { ...(draft.cliente ?? {}), cep: masked || undefined };
    onDraftChange({ ...draft, cliente: base });
    const dig = masked.replace(/\D/g, "");
    if (dig.length !== 8) return;
    const end = await buscarCep(dig);
    if (!end) return;
    onDraftChange({
      ...draft,
      cliente: {
        ...base,
        logradouro: base.logradouro || end.logradouro,
        bairro: base.bairro || end.bairro,
        cidade: base.cidade || end.cidade,
        uf: base.uf || end.uf,
      },
    });
  }

  // Lê o processo no DataJud (mesma fonte do cadastro de processo) e preenche os campos vazios.
  async function buscarDataJud(index: number) {
    if (!draft) return;
    const proc = draft.processos[index];
    const numeroFormatado = formatarCNJ(proc.numero ?? "");
    if (!numeroFormatado) {
      setDataJud((s) => ({ ...s, [index]: { status: "erro", msg: "Número CNJ inválido. Use 0000000-00.0000.0.00.0000." } }));
      return;
    }
    setDataJud((s) => ({ ...s, [index]: { status: "loading", msg: "Buscando no DataJud..." } }));
    try {
      const data = await buscarNoDataJud(numeroFormatado);
      const { tribunal } = parseCNJ(numeroFormatado);
      onDraftChange({
        ...draft,
        processos: draft.processos.map((p, i) => (
          i === index
            ? {
                ...p,
                numero: numeroFormatado,
                titulo: p.titulo?.trim() ? p.titulo : (data.classe || data.assuntos?.[0] || "Processo judicial"),
                tribunal: p.tribunal?.trim() ? p.tribunal : (tribunal?.toUpperCase() ?? ""),
                vara: p.vara?.trim() ? p.vara : (data.orgaoJulgador ?? ""),
                uf: p.uf?.trim() ? p.uf : ufFromTribunalDataJud(tribunal),
                tipo: p.tipo && p.tipo !== "outro" ? p.tipo : inferirTipoDataJud(data, tribunal),
                data_distribuicao: p.data_distribuicao?.trim() ? p.data_distribuicao : (data.dataAjuizamento?.slice(0, 10) ?? ""),
                descricao: p.descricao?.trim() ? p.descricao : descricaoDataJud(data),
              }
            : p
        )),
      });
      setDataJud((s) => ({ ...s, [index]: { status: "ok", msg: "Dados do DataJud preenchidos — confira e ajuste." } }));
    } catch (err) {
      const msg = err instanceof DataJudError ? err.message : "Não consegui consultar o DataJud agora.";
      setDataJud((s) => ({ ...s, [index]: { status: "erro", msg } }));
    }
  }

  // --- Litisconsortes (clientes do mesmo lado) de um processo ---
  function atualizarPartes(index: number, fn: (partes: ProcessoClienteParte[]) => ProcessoClienteParte[]) {
    if (!draft) return;
    onDraftChange({
      ...draft,
      processos: draft.processos.map((p, i) => (
        i === index ? { ...p, clientes_partes: fn(p.clientes_partes ?? []) } : p
      )),
    });
  }

  // Adiciona um litisconsorte em branco para preencher os dados inline.
  function adicionarParteVazia(index: number) {
    atualizarPartes(index, (partes) => [...partes, { nome: "", papel: "Litisconsorte" }]);
  }

  // Adiciona a partir de um cliente já cadastrado (já vem com cliente_id).
  function adicionarParteCadastrada(index: number, clienteId: string) {
    const c = clientes.find((cl) => cl.id === clienteId);
    if (!c) return;
    atualizarPartes(index, (partes) => [...partes, {
      cliente_id: c.id, nome: c.nome, cpf_cnpj: c.cpf, rg: c.rg, email: c.email, celular: c.celular,
      cep: c.cep, logradouro: c.logradouro, numero_end: c.numero_end, complemento: c.complemento,
      bairro: c.bairro, cidade: c.cidade, uf: c.uf, papel: "Litisconsorte",
    }]);
  }

  function setParteField(index: number, j: number, field: keyof ProcessoClienteParte, value: string) {
    atualizarPartes(index, (partes) => partes.map((parte, k) => (k === j ? { ...parte, [field]: value || undefined } : parte)));
  }

  function removerParte(index: number, j: number) {
    atualizarPartes(index, (partes) => partes.filter((_, k) => k !== j));
  }

  // CEP do litisconsorte: máscara + busca de endereço (preenche só o que estiver vazio).
  async function preencherCepParte(index: number, j: number, valor: string) {
    const masked = formatCEP(valor);
    const dig = masked.replace(/\D/g, "");
    const end = dig.length === 8 ? await buscarCep(dig) : null;
    atualizarPartes(index, (partes) => partes.map((parte, k) => (
      k === j
        ? {
            ...parte,
            cep: masked || undefined,
            ...(end ? {
              logradouro: parte.logradouro || end.logradouro,
              bairro: parte.bairro || end.bairro,
              cidade: parte.cidade || end.cidade,
              uf: parte.uf || end.uf,
            } : {}),
          }
        : parte
    )));
  }

  // "+ cliente": registra o litisconsorte na lista de clientes (com todos os dados) e vincula.
  async function registrarParteComoCliente(index: number, j: number) {
    if (!draft) return;
    const parte = draft.processos[index]?.clientes_partes?.[j];
    if (!parte?.nome?.trim() || parte.cliente_id) return;
    const novo = await createCliente({
      nome: parte.nome.trim(),
      cpf: parte.cpf_cnpj || undefined,
      rg: parte.rg || undefined,
      email: parte.email || undefined,
      celular: parte.celular || undefined,
      cep: parte.cep || undefined,
      logradouro: parte.logradouro || undefined,
      numero_end: parte.numero_end || undefined,
      complemento: parte.complemento || undefined,
      bairro: parte.bairro || undefined,
      cidade: parte.cidade || undefined,
      uf: parte.uf || undefined,
    });
    atualizarPartes(index, (partes) => partes.map((pt, k) => (k === j ? { ...pt, cliente_id: novo.id } : pt)));
    recarregar?.();
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
              <div className="mb-3">
                <ComboBox
                  label="Cliente cadastrado (corrija se o Justio reconheceu errado)"
                  options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                  value={draft.cliente_id ?? clienteMatch?.id ?? ""}
                  onChange={selecionarCliente}
                  placeholder="Criar novo cliente / sem vínculo"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Nome" value={draft.cliente?.nome ?? draft.processos[0]?.cliente_nome ?? ""} onChange={(e) => setClienteField("nome", e.target.value)} />
                <Input label="CPF" value={draft.cliente?.cpf ?? ""} onChange={(e) => setClienteField("cpf", e.target.value)} />
                <Input label="RG" value={draft.cliente?.rg ?? ""} onChange={(e) => setClienteField("rg", e.target.value)} />
                <Input label="E-mail" type="email" value={draft.cliente?.email ?? ""} onChange={(e) => setClienteField("email", e.target.value)} />
                <Input label="Celular" value={draft.cliente?.celular ?? ""} onChange={(e) => setClienteField("celular", e.target.value)} />
                <Input label="CEP" inputMode="numeric" placeholder="00000-000" value={draft.cliente?.cep ?? ""} onChange={(e) => preencherCepCliente(e.target.value)} />
                <Input label="Logradouro" value={draft.cliente?.logradouro ?? ""} onChange={(e) => setClienteField("logradouro", e.target.value)} />
                <Input label="Número" value={draft.cliente?.numero_end ?? ""} onChange={(e) => setClienteField("numero_end", e.target.value)} />
                <Input label="Complemento" value={draft.cliente?.complemento ?? ""} onChange={(e) => setClienteField("complemento", e.target.value)} />
                <Input label="Bairro" value={draft.cliente?.bairro ?? ""} onChange={(e) => setClienteField("bairro", e.target.value)} />
                <Input label="Cidade" value={draft.cliente?.cidade ?? ""} onChange={(e) => setClienteField("cidade", e.target.value)} />
                <Input label="UF" maxLength={2} value={draft.cliente?.uf ?? ""} onChange={(e) => setClienteField("uf", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Processos</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Se o Justio não encontrou o CNJ, selecione um processo já cadastrado do cliente ou adicione um novo manualmente.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarProcessoManual()}>
                  Adicionar processo manualmente
                </Button>
              </div>
              {clienteSelecionado ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <ComboBox
                    label="Puxar processo já cadastrado deste cliente"
                    options={clienteProcessos.map((p) => ({ value: p.id, label: processoLabel(p) }))}
                    value=""
                    onChange={(value) => {
                      if (value) adicionarProcessoManual(value);
                    }}
                    placeholder={clienteProcessos.length ? "Escolha um processo para adicionar à importação" : "Nenhum processo cadastrado para este cliente"}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Escolha ou corrija o cliente acima para listar os processos já cadastrados dele.
                </div>
              )}
              {draft.processos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                  Nenhum processo CNJ encontrado. Você pode puxar um processo cadastrado acima ou adicionar um novo manualmente.
                </div>
              ) : (
                draft.processos.map((proc, index) => {
                  const existente = proc.processo_id
                    ? processos.find((p) => p.id === proc.processo_id)
                    : processos.find((p) => sameProcess(p.numero, proc.numero));
                  return (
                    <div key={index} className="rounded-xl border border-gray-100 p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Processo {index + 1}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {existente ? <Badge variant="neutral">já cadastrado</Badge> : <Badge variant="success">novo cadastro</Badge>}
                          <Button type="button" variant="ghost" size="sm" onClick={() => removerProcesso(index)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                      {clienteSelecionado && (
                        <div className="mb-3">
                          <ComboBox
                            label="Processo cadastrado deste cliente (opcional)"
                            options={clienteProcessos.map((p) => ({ value: p.id, label: processoLabel(p) }))}
                            value={proc.processo_id ?? existente?.id ?? ""}
                            onChange={(value) => selecionarProcesso(index, value)}
                            placeholder={clienteProcessos.length ? "Criar processo novo / sem vínculo" : "Nenhum processo cadastrado para este cliente"}
                          />
                        </div>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Input label="Número CNJ" value={proc.numero ?? ""} onChange={(e) => setProcessoField(index, "numero", e.target.value)} />
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => buscarDataJud(index)}
                              disabled={dataJud[index]?.status === "loading"}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                            >
                              <FileText className="h-3.5 w-3.5" /> {dataJud[index]?.status === "loading" ? "Buscando..." : "Buscar no DataJud"}
                            </button>
                            {dataJud[index]?.msg && (
                              <span className={`text-xs ${dataJud[index]?.status === "erro" ? "text-amber-600" : dataJud[index]?.status === "ok" ? "text-green-600" : "text-gray-400"}`}>
                                {dataJud[index]?.msg}
                              </span>
                            )}
                          </div>
                        </div>
                        <Input label="Título / classe" value={proc.titulo ?? ""} onChange={(e) => setProcessoField(index, "titulo", e.target.value)} />
                        <Input label="Tribunal" value={proc.tribunal ?? ""} onChange={(e) => setProcessoField(index, "tribunal", e.target.value)} />
                        <Input label="UF" maxLength={2} value={proc.uf ?? ""} onChange={(e) => setProcessoField(index, "uf", e.target.value.toUpperCase())} />
                        <SelectComOutro
                          label="Comarca"
                          category="processo_comarca"
                          baseOptions={comarcaOptions}
                          placeholder="Selecione ou cadastre..."
                          value={proc.comarca ?? ""}
                          onChange={(v) => setProcessoField(index, "comarca", v)}
                        />
                        <SelectComOutro
                          label="Vara"
                          category="processo_vara"
                          baseOptions={varaOptions}
                          placeholder="Selecione ou cadastre..."
                          value={proc.vara ?? ""}
                          onChange={(v) => setProcessoField(index, "vara", v)}
                        />
                        <Input label="Parte contrária" value={proc.parte_contraria ?? ""} onChange={(e) => setProcessoField(index, "parte_contraria", e.target.value)} />
                        <SelectComOutro
                          label="Classificação"
                          category="processo_tipo"
                          baseOptions={processoTipoOptions}
                          placeholder="Selecione..."
                          value={proc.tipo ?? ""}
                          onChange={(v) => setProcessoField(index, "tipo", v)}
                        />
                        {isPenalTipo(proc.tipo) && (
                          <SelectComOutro
                            label="Unidade prisional"
                            category="processo_unidade_prisional"
                            baseOptions={unidadePrisionalOptions}
                            placeholder="Selecione ou cadastre..."
                            value={proc.unidade_prisional ?? ""}
                            onChange={(v) => setProcessoField(index, "unidade_prisional", v)}
                          />
                        )}
                        {isPenalTipo(proc.tipo) && (
                          <SelectComOutro
                            label="Tipo penal imputado"
                            category="processo_tipo_penal"
                            baseOptions={tipoPenalOptions}
                            placeholder="Selecione ou cadastre..."
                            value={proc.tipo_penal ?? ""}
                            onChange={(v) => setProcessoField(index, "tipo_penal", v)}
                          />
                        )}
                        <Input label="Data de distribuição" type="date" value={proc.data_distribuicao ?? ""} onChange={(e) => setProcessoField(index, "data_distribuicao", e.target.value)} />
                        <div className="md:col-span-2">
                          <Textarea
                            label="Descrição do caso"
                            value={proc.descricao ?? ""}
                            onChange={(e) => setProcessoField(index, "descricao", e.target.value)}
                            rows={4}
                          />
                        </div>
                        <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Litisconsortes (outros clientes deste processo)</p>
                              <p className="mt-0.5 text-xs text-gray-500">O cliente acima é o principal. Preencha os dados de cada litisconsorte; ele só vai para a lista de clientes quando você clicar em &quot;+ cliente&quot;.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => adicionarParteVazia(index)}>
                              + Litisconsorte
                            </Button>
                          </div>

                          {clientes.length > 0 && (
                            <ComboBox
                              label="Ou puxar um cliente já cadastrado"
                              options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                              value=""
                              onChange={(id) => adicionarParteCadastrada(index, id)}
                              placeholder="Escolha um cliente para adicionar"
                            />
                          )}

                          {(proc.clientes_partes?.length ?? 0) === 0 ? (
                            <p className="text-xs text-gray-400">Nenhum litisconsorte adicionado.</p>
                          ) : (
                            <div className="space-y-3">
                              {proc.clientes_partes!.map((parte, j) => (
                                <div key={j} className="rounded-lg border border-gray-200 bg-white p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-gray-500">
                                      Litisconsorte {j + 1}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {parte.cliente_id ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                                          <CheckCircle2 className="h-3.5 w-3.5" /> na lista de clientes
                                        </span>
                                      ) : (
                                        <Button type="button" variant="secondary" size="sm" onClick={() => registrarParteComoCliente(index, j)} disabled={!(parte.nome ?? "").trim()}>
                                          + cliente
                                        </Button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removerParte(index, j)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                        title="Remover litisconsorte"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <Input label="Nome" value={parte.nome ?? ""} onChange={(e) => setParteField(index, j, "nome", e.target.value)} />
                                    <Input label="CPF/CNPJ" value={parte.cpf_cnpj ?? ""} onChange={(e) => setParteField(index, j, "cpf_cnpj", e.target.value)} />
                                    <Input label="RG" value={parte.rg ?? ""} onChange={(e) => setParteField(index, j, "rg", e.target.value)} />
                                    <Input label="E-mail" type="email" value={parte.email ?? ""} onChange={(e) => setParteField(index, j, "email", e.target.value)} />
                                    <Input label="Celular" value={parte.celular ?? ""} onChange={(e) => setParteField(index, j, "celular", e.target.value)} />
                                    <Input label="CEP" inputMode="numeric" placeholder="00000-000" value={parte.cep ?? ""} onChange={(e) => preencherCepParte(index, j, e.target.value)} />
                                    <Input label="Logradouro" value={parte.logradouro ?? ""} onChange={(e) => setParteField(index, j, "logradouro", e.target.value)} />
                                    <Input label="Número" value={parte.numero_end ?? ""} onChange={(e) => setParteField(index, j, "numero_end", e.target.value)} />
                                    <Input label="Complemento" value={parte.complemento ?? ""} onChange={(e) => setParteField(index, j, "complemento", e.target.value)} />
                                    <Input label="Bairro" value={parte.bairro ?? ""} onChange={(e) => setParteField(index, j, "bairro", e.target.value)} />
                                    <Input label="Cidade" value={parte.cidade ?? ""} onChange={(e) => setParteField(index, j, "cidade", e.target.value)} />
                                    <Input label="UF" maxLength={2} value={parte.uf ?? ""} onChange={(e) => setParteField(index, j, "uf", e.target.value.toUpperCase())} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
