"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit2, Trash2, Plus, Clock, Calendar,
  DollarSign, FileText, MapPin, User, Scale, CheckCircle, Users, X,
  RefreshCw, Bell, BellOff, Copy, ListTodo, StickyNote, Link2,
  Shield, GitBranch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SelectComOutro } from "@/components/ui/select-com-outro";
import { ComboBox } from "@/components/ui/combobox";
import { DocumentosPanel } from "@/components/ui/documentos-panel";
import {
  getProcesso, getProcessos, getClientes, createProcesso, updateProcesso, deleteProcesso,
  getMovimentacoesByProcesso, createMovimentacao, updateMovimentacao, deleteMovimentacao, deleteMovimentacoesByProcesso,
  marcarTodasMovimentacoesLidas,
  getPrazos, createPrazo, updatePrazo, deletePrazo,
  getAudiencias, createAudiencia, updateAudiencia, deleteAudiencia,
  getHonorarios, createHonorario, updateHonorario, deleteHonorario,
  getAtendimentosByProcesso, createAtendimento, updateAtendimento, deleteAtendimento,
  getAnotacoesByProcesso, createAnotacao, updateAnotacao, deleteAnotacao,
  getTarefasByProcesso, createTarefa, updateTarefa, deleteTarefa,
  getIncidentesByProcesso, createIncidente, updateIncidente, deleteIncidente,
  getCalculosPenaByProcesso, createCalculoPena, updateCalculoPena, deleteCalculoPena,
  getBeneficiosPenaisByProcesso, createBeneficioPenal, updateBeneficioPenal, deleteBeneficioPenal,
  sincronizarProcesso,
} from "@/lib/store";
import { formatCurrency, formatDate, formatDateTime, daysUntil, prazoColor } from "@/lib/utils";
import type {
  Cliente, Processo, Movimentacao, Prazo, Audiencia, Honorario, Atendimento, Anotacao, Tarefa, Prioridade,
  ProcessoTipo, ProcessoResultadoTipo, IncidenteExecucao, CalculoPena, BeneficioPenal,
  IncidenteExecucaoTipo, IncidenteExecucaoStatus, BeneficioPenalTipo, BeneficioPenalStatus, InqueritoSituacao,
} from "@/types";

const statusOptions = [
  { value: "ativo", label: "Ativo" },
  { value: "suspenso", label: "Suspenso" },
  { value: "arquivado", label: "Arquivado" },
  { value: "encerrado", label: "Encerrado" },
];

const prazoTipoOptions = [
  { value: "recurso", label: "Recurso" },
  { value: "contestacao", label: "Contestação" },
  { value: "peticao", label: "Petição" },
  { value: "contrarrazoes", label: "Contrarrazões" },
  { value: "outro", label: "Outro" },
];

const audienciaTipoOptions = [
  { value: "instrucao", label: "Instrução" },
  { value: "conciliacao", label: "Conciliação" },
  { value: "julgamento", label: "Julgamento" },
  { value: "una", label: "Una" },
  { value: "outro", label: "Outro" },
];

const honorarioTipoOptions = [
  { value: "contratual", label: "Contratual" },
  { value: "sucumbencial", label: "Sucumbencial" },
  { value: "exito", label: "Êxito" },
  { value: "outro", label: "Outro" },
];

const processoTipoOptions: { value: ProcessoTipo; label: string }[] = [
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Direito de família" },
  { value: "criminal", label: "Criminal" },
  { value: "execucao_penal", label: "Execução penal" },
  { value: "inquerito_policial", label: "Inquérito policial" },
  { value: "bo_pm", label: "Boletim de Ocorrência PM" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "federal", label: "Federal" },
  { value: "outro", label: "Outro" },
];

const processoTipoLabels = Object.fromEntries(processoTipoOptions.map((item) => [item.value, item.label])) as Record<ProcessoTipo, string>;

const resultadoTipoOptions: { value: ProcessoResultadoTipo; label: string }[] = [
  { value: "sentenca_favoravel", label: "Sentença favorável" },
  { value: "exito", label: "Êxito" },
  { value: "sentenca_desfavoravel", label: "Sentença desfavorável" },
  { value: "pronuncia", label: "Pronúncia" },
  { value: "impronuncia", label: "Impronúncia" },
  { value: "pena", label: "Pena" },
  { value: "acordo", label: "Acordo" },
  { value: "outro", label: "Outro" },
];

const incidenteTipoOptions: { value: IncidenteExecucaoTipo; label: string }[] = [
  { value: "trabalho_extramuros", label: "Trabalho extramuros" },
  { value: "progressao_regime", label: "Progressão de regime" },
  { value: "livramento_condicional", label: "Livramento condicional" },
  { value: "remicao", label: "Remição" },
  { value: "saida_temporaria", label: "Saída temporária" },
  { value: "regressao", label: "Regressão" },
  { value: "unificacao_penas", label: "Unificação de penas" },
  { value: "detracao", label: "Detração" },
  { value: "indulto", label: "Indulto" },
  { value: "comutacao", label: "Comutação" },
  { value: "extincao_pena", label: "Extinção da pena" },
  { value: "outro", label: "Outro" },
];

const incidenteStatusOptions: { value: IncidenteExecucaoStatus; label: string }[] = [
  { value: "em_preparacao", label: "Em preparação" },
  { value: "protocolado", label: "Protocolado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "cumprido", label: "Cumprido" },
  { value: "arquivado", label: "Arquivado" },
];

const beneficioPenalTipoOptions: { value: BeneficioPenalTipo; label: string }[] = [
  { value: "comutacao", label: "Comutação" },
  { value: "indulto", label: "Indulto" },
];

const beneficioPenalStatusOptions: { value: BeneficioPenalStatus; label: string }[] = [
  { value: "em_estudo", label: "Em estudo" },
  { value: "requerido", label: "Requerido" },
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "prejudicado", label: "Prejudicado" },
];

const inqueritoSituacaoOptions: { value: InqueritoSituacao; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "relatado", label: "Relatado" },
  { value: "denunciado", label: "Denunciado / ação penal proposta" },
  { value: "arquivado", label: "Arquivado" },
  { value: "baixado", label: "Baixado" },
  { value: "outro", label: "Outro" },
];

type Tab =
  | "movimentacoes"
  | "inqueritos"
  | "incidentes"
  | "calculo_pena"
  | "beneficios_penais"
  | "resultado"
  | "anotacoes"
  | "documentos"
  | "tarefas"
  | "prazos"
  | "audiencias"
  | "honorarios"
  | "atendimentos";

const execucaoPenalTabs: Tab[] = ["incidentes", "calculo_pena", "beneficios_penais"];
const acaoPenalTabs: Tab[] = ["inqueritos"];

function normalizeTipo(tipo?: string): string {
  return (tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isExecucaoPenalTipo(tipo?: string): boolean {
  return normalizeTipo(tipo) === "execucao_penal";
}

function isAcaoPenalTipo(tipo?: string): boolean {
  const normalized = normalizeTipo(tipo);
  return normalized === "criminal" || normalized === "acao_penal" || normalized === "penal";
}

function isInqueritoTipo(tipo?: string): boolean {
  return normalizeTipo(tipo) === "inquerito_policial";
}

function identificadorProcesso(processo: Processo): string {
  if (processo.numero.trim()) return processo.numero;
  if (isInqueritoTipo(processo.tipo) && processo.numero_inquerito?.trim()) return `IP ${processo.numero_inquerito}`;
  return isInqueritoTipo(processo.tipo) ? "Inquérito sem número" : "Número não informado";
}

export default function ProcessoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [tab, setTab] = useState<Tab>("movimentacoes");
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [incidentes, setIncidentes] = useState<IncidenteExecucao[]>([]);
  const [calculosPena, setCalculosPena] = useState<CalculoPena[]>([]);
  const [beneficiosPenais, setBeneficiosPenais] = useState<BeneficioPenal[]>([]);
  const [todosProcessos, setTodosProcessos] = useState<Processo[]>([]);
  const [inqueritosDaAcao, setInqueritosDaAcao] = useState<Processo[]>([]);

  const [honCategoria, setHonCategoria] = useState<"cobranca" | "pagamento">("pagamento");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [copiedNumero, setCopiedNumero] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    const { novas, erro } = await sincronizarProcesso(id);
    setSyncing(false);
    if (erro) {
      const acaoNecessaria = /abri o portal|login assistido|certificado/i.test(erro);
      setSyncMsg(acaoNecessaria ? erro : `Erro: ${erro}`);
    } else {
      setSyncMsg(novas > 0 ? `${novas} nova${novas > 1 ? "s" : ""} movimentaç${novas > 1 ? "ões" : "ão"}` : "Sem novidades");
      load();
    }
    setTimeout(() => setSyncMsg(null), 10000);
  }

  async function toggleMonitorar() {
    await updateProcesso(id, { monitorar_datajud: !processo?.monitorar_datajud });
    load();
  }

  async function handleLimparMovs() {
    if (!confirm("Apagar TODAS as movimentações deste processo? Use isso para limpar dados sincronizados incorretamente. Depois clique em Sincronizar de novo.")) return;
    await deleteMovimentacoesByProcesso(id);
    load();
  }

  async function handleCopyNumero() {
    const numero = processo?.numero.trim() || processo?.numero_inquerito?.trim();
    if (!numero) return;
    await navigator.clipboard.writeText(numero);
    setCopiedNumero(true);
    setTimeout(() => setCopiedNumero(false), 1400);
  }

  const [movModal, setMovModal] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<Movimentacao | null>(null);
  const [prazoModal, setPrazoModal] = useState(false);
  const [audModal, setAudModal] = useState(false);
  const [honModal, setHonModal] = useState(false);
  const [honRecebendo, setHonRecebendo] = useState<Honorario | null>(null);
  const [honDataRec, setHonDataRec] = useState("");
  const [atenModal, setAtenModal] = useState(false);
  const [anotacaoModal, setAnotacaoModal] = useState(false);
  const [editingAnotacao, setEditingAnotacao] = useState<Anotacao | null>(null);
  const [tarefaModal, setTarefaModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [incidenteModal, setIncidenteModal] = useState(false);
  const [editingIncidente, setEditingIncidente] = useState<IncidenteExecucao | null>(null);
  const [calculoPenaModal, setCalculoPenaModal] = useState(false);
  const [editingCalculoPena, setEditingCalculoPena] = useState<CalculoPena | null>(null);
  const [beneficioPenalModal, setBeneficioPenalModal] = useState(false);
  const [editingBeneficioPenal, setEditingBeneficioPenal] = useState<BeneficioPenal | null>(null);
  const [vincularInqueritoModal, setVincularInqueritoModal] = useState(false);
  const [transformarInqueritoModal, setTransformarInqueritoModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [vincularClienteModal, setVincularClienteModal] = useState(false);

  const load = useCallback(async () => {
    const p = await getProcesso(id);
    if (!p) { router.push("/dashboard/processos"); return; }
    setProcesso(p);
    const [
      movs, prazosAll, audienciasAll, honorariosAll, atendimentosData, anotacoesData, tarefasData,
      incidentesData, calculosPenaData, beneficiosPenaisData, todosData,
    ] = await Promise.all([
      getMovimentacoesByProcesso(id),
      getPrazos(),
      getAudiencias(),
      getHonorarios(),
      getAtendimentosByProcesso(id),
      getAnotacoesByProcesso(id),
      getTarefasByProcesso(id),
      getIncidentesByProcesso(id),
      getCalculosPenaByProcesso(id),
      getBeneficiosPenaisByProcesso(id),
      getProcessos(),
    ]);
    setMovimentacoes(movs);
    setPrazos(prazosAll.filter((pr) => pr.processo_id === id));
    setAudiencias(audienciasAll.filter((a) => a.processo_id === id));
    setHonorarios(honorariosAll.filter((h) => h.processo_id === id));
    setAtendimentos(atendimentosData);
    setAnotacoes(anotacoesData);
    setTarefas(tarefasData);
    setIncidentes(incidentesData);
    setCalculosPena(calculosPenaData);
    setBeneficiosPenais(beneficiosPenaisData);
    setTodosProcessos(todosData);
    setInqueritosDaAcao(todosData.filter((proc) => isInqueritoTipo(proc.tipo) && proc.processo_principal_id === id));
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!processo) return;
    if (
      (!isExecucaoPenalTipo(processo.tipo) && execucaoPenalTabs.includes(tab)) ||
      (!isAcaoPenalTipo(processo.tipo) && acaoPenalTabs.includes(tab))
    ) {
      setTab("movimentacoes");
    }
  }, [processo, tab]);

  async function handleDelete() {
    await deleteProcesso(id);
    router.push("/dashboard/processos");
  }

  if (!processo) return null;

  const statusVariantMap: Record<string, "success" | "warning" | "neutral"> = {
    ativo: "success", suspenso: "warning", arquivado: "neutral", encerrado: "neutral",
  };

  const movNaoLidas = movimentacoes.filter((m) => !m.lida).length;
  const clienteDetalheHref = processo.cliente_id ? `/dashboard/clientes/${processo.cliente_id}` : undefined;

  const hasResultado = Boolean(processo.resultado_tipo || processo.resultado_descricao || processo.pena);
  const isExecucaoPenal = isExecucaoPenalTipo(processo.tipo);
  const isAcaoPenal = isAcaoPenalTipo(processo.tipo);
  const isInquerito = isInqueritoTipo(processo.tipo);

  const tabs: { key: Tab; label: string; count: number; unread?: number; showCount?: boolean }[] = [
    { key: "movimentacoes", label: "Movimentações", count: movimentacoes.length, unread: movNaoLidas },
    ...(isAcaoPenal ? [
      { key: "inqueritos" as const, label: "Inquéritos", count: inqueritosDaAcao.length },
    ] : []),
    ...(isExecucaoPenal ? [
      { key: "incidentes" as const, label: "Incidentes", count: incidentes.length },
      { key: "calculo_pena" as const, label: "Cálculo de pena", count: calculosPena.length },
      { key: "beneficios_penais" as const, label: "Comutação/Indulto", count: beneficiosPenais.length },
    ] : []),
    { key: "anotacoes", label: "Anotações", count: anotacoes.length, showCount: false },
    { key: "documentos", label: "Documentos", count: 0, showCount: false },
    { key: "tarefas", label: "Tarefas", count: tarefas.filter((t) => !t.concluida).length },
    { key: "prazos", label: "Prazos", count: prazos.filter((p) => !p.concluido).length },
    { key: "audiencias", label: "Audiências", count: audiencias.filter((a) => !a.realizada).length },
    { key: "atendimentos", label: "Atendimentos", count: atendimentos.filter((a) => a.status === "agendado").length },
    { key: "honorarios", label: "Honorários", count: honorarios.length },
    { key: "resultado", label: "Resultado", count: hasResultado ? 1 : 0, showCount: false },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Link href="/dashboard/processos">
            <button className="mt-1 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 break-all rounded bg-gray-100 px-2 py-0.5 text-sm font-semibold tabular-nums tracking-tight text-gray-700">{identificadorProcesso(processo)}</span>
                <button
                  type="button"
                  title="Copiar número do processo"
                  onClick={handleCopyNumero}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  {copiedNumero ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Badge variant={statusVariantMap[processo.status]}>{processo.status}</Badge>
              {processo.tipo && <Badge variant="neutral">{processoTipoLabels[processo.tipo] ?? processo.tipo}</Badge>}
            </div>
            <h1 className="break-words text-xl font-bold text-gray-900">{processo.titulo}</h1>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          <div className="inline-flex min-w-0 max-w-full items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              onClick={toggleMonitorar}
              title={processo.monitorar_datajud ? "Monitoramento ativo — clique para desativar" : "Ativar monitoramento automático"}
              className={`flex items-center justify-center px-2.5 transition-colors border-r border-gray-200 ${processo.monitorar_datajud ? "bg-[#21181d] text-white hover:bg-[#2b2027]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              {processo.monitorar_datajud ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex min-w-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </button>
            {movimentacoes.length > 0 && (
              <button
                onClick={handleLimparMovs}
                title="Apagar todas as movimentações sincronizadas"
                className="flex items-center justify-center px-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border-l border-gray-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {syncMsg && (
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">{syncMsg}</span>
          )}
          {isInquerito && (
            <Button variant="secondary" size="sm" onClick={() => setTransformarInqueritoModal(true)}>
              <GitBranch className="w-3.5 h-3.5" /> Transformar em ação penal
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditModal(true)}>
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1"><User className="w-4 h-4 text-blue-500" />Cliente</div>
            {clienteDetalheHref ? (
              <Link
                href={clienteDetalheHref}
                className="block truncate text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
              >
                {processo.cliente_nome || "—"}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-gray-900 truncate">{processo.cliente_nome || "—"}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              {processo.cliente_id ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium"><CheckCircle className="w-3 h-3" /> Vinculado</span>
              ) : (
                <span className="text-[11px] text-amber-600">Não vinculado a um cliente cadastrado</span>
              )}
              <button
                type="button"
                onClick={() => setVincularClienteModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                <Link2 className="w-3 h-3" /> {processo.cliente_id ? "Trocar" : "Vincular cliente"}
              </button>
            </div>
          </CardContent>
        </Card>
        <InfoCard icon={<Scale className="w-4 h-4 text-purple-500" />} label="Parte Contrária" value={processo.parte_contraria ?? "—"} />
        <InfoCard icon={<MapPin className="w-4 h-4 text-green-500" />} label="Tribunal / UF" value={[processo.tribunal, processo.uf].filter(Boolean).join(" / ") || "—"} />
        <InfoCard icon={<MapPin className="w-4 h-4 text-rose-500" />} label="Comarca" value={processo.comarca ?? "—"} />
      </div>

      {processo.descricao && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><FileText className="w-4 h-4" /> Descrição do Caso</p>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{processo.descricao}</p>
          </CardContent>
        </Card>
      )}

      {isInquerito && (
        <InqueritoInfoPanel processo={processo} acaoPenal={todosProcessos.find((p) => p.id === processo.processo_principal_id)} />
      )}

      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-full">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.showCount !== false && t.count > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-gray-100 text-gray-700" : "bg-gray-200 text-gray-600"}`}>
                {t.count}
              </span>
            )}
            {(t.unread ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === "movimentacoes" && (
        <MovimentacoesTab
          movimentacoes={movimentacoes}
          onAdd={() => { setEditingMovimentacao(null); setMovModal(true); }}
          onEdit={(movimentacao) => { setEditingMovimentacao(movimentacao); setMovModal(true); }}
          onDelete={async (mid) => { await deleteMovimentacao(mid); load(); }}
          onMarcarLidas={async () => { await marcarTodasMovimentacoesLidas(id); load(); }}
          naoLidas={movNaoLidas}
        />
      )}
      {isAcaoPenal && tab === "inqueritos" && (
        <InqueritosTab
          inqueritos={inqueritosDaAcao}
          onVincular={() => setVincularInqueritoModal(true)}
          onDesvincular={async (inqId) => { await updateProcesso(inqId, { processo_principal_id: undefined }); load(); }}
        />
      )}
      {isExecucaoPenal && tab === "incidentes" && (
        <IncidentesTab
          incidentes={incidentes}
          onAdd={() => { setEditingIncidente(null); setIncidenteModal(true); }}
          onEdit={(incidente) => { setEditingIncidente(incidente); setIncidenteModal(true); }}
          onDelete={async (iid) => { await deleteIncidente(iid); load(); }}
        />
      )}
      {isExecucaoPenal && tab === "calculo_pena" && (
        <CalculosPenaTab
          calculos={calculosPena}
          onAdd={() => { setEditingCalculoPena(null); setCalculoPenaModal(true); }}
          onEdit={(calculo) => { setEditingCalculoPena(calculo); setCalculoPenaModal(true); }}
          onDelete={async (cid) => { await deleteCalculoPena(cid); load(); }}
        />
      )}
      {isExecucaoPenal && tab === "beneficios_penais" && (
        <BeneficiosPenaisTab
          beneficios={beneficiosPenais}
          onAdd={() => { setEditingBeneficioPenal(null); setBeneficioPenalModal(true); }}
          onEdit={(beneficio) => { setEditingBeneficioPenal(beneficio); setBeneficioPenalModal(true); }}
          onDelete={async (bid) => { await deleteBeneficioPenal(bid); load(); }}
        />
      )}
      {tab === "resultado" && (
        <ResultadoTab processo={processo} onSaved={load} />
      )}
      {tab === "anotacoes" && (
        <AnotacoesTab
          anotacoes={anotacoes}
          onAdd={() => { setEditingAnotacao(null); setAnotacaoModal(true); }}
          onEdit={(anotacao) => { setEditingAnotacao(anotacao); setAnotacaoModal(true); }}
          onDelete={async (aid) => { await deleteAnotacao(aid); load(); }}
        />
      )}
      {tab === "documentos" && (
        <DocumentosPanel contexto="processos" registroId={processo.id} titulo="Documentos do processo" />
      )}
      {tab === "tarefas" && (
        <TarefasTab
          tarefas={tarefas}
          onAdd={() => { setEditingTarefa(null); setTarefaModal(true); }}
          onEdit={(tarefa) => { setEditingTarefa(tarefa); setTarefaModal(true); }}
          onToggle={async (tid) => { const tarefa = tarefas.find((t) => t.id === tid); if (tarefa) await updateTarefa(tid, { concluida: !tarefa.concluida }); load(); }}
          onDelete={async (tid) => { await deleteTarefa(tid); load(); }}
        />
      )}
      {tab === "prazos" && (
        <PrazosTab
          prazos={prazos}
          onAdd={() => setPrazoModal(true)}
          onToggle={async (pid) => { const p = prazos.find((x) => x.id === pid); if (p) await updatePrazo(pid, { concluido: !p.concluido }); load(); }}
          onDelete={async (pid) => { await deletePrazo(pid); load(); }}
        />
      )}
      {tab === "audiencias" && (
        <AudienciasTab
          audiencias={audiencias}
          onAdd={() => setAudModal(true)}
          onToggle={async (aid) => { const a = audiencias.find((x) => x.id === aid); if (a) await updateAudiencia(aid, { realizada: !a.realizada }); load(); }}
          onDelete={async (aid) => { await deleteAudiencia(aid); load(); }}
        />
      )}
      {tab === "honorarios" && (
        <HonorariosTab
          honorarios={honorarios}
          onAdd={() => { setHonCategoria("cobranca"); setHonModal(true); }}
          onReceber={(h) => { setHonRecebendo(h); setHonDataRec(hojeISODate()); }}
          onDelete={async (hid) => { await deleteHonorario(hid); load(); }}
        />
      )}
      {tab === "atendimentos" && (
        <AtendimentosTab
          atendimentos={atendimentos}
          onAdd={() => setAtenModal(true)}
          onUpdate={async (aid, data) => { await updateAtendimento(aid, data); load(); }}
          onDelete={async (aid) => { await deleteAtendimento(aid); load(); }}
        />
      )}

      <MovimentacaoModal
        open={movModal}
        onClose={() => { setMovModal(false); setEditingMovimentacao(null); }}
        processoId={id}
        movimentacao={editingMovimentacao}
        onSaved={() => { load(); setMovModal(false); setEditingMovimentacao(null); }}
      />
      <NovoPrazoModal open={prazoModal} onClose={() => setPrazoModal(false)} processoId={id} onCreated={() => { load(); setPrazoModal(false); }} />
      <NovaAudienciaModal open={audModal} onClose={() => setAudModal(false)} processoId={id} onCreated={() => { load(); setAudModal(false); }} />
      <NovoHonorarioModal open={honModal} onClose={() => setHonModal(false)} processoId={id} categoria={honCategoria} onCreated={() => { load(); setHonModal(false); }} />

      {honRecebendo && (
        <Modal open onClose={() => setHonRecebendo(null)} title="Confirmar recebimento" size="sm">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">{honRecebendo.descricao}</p>
              <p className="text-sm font-bold text-green-700">{formatCurrency(honRecebendo.valor)}</p>
            </div>
            <Input label="Quando você recebeu? *" type="date" value={honDataRec} onChange={(e) => setHonDataRec(e.target.value)} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setHonRecebendo(null)}>Cancelar</Button>
              <Button
                disabled={!honDataRec}
                onClick={async () => {
                  const h = honRecebendo;
                  const quando = honDataRec || hojeISODate();
                  setHonRecebendo(null);
                  await updateHonorario(h.id, { status: "recebido", data_recebimento: quando });
                  await createHonorario({
                    processo_id: h.processo_id,
                    descricao: `Recebimento — ${h.descricao}`,
                    valor: h.valor,
                    categoria: "pagamento",
                    status: "recebido",
                    data_recebimento: quando,
                  });
                  load();
                }}
              >
                <CheckCircle className="w-4 h-4" /> Confirmar recebimento
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <NovoAtendimentoModal open={atenModal} onClose={() => setAtenModal(false)} processoId={id} clienteNome={processo.cliente_nome} onCreated={() => { load(); setAtenModal(false); }} />
      <AnotacaoModal
        open={anotacaoModal}
        onClose={() => { setAnotacaoModal(false); setEditingAnotacao(null); }}
        processoId={id}
        anotacao={editingAnotacao}
        onSaved={() => { load(); setAnotacaoModal(false); setEditingAnotacao(null); }}
      />
      <TarefaModal
        open={tarefaModal}
        onClose={() => { setTarefaModal(false); setEditingTarefa(null); }}
        processoId={id}
        tarefa={editingTarefa}
        onSaved={() => { load(); setTarefaModal(false); setEditingTarefa(null); }}
      />
      <IncidenteModal
        open={incidenteModal}
        onClose={() => { setIncidenteModal(false); setEditingIncidente(null); }}
        processoId={id}
        incidente={editingIncidente}
        onSaved={() => { load(); setIncidenteModal(false); setEditingIncidente(null); }}
      />
      <CalculoPenaModal
        open={calculoPenaModal}
        onClose={() => { setCalculoPenaModal(false); setEditingCalculoPena(null); }}
        processoId={id}
        calculo={editingCalculoPena}
        onSaved={() => { load(); setCalculoPenaModal(false); setEditingCalculoPena(null); }}
      />
      <BeneficioPenalModal
        open={beneficioPenalModal}
        onClose={() => { setBeneficioPenalModal(false); setEditingBeneficioPenal(null); }}
        processoId={id}
        beneficio={editingBeneficioPenal}
        onSaved={() => { load(); setBeneficioPenalModal(false); setEditingBeneficioPenal(null); }}
      />
      <VincularInqueritoModal
        open={vincularInqueritoModal}
        onClose={() => setVincularInqueritoModal(false)}
        acaoPenal={processo}
        processos={todosProcessos}
        onSaved={() => { load(); setVincularInqueritoModal(false); }}
      />
      <TransformarInqueritoModal
        open={transformarInqueritoModal}
        onClose={() => setTransformarInqueritoModal(false)}
        inquerito={processo}
        onCreated={(acaoId) => {
          setTransformarInqueritoModal(false);
          router.push(`/dashboard/processos/${acaoId}`);
        }}
      />
      <EditarProcessoModal open={editModal} onClose={() => setEditModal(false)} processo={processo} onSaved={() => { load(); setEditModal(false); }} />

      <VincularClienteModal
        open={vincularClienteModal}
        processo={processo}
        onClose={() => setVincularClienteModal(false)}
        onSaved={() => { load(); setVincularClienteModal(false); }}
      />

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Excluir Processo" size="sm">
        <p className="text-gray-600 text-sm mb-6">Tem certeza que deseja excluir este processo? Todos os prazos, audiências e honorários associados também serão excluídos. Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">{icon}{label}</div>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

function VincularClienteModal({ open, processo, onClose, onSaved }: {
  open: boolean; processo: Processo; onClose: () => void; onSaved: () => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    getClientes().then(setClientes);
    setClienteId(processo.cliente_id ?? "");
  }, [open, processo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
    const c = clientes.find((cl) => cl.id === clienteId);
    if (!c) return;
    setSaving(true);
    try {
      await updateProcesso(processo.id, { cliente_id: c.id, cliente_nome: c.nome });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function desvincular() {
    setSaving(true);
    try {
      await updateProcesso(processo.id, { cliente_id: undefined });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vincular cliente" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Associe este processo a um cliente cadastrado. O nome do cliente no processo será atualizado.
        </p>
        {clientes.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Nenhum cliente cadastrado ainda. Cadastre um cliente na aba Clientes primeiro.
          </p>
        ) : (
          <ComboBox
            label="Cliente cadastrado"
            placeholder="Selecione o cliente..."
            value={clienteId}
            onChange={setClienteId}
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          />
        )}
        <div className="flex justify-between gap-3 pt-1">
          {processo.cliente_id ? (
            <Button type="button" variant="ghost" onClick={desvincular} disabled={saving}>
              Desvincular
            </Button>
          ) : <span />}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!clienteId || saving}>{saving ? "Salvando..." : "Vincular"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ResultadoTab({ processo, onSaved }: { processo: Processo; onSaved: () => void }) {
  const [resultadoTipo, setResultadoTipo] = useState<string>(processo.resultado_tipo ?? "");
  const [descricao, setDescricao] = useState(processo.resultado_descricao ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResultadoTipo(processo.resultado_tipo ?? "");
    setDescricao(processo.resultado_descricao ?? "");
  }, [processo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProcesso(processo.id, {
        resultado_tipo: resultadoTipo || undefined,
        resultado_descricao: descricao.trim() || undefined,
      });
      onSaved();
    } catch (error) {
      alert(`Não consegui salvar o resultado. Se você ainda não rodou o SQL supabase-processos-resultados.sql atualizado, rode primeiro.\n\nDetalhe: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado do processo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="md:max-w-sm">
            <SelectComOutro
              label="Classificação do resultado"
              category="resultado_tipo"
              placeholder="Selecione..."
              value={resultadoTipo}
              onChange={setResultadoTipo}
              baseOptions={resultadoTipoOptions}
            />
          </div>
          <Textarea
            label="Descrição resumida"
            placeholder="Resumo objetivo do resultado, pontos importantes e próximos passos..."
            rows={5}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar resultado"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MovimentacoesTab({ movimentacoes, onAdd, onEdit, onDelete, onMarcarLidas, naoLidas }: {
  movimentacoes: Movimentacao[];
  onAdd: () => void;
  onEdit: (movimentacao: Movimentacao) => void;
  onDelete: (id: string) => void;
  onMarcarLidas: () => void;
  naoLidas: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {naoLidas > 0 ? (
          <button onClick={onMarcarLidas} className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2">
            Marcar {naoLidas} como lida{naoLidas > 1 ? "s" : ""}
          </button>
        ) : <span />}
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
      {movimentacoes.length === 0 ? <EmptyTab text="Nenhuma movimentação registrada" /> : (
        <div className="space-y-3">
          {movimentacoes.map((m) => (
            <Card key={m.id} className={!m.lida ? "border-l-2 border-l-gray-900" : ""}>
              <CardContent className="py-3 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!m.lida && <span className="w-1.5 h-1.5 rounded-full bg-[#21181d] shrink-0" />}
                      <p className="text-sm text-gray-900">{m.descricao}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-3.5">
                      {formatDate(m.data_movimentacao)}
                      {m.fonte ? ` · via ${m.fonte}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => onEdit(m)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar movimentação"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(m.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Excluir movimentação"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PrazosTab({ prazos, onAdd, onToggle, onDelete }: { prazos: Prazo[]; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
      {prazos.length === 0 ? <EmptyTab text="Nenhum prazo cadastrado" /> : (
        <div className="space-y-2">
          {prazos.sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime()).map((p) => {
            const days = daysUntil(p.data_prazo);
            return (
              <Card key={p.id} className={p.concluido ? "opacity-60" : ""}>
                <CardContent className="py-3 px-5">
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <button onClick={() => onToggle(p.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${p.concluido ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}>
                      {p.concluido && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`break-words text-sm font-medium ${p.concluido ? "line-through text-gray-400" : "text-gray-900"}`}>{p.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.tipo ?? "Prazo"} · {formatDate(p.data_prazo)}</p>
                    </div>
                    {!p.concluido && (
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${prazoColor(days)}`}>
                        {days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days}d`}
                      </span>
                    )}
                    <button onClick={() => onDelete(p.id)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AudienciasTab({ audiencias, onAdd, onToggle, onDelete }: { audiencias: Audiencia[]; onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
      {audiencias.length === 0 ? <EmptyTab text="Nenhuma audiência cadastrada" /> : (
        <div className="space-y-2">
          {audiencias.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()).map((a) => (
            <Card key={a.id} className={a.realizada ? "opacity-60" : ""}>
              <CardContent className="py-3 px-5">
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <button onClick={() => onToggle(a.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${a.realizada ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}>
                    {a.realizada && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`break-words text-sm font-medium ${a.realizada ? "line-through text-gray-400" : "text-gray-900"}`}>{a.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.data_hora)}{a.local ? ` · ${a.local}` : ""}</p>
                  </div>
                  <button onClick={() => onDelete(a.id)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HonorariosTab({ honorarios, onAdd, onReceber, onDelete }: {
  honorarios: Honorario[];
  onAdd: () => void;
  onReceber: (h: Honorario) => void;
  onDelete: (id: string) => void;
}) {
  const cobracas = honorarios
    .filter((h) => h.categoria === "cobranca")
    .sort((a, b) => (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999"));
  const pagamentos = honorarios.filter((h) => h.categoria === "pagamento");
  const totalCobrado = cobracas.reduce((s, h) => s + h.valor, 0);
  const totalPago = pagamentos.reduce((s, h) => s + h.valor, 0);
  const saldo = totalCobrado - totalPago;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl px-2 py-3 text-center sm:px-4">
          <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Cobrado</p>
          <p className="text-[10px] font-black text-gray-900 tabular-nums sm:text-xs">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-green-50 rounded-xl px-2 py-3 text-center sm:px-4">
          <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Recebido</p>
          <p className="text-[10px] font-black text-green-700 tabular-nums sm:text-xs">{formatCurrency(totalPago)}</p>
        </div>
        <div className={`rounded-xl px-2 py-3 text-center sm:px-4 ${saldo > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
          <p className="text-[10px] text-gray-500 mb-1 sm:text-xs">Saldo a receber</p>
          <p className={`text-[10px] font-black tabular-nums sm:text-xs ${saldo > 0 ? "text-amber-700" : "text-gray-400"}`}>{formatCurrency(Math.max(0, saldo))}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Cobranças e parcelas</h4>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="w-3.5 h-3.5" /> Cobrança
          </Button>
        </div>
        {cobracas.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">Nenhuma cobrança registrada. Clique em “Cobrança” para lançar (à vista ou parcelada).</p>
        ) : (
          <div className="space-y-2">
            {cobracas.map((h) => {
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
                          {recebida
                            ? `Recebido${h.data_recebimento ? ` em ${formatDate(h.data_recebimento)}` : ""}`
                            : h.data_vencimento
                              ? <>vence {formatDate(h.data_vencimento)}{vencida && <span className="ml-1 font-semibold text-red-600">(vencida)</span>}</>
                              : (h.tipo ?? "Honorário")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-900">{formatCurrency(h.valor)}</span>
                      {!recebida && (
                        <Button size="sm" onClick={() => onReceber(h)}>
                          <CheckCircle className="w-3.5 h-3.5" /> Recebido
                        </Button>
                      )}
                      <button onClick={() => onDelete(h.id)} title="Excluir" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{text}</div>;
}

function optionLabel<T extends string>(options: { value: T; label: string }[], value?: T): string {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}

function cleanText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mesmoCliente(a: Processo, b: Processo): boolean {
  if (a.cliente_id && b.cliente_id) return a.cliente_id === b.cliente_id;
  return a.cliente_nome.trim().toLowerCase() === b.cliente_nome.trim().toLowerCase();
}

function InqueritoInfoPanel({ processo, acaoPenal }: { processo: Processo; acaoPenal?: Processo }) {
  return (
    <Card className="mb-6 border-[#21181d]/20">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#21181d]" />
          <CardTitle>Dados do inquérito policial</CardTitle>
        </div>
        {acaoPenal && (
          <Link href={`/dashboard/processos/${acaoPenal.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
            Ação penal vinculada
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <InfoBlock label="Nº do inquérito" value={processo.numero_inquerito || processo.numero} />
          <InfoBlock label="Delegacia" value={processo.delegacia || "—"} />
          <InfoBlock label="Autoridade policial" value={processo.autoridade_policial || "—"} />
          <InfoBlock label="Data de instauração" value={processo.data_instauracao ? formatDate(processo.data_instauracao) : "—"} />
          <InfoBlock label="Situação" value={optionLabel(inqueritoSituacaoOptions, processo.situacao_inquerito)} />
          <InfoBlock label="Ação penal" value={acaoPenal ? `${acaoPenal.numero} · ${acaoPenal.titulo}` : "Ainda não vinculada"} />
        </div>
        {processo.relatorio_final && (
          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Relatório final</p>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{processo.relatorio_final}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 font-medium text-gray-900">{value}</p>
    </div>
  );
}

function InqueritosTab({
  inqueritos, onVincular, onDesvincular,
}: {
  inqueritos: Processo[];
  onVincular: () => void;
  onDesvincular: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onVincular}><Link2 className="w-3.5 h-3.5" /> Vincular inquérito</Button>
      </div>
      {inqueritos.length === 0 ? <EmptyTab text="Nenhum inquérito policial vinculado a esta ação penal" /> : (
        <div className="space-y-3">
          {inqueritos.map((inquerito) => (
            <Card key={inquerito.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <Link href={`/dashboard/processos/${inquerito.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline">
                        {inquerito.numero_inquerito || inquerito.numero}
                      </Link>
                      <Badge variant="neutral">{optionLabel(inqueritoSituacaoOptions, inquerito.situacao_inquerito)}</Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{inquerito.titulo}</p>
                    <div className="mt-2 grid gap-2 text-xs text-gray-500 md:grid-cols-3">
                      <span>Delegacia: {inquerito.delegacia || "—"}</span>
                      <span>Autoridade: {inquerito.autoridade_policial || "—"}</span>
                      <span>Instaurado: {inquerito.data_instauracao ? formatDate(inquerito.data_instauracao) : "—"}</span>
                    </div>
                    {inquerito.relatorio_final && <p className="mt-3 text-sm text-gray-600 line-clamp-3">{inquerito.relatorio_final}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/dashboard/processos/${inquerito.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
                      Abrir
                    </Link>
                    <button
                      onClick={() => { if (confirm("Desvincular este inquérito da ação penal?")) onDesvincular(inquerito.id); }}
                      className="text-xs font-semibold text-gray-400 hover:text-red-600"
                    >
                      Desvincular
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AnotacoesTab({
  anotacoes, onAdd, onEdit, onDelete,
}: {
  anotacoes: Anotacao[];
  onAdd: () => void;
  onEdit: (anotacao: Anotacao) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Nova anotação</Button>
      </div>
      {anotacoes.length === 0 ? <EmptyTab text="Nenhuma anotação registrada" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {anotacoes.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StickyNote className="w-4 h-4 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.titulo || "Anotação"}</p>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.conteudo}</p>
                    <p className="text-xs text-gray-400 mt-3">Atualizada em {formatDateTime(a.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onEdit(a)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar anotação">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Excluir anotação">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TarefasTab({
  tarefas, onAdd, onEdit, onToggle, onDelete,
}: {
  tarefas: Tarefa[];
  onAdd: () => void;
  onEdit: (tarefa: Tarefa) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const prioridadeLabel: Record<Prioridade, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
  const prioridadeClass: Record<Prioridade, string> = {
    alta: "bg-red-50 text-red-600",
    media: "bg-amber-50 text-amber-700",
    baixa: "bg-gray-100 text-gray-500",
  };
  const sorted = [...tarefas].sort((a, b) => (
    Number(a.concluida) - Number(b.concluida) ||
    (a.data_limite ?? "9999-12-31").localeCompare(b.data_limite ?? "9999-12-31") ||
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Nova tarefa</Button>
      </div>
      {tarefas.length === 0 ? <EmptyTab text="Nenhuma tarefa cadastrada" /> : (
        <div className="space-y-2">
          {sorted.map((t) => {
            const days = t.data_limite ? daysUntil(t.data_limite) : null;
            return (
              <Card key={t.id} className={t.concluida ? "opacity-60" : ""}>
                <CardContent className="py-3 px-5">
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <button
                      onClick={() => onToggle(t.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.concluida ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}
                    >
                      {t.concluida && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ListTodo className="w-4 h-4 text-gray-400 shrink-0" />
                        <p className={`text-sm font-medium truncate ${t.concluida ? "line-through text-gray-400" : "text-gray-900"}`}>{t.titulo}</p>
                      </div>
                      {t.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.descricao}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${prioridadeClass[t.prioridade]}`}>{prioridadeLabel[t.prioridade]}</span>
                        {t.data_limite && <span className="text-xs text-gray-400">{formatDate(t.data_limite)}</span>}
                      </div>
                    </div>
                    {!t.concluida && days !== null && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${prazoColor(days)}`}>
                        {days < 0 ? `${Math.abs(days)}d atrasada` : days === 0 ? "Hoje" : `${days}d`}
                      </span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button onClick={() => onEdit(t)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar tarefa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Excluir tarefa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IncidentesTab({
  incidentes, onAdd, onEdit, onDelete,
}: {
  incidentes: IncidenteExecucao[];
  onAdd: () => void;
  onEdit: (incidente: IncidenteExecucao) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...incidentes].sort((a, b) => (
    (b.data_pedido ?? b.created_at).localeCompare(a.data_pedido ?? a.created_at)
  ));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Novo incidente</Button>
      </div>
      {sorted.length === 0 ? <EmptyTab text="Nenhum incidente de execução penal registrado" /> : (
        <div className="space-y-3">
          {sorted.map((incidente) => (
            <Card key={incidente.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{incidente.titulo}</p>
                      <Badge variant="neutral">{optionLabel(incidenteTipoOptions, incidente.tipo)}</Badge>
                      <Badge variant={incidente.status === "deferido" || incidente.status === "cumprido" ? "success" : incidente.status === "indeferido" ? "warning" : "neutral"}>
                        {optionLabel(incidenteStatusOptions, incidente.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      {incidente.data_pedido && <span>Pedido: {formatDate(incidente.data_pedido)}</span>}
                      {incidente.data_decisao && <span>Decisão: {formatDate(incidente.data_decisao)}</span>}
                    </div>
                    {incidente.descricao && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{incidente.descricao}</p>}
                    {incidente.resultado && (
                      <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                        <strong>Resultado:</strong> {incidente.resultado}
                      </p>
                    )}
                    {incidente.observacoes && <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{incidente.observacoes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => onEdit(incidente)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar incidente">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Excluir este incidente?")) onDelete(incidente.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Excluir incidente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CalculosPenaTab({
  calculos, onAdd, onEdit, onDelete,
}: {
  calculos: CalculoPena[];
  onAdd: () => void;
  onEdit: (calculo: CalculoPena) => void;
  onDelete: (id: string) => void;
}) {
  function penaResumo(calculo: CalculoPena): string {
    const partes = [
      calculo.pena_anos ? `${calculo.pena_anos}a` : "",
      calculo.pena_meses ? `${calculo.pena_meses}m` : "",
      calculo.pena_dias ? `${calculo.pena_dias}d` : "",
    ].filter(Boolean);
    return partes.length ? partes.join(" ") : "Pena não informada";
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Novo cálculo</Button>
      </div>
      {calculos.length === 0 ? <EmptyTab text="Nenhum cálculo de pena registrado" /> : (
        <div className="space-y-3">
          {calculos.map((calculo) => (
            <Card key={calculo.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{calculo.titulo}</p>
                      <Badge variant="neutral">{penaResumo(calculo)}</Badge>
                      {calculo.regime_atual && <Badge variant="neutral">{calculo.regime_atual}</Badge>}
                    </div>
                    <div className="grid gap-2 text-xs text-gray-500 md:grid-cols-4">
                      <span>Início: {calculo.data_inicio ? formatDate(calculo.data_inicio) : "—"}</span>
                      <span>Detração: {calculo.dias_detracao ?? 0} dia(s)</span>
                      <span>Remição: {calculo.dias_remicao ?? 0} dia(s)</span>
                      <span>Marco: {calculo.marco_base || "—"}</span>
                    </div>
                    {calculo.resumo && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{calculo.resumo}</p>}
                    {calculo.observacoes && <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{calculo.observacoes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => onEdit(calculo)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar cálculo">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Excluir este cálculo de pena?")) onDelete(calculo.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Excluir cálculo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BeneficiosPenaisTab({
  beneficios, onAdd, onEdit, onDelete,
}: {
  beneficios: BeneficioPenal[];
  onAdd: () => void;
  onEdit: (beneficio: BeneficioPenal) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Novo pedido</Button>
      </div>
      {beneficios.length === 0 ? <EmptyTab text="Nenhum pedido de comutação ou indulto registrado" /> : (
        <div className="space-y-3">
          {beneficios.map((beneficio) => (
            <Card key={beneficio.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{beneficio.titulo}</p>
                      <Badge variant="neutral">{optionLabel(beneficioPenalTipoOptions, beneficio.tipo)}</Badge>
                      <Badge variant={beneficio.status === "deferido" ? "success" : beneficio.status === "indeferido" ? "warning" : "neutral"}>
                        {optionLabel(beneficioPenalStatusOptions, beneficio.status)}
                      </Badge>
                      {beneficio.decreto && <Badge variant="neutral">{beneficio.decreto}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      {beneficio.data_requerimento && <span>Requerido: {formatDate(beneficio.data_requerimento)}</span>}
                      {beneficio.data_decisao && <span>Decisão: {formatDate(beneficio.data_decisao)}</span>}
                    </div>
                    {beneficio.requisitos && <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap"><strong>Requisitos:</strong> {beneficio.requisitos}</p>}
                    {beneficio.resultado && <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap"><strong>Resultado:</strong> {beneficio.resultado}</p>}
                    {beneficio.observacoes && <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{beneficio.observacoes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => onEdit(beneficio)} className="text-gray-300 hover:text-gray-700 transition-colors" title="Editar pedido">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Excluir este pedido?")) onDelete(beneficio.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Excluir pedido"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AtendimentosTab({
  atendimentos, onAdd, onUpdate, onDelete,
}: {
  atendimentos: Atendimento[];
  onAdd: () => void;
  onUpdate: (id: string, data: Partial<Atendimento>) => void;
  onDelete: (id: string) => void;
}) {
  const tipoLabel: Record<string, string> = {
    consulta_inicial: "Consulta Inicial", retorno: "Retorno",
    orientacao: "Orientação", audiencia_prep: "Prep. Audiência", outro: "Outro",
  };
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={onAdd}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
      {atendimentos.length === 0 ? <EmptyTab text="Nenhum atendimento registrado" /> : (
        <div className="space-y-2">
          {atendimentos.map((a) => (
            <Card key={a.id} className={a.status === "cancelado" ? "opacity-50" : ""}>
              <CardContent className="py-3 px-5">
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{formatDateTime(a.data_hora)}</p>
                      {a.tipo && <span className="text-xs text-gray-400">{tipoLabel[a.tipo]}</span>}
                    </div>
                    {a.notas && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.notas}</p>}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {a.status === "agendado" && (
                      <button
                        onClick={() => onUpdate(a.id, { status: "realizado" })}
                        className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-gray-900 flex items-center justify-center transition-colors"
                        title="Marcar como realizado"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-transparent hover:text-gray-900" />
                      </button>
                    )}
                    {a.status === "realizado" && (
                      <span className="w-6 h-6 rounded-full bg-[#21181d] flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                    {a.status === "cancelado" && (
                      <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </span>
                    )}
                    <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MovimentacaoModal({
  open, onClose, processoId, movimentacao, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  movimentacao: Movimentacao | null;
  onSaved: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [tipo, setTipo] = useState("");

  useEffect(() => {
    if (!open) return;
    setDescricao(movimentacao?.descricao ?? "");
    setData(movimentacao?.data_movimentacao?.slice(0, 10) ?? new Date().toISOString().split("T")[0]);
    setTipo(movimentacao?.tipo ?? "");
  }, [open, movimentacao]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao) return;
    if (movimentacao) {
      await updateMovimentacao(movimentacao.id, { descricao, data_movimentacao: data, tipo: tipo || undefined });
    } else {
      await createMovimentacao({ processo_id: processoId, descricao, data_movimentacao: data, tipo: tipo || undefined, fonte: "manual", lida: true });
    }
    setDescricao(""); setTipo("");
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title={movimentacao ? "Editar movimentação" : "Nova movimentação"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Input label="Tipo (opcional)" placeholder="Despacho, Sentença, Acórdão..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <Textarea label="Descrição *" placeholder="Descreva a movimentação..." value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">{movimentacao ? "Salvar alterações" : "Salvar"}</Button></div>
      </form>
    </Modal>
  );
}

function NovoPrazoModal({ open, onClose, processoId, onCreated }: { open: boolean; onClose: () => void; processoId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("");
  const [prioridade, setPrioridade] = useState("media");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !data) return;
    await createPrazo({ processo_id: processoId, titulo, data_prazo: data, tipo: tipo as any || undefined, prioridade: prioridade as any, concluido: false });
    setTitulo(""); setData(""); setTipo(""); setPrioridade("media");
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Novo Prazo" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Recurso de Apelação" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Tipo" options={prazoTipoOptions} placeholder="Selecione..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <Select label="Prioridade" options={[{ value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }]} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
        <Input label="Data Limite *" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}

function NovaAudienciaModal({ open, onClose, processoId, onCreated }: { open: boolean; onClose: () => void; processoId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !dataHora) return;
    await createAudiencia({ processo_id: processoId, titulo, data_hora: dataHora, local: local || undefined, tipo: tipo as any || undefined, realizada: false });
    setTitulo(""); setDataHora(""); setLocal(""); setTipo("");
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nova Audiência" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Audiência de Instrução" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Select label="Tipo" options={audienciaTipoOptions} placeholder="Selecione..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <Input label="Data e Hora *" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
        <Input label="Local" placeholder="Fórum, sala, online..." value={local} onChange={(e) => setLocal(e.target.value)} />
        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}

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

function NovoHonorarioModal({ open, onClose, processoId, categoria, onCreated }: {
  open: boolean; onClose: () => void; processoId: string;
  categoria: "cobranca" | "pagamento"; onCreated: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(hojeISODate());
  const [vencimento, setVencimento] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [entrada, setEntrada] = useState("");
  const [saving, setSaving] = useState(false);

  const isCobranca = categoria === "cobranca";
  const nParcelas = Math.max(1, Math.min(60, parseInt(parcelas) || 1));
  const totalVal = parseFloat(valor) || 0;
  const entradaVal = parseFloat(entrada) || 0;
  const restanteVal = Math.max(0, Math.round((totalVal - entradaVal) * 100) / 100);
  const valorParcela = restanteVal > 0 ? restanteVal / nParcelas : 0;
  const qtdLanc = (entradaVal > 0 ? 1 : 0) + (restanteVal > 0 ? nParcelas : 0);

  useEffect(() => {
    if (open) {
      setDescricao(""); setValor(""); setTipo(""); setData(hojeISODate());
      setVencimento(""); setParcelas("1"); setEntrada("");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor) return;
    setSaving(true);
    try {
      if (isCobranca) {
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
      } else {
        await createHonorario({
          processo_id: processoId,
          descricao,
          valor: parseFloat(valor),
          tipo: (tipo as Honorario["tipo"]) || undefined,
          categoria,
          status: "recebido",
          data_recebimento: data,
        });
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isCobranca ? "Nova Cobrança" : "Registrar Pagamento"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Descrição *"
          placeholder={isCobranca ? "Ex: Honorários contratuais" : "Ex: Entrada, 1ª parcela…"}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={isCobranca && (nParcelas > 1 || entradaVal > 0) ? "Valor total (R$) *" : "Valor (R$) *"}
            type="number" min="0" step="0.01" placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <Select label="Tipo" options={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        </div>

        {isCobranca ? (
          <>
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
          </>
        ) : (
          <Input label="Data do recebimento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!descricao || !valor || saving}>
            {saving ? "Salvando..." : isCobranca ? (qtdLanc > 1 ? `Lançar ${qtdLanc} lançamentos` : "Registrar cobrança") : "Confirmar pagamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NovoAtendimentoModal({ open, onClose, processoId, clienteNome, onCreated }: { open: boolean; onClose: () => void; processoId: string; clienteNome: string; onCreated: () => void }) {
  const [dataHora, setDataHora] = useState("");
  const [tipo, setTipo] = useState("");
  const [duracao, setDuracao] = useState("60");
  const [notas, setNotas] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataHora) return;
    await createAtendimento({
      processo_id: processoId,
      cliente_nome: clienteNome,
      data_hora: dataHora,
      tipo: tipo as any || undefined,
      duracao_min: duracao ? parseInt(duracao) : undefined,
      status: "agendado",
      notas: notas || undefined,
    });
    setDataHora(""); setTipo(""); setDuracao("60"); setNotas("");
    onCreated();
  }

  const tipoOptions = [
    { value: "consulta_inicial", label: "Consulta Inicial" },
    { value: "retorno", label: "Retorno" },
    { value: "orientacao", label: "Orientação Jurídica" },
    { value: "audiencia_prep", label: "Preparação para Audiência" },
    { value: "outro", label: "Outro" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Novo Atendimento" size="sm">
      <p className="text-xs text-gray-500 mb-4">Cliente: <strong className="text-gray-800">{clienteNome}</strong></p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Data e Hora *" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Tipo" options={tipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <Input label="Duração (min)" type="number" min="15" step="15" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
        </div>
        <Textarea label="Anotações / Pauta" placeholder="Assuntos a tratar..." rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Agendar</Button></div>
      </form>
    </Modal>
  );
}

function AnotacaoModal({
  open, onClose, processoId, anotacao, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  anotacao: Anotacao | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo(anotacao?.titulo ?? "");
    setConteudo(anotacao?.conteudo ?? "");
  }, [open, anotacao]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim()) return;

    if (anotacao) {
      await updateAnotacao(anotacao.id, {
        titulo: titulo.trim() || undefined,
        conteudo: conteudo.trim(),
      });
    } else {
      await createAnotacao({
        processo_id: processoId,
        titulo: titulo.trim() || undefined,
        conteudo: conteudo.trim(),
      });
    }
    setTitulo("");
    setConteudo("");
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={anotacao ? "Editar anotação" : "Nova anotação"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título" placeholder="Ex: Estratégia, conversa com cliente..." value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Textarea label="Anotação *" placeholder="Escreva a anotação do processo..." rows={6} value={conteudo} onChange={(e) => setConteudo(e.target.value)} required />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{anotacao ? "Salvar alterações" : "Salvar anotação"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TarefaModal({
  open, onClose, processoId, tarefa, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  tarefa: Tarefa | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataLimite, setDataLimite] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");

  useEffect(() => {
    if (!open) return;
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setDataLimite(tarefa?.data_limite ?? "");
    setPrioridade(tarefa?.prioridade ?? "media");
  }, [open, tarefa]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    if (tarefa) {
      await updateTarefa(tarefa.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_limite: dataLimite || undefined,
        prioridade,
      });
    } else {
      await createTarefa({
        processo_id: processoId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_limite: dataLimite || undefined,
        prioridade,
        concluida: false,
      });
    }
    setTitulo("");
    setDescricao("");
    setDataLimite("");
    setPrioridade("media");
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={tarefa ? "Editar tarefa" : "Nova tarefa"} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Tarefa *" placeholder="Ex: Conferir intimação, ligar para cliente..." value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Textarea label="Descrição" placeholder="Detalhes, próximos passos, documentos..." rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data limite" type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
          <Select
            label="Prioridade"
            options={[{ value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }]}
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{tarefa ? "Salvar alterações" : "Criar tarefa"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function IncidenteModal({
  open, onClose, processoId, incidente, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  incidente: IncidenteExecucao | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<IncidenteExecucaoTipo>("trabalho_extramuros");
  const [status, setStatus] = useState<IncidenteExecucaoStatus>("em_preparacao");
  const [dataPedido, setDataPedido] = useState("");
  const [dataDecisao, setDataDecisao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo(incidente?.titulo ?? "");
    setTipo(incidente?.tipo ?? "trabalho_extramuros");
    setStatus(incidente?.status ?? "em_preparacao");
    setDataPedido(incidente?.data_pedido ?? "");
    setDataDecisao(incidente?.data_decisao ?? "");
    setDescricao(incidente?.descricao ?? "");
    setResultado(incidente?.resultado ?? "");
    setObservacoes(incidente?.observacoes ?? "");
  }, [open, incidente]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const payload = {
      processo_id: processoId,
      titulo: titulo.trim(),
      tipo,
      status,
      data_pedido: dataPedido || undefined,
      data_decisao: dataDecisao || undefined,
      descricao: cleanText(descricao),
      resultado: cleanText(resultado),
      observacoes: cleanText(observacoes),
    };
    if (incidente) {
      await updateIncidente(incidente.id, payload);
    } else {
      await createIncidente(payload);
    }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={incidente ? "Editar incidente" : "Novo incidente"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Pedido de trabalho extramuros" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Tipo" options={incidenteTipoOptions} value={tipo} onChange={(e) => setTipo(e.target.value as IncidenteExecucaoTipo)} />
          <Select label="Status" options={incidenteStatusOptions} value={status} onChange={(e) => setStatus(e.target.value as IncidenteExecucaoStatus)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data do pedido" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
          <Input label="Data da decisão" type="date" value={dataDecisao} onChange={(e) => setDataDecisao(e.target.value)} />
        </div>
        <Textarea label="Descrição" placeholder="Contexto do incidente, pedido feito e documentos relevantes..." rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Textarea label="Resultado" placeholder="Decisão, deferimento, exigências, observações da vara..." rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} />
        <Textarea label="Observações internas" placeholder="Estratégia, próximos passos, pendências..." rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{incidente ? "Salvar alterações" : "Criar incidente"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CalculoPenaModal({
  open, onClose, processoId, calculo, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  calculo: CalculoPena | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [penaAnos, setPenaAnos] = useState("");
  const [penaMeses, setPenaMeses] = useState("");
  const [penaDias, setPenaDias] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [diasDetracao, setDiasDetracao] = useState("");
  const [diasRemicao, setDiasRemicao] = useState("");
  const [regimeAtual, setRegimeAtual] = useState("");
  const [marcoBase, setMarcoBase] = useState("");
  const [resumo, setResumo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo(calculo?.titulo ?? "");
    setPenaAnos(calculo?.pena_anos?.toString() ?? "");
    setPenaMeses(calculo?.pena_meses?.toString() ?? "");
    setPenaDias(calculo?.pena_dias?.toString() ?? "");
    setDataInicio(calculo?.data_inicio ?? "");
    setDiasDetracao(calculo?.dias_detracao?.toString() ?? "");
    setDiasRemicao(calculo?.dias_remicao?.toString() ?? "");
    setRegimeAtual(calculo?.regime_atual ?? "");
    setMarcoBase(calculo?.marco_base ?? "");
    setResumo(calculo?.resumo ?? "");
    setObservacoes(calculo?.observacoes ?? "");
  }, [open, calculo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const payload = {
      processo_id: processoId,
      titulo: titulo.trim(),
      pena_anos: optionalNumber(penaAnos),
      pena_meses: optionalNumber(penaMeses),
      pena_dias: optionalNumber(penaDias),
      data_inicio: dataInicio || undefined,
      dias_detracao: optionalNumber(diasDetracao) ?? 0,
      dias_remicao: optionalNumber(diasRemicao) ?? 0,
      regime_atual: cleanText(regimeAtual),
      marco_base: cleanText(marcoBase),
      resumo: cleanText(resumo),
      observacoes: cleanText(observacoes),
    };
    if (calculo) {
      await updateCalculoPena(calculo.id, payload);
    } else {
      await createCalculoPena(payload);
    }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={calculo ? "Editar cálculo de pena" : "Novo cálculo de pena"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Cálculo para trabalho extramuros" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Anos" type="number" min="0" step="1" value={penaAnos} onChange={(e) => setPenaAnos(e.target.value)} />
          <Input label="Meses" type="number" min="0" step="1" value={penaMeses} onChange={(e) => setPenaMeses(e.target.value)} />
          <Input label="Dias" type="number" min="0" step="1" value={penaDias} onChange={(e) => setPenaDias(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Data de início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <Input label="Dias de detração" type="number" min="0" step="1" value={diasDetracao} onChange={(e) => setDiasDetracao(e.target.value)} />
          <Input label="Dias de remição" type="number" min="0" step="1" value={diasRemicao} onChange={(e) => setDiasRemicao(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Regime atual" placeholder="Ex: semiaberto" value={regimeAtual} onChange={(e) => setRegimeAtual(e.target.value)} />
          <Input label="Marco-base" placeholder="Ex: guia definitiva, prisão, unificação..." value={marcoBase} onChange={(e) => setMarcoBase(e.target.value)} />
        </div>
        <Textarea label="Resumo do cálculo" placeholder="Datas relevantes, frações, observações sobre requisito objetivo..." rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} />
        <Textarea label="Observações internas" placeholder="Pendências, documentos, cautelas..." rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{calculo ? "Salvar alterações" : "Criar cálculo"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BeneficioPenalModal({
  open, onClose, processoId, beneficio, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  beneficio: BeneficioPenal | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<BeneficioPenalTipo>("comutacao");
  const [status, setStatus] = useState<BeneficioPenalStatus>("em_estudo");
  const [decreto, setDecreto] = useState("");
  const [dataRequerimento, setDataRequerimento] = useState("");
  const [dataDecisao, setDataDecisao] = useState("");
  const [requisitos, setRequisitos] = useState("");
  const [resultado, setResultado] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo(beneficio?.titulo ?? "");
    setTipo(beneficio?.tipo ?? "comutacao");
    setStatus(beneficio?.status ?? "em_estudo");
    setDecreto(beneficio?.decreto ?? "");
    setDataRequerimento(beneficio?.data_requerimento ?? "");
    setDataDecisao(beneficio?.data_decisao ?? "");
    setRequisitos(beneficio?.requisitos ?? "");
    setResultado(beneficio?.resultado ?? "");
    setObservacoes(beneficio?.observacoes ?? "");
  }, [open, beneficio]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const payload = {
      processo_id: processoId,
      titulo: titulo.trim(),
      tipo,
      status,
      decreto: cleanText(decreto),
      data_requerimento: dataRequerimento || undefined,
      data_decisao: dataDecisao || undefined,
      requisitos: cleanText(requisitos),
      resultado: cleanText(resultado),
      observacoes: cleanText(observacoes),
    };
    if (beneficio) {
      await updateBeneficioPenal(beneficio.id, payload);
    } else {
      await createBeneficioPenal(payload);
    }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={beneficio ? "Editar comutação/indulto" : "Novo pedido de comutação/indulto"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" placeholder="Ex: Pedido de comutação - Decreto 2026" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Tipo" options={beneficioPenalTipoOptions} value={tipo} onChange={(e) => setTipo(e.target.value as BeneficioPenalTipo)} />
          <Select label="Status" options={beneficioPenalStatusOptions} value={status} onChange={(e) => setStatus(e.target.value as BeneficioPenalStatus)} />
          <Input label="Decreto" placeholder="Ex: Decreto 12.XXX/2026" value={decreto} onChange={(e) => setDecreto(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data do requerimento" type="date" value={dataRequerimento} onChange={(e) => setDataRequerimento(e.target.value)} />
          <Input label="Data da decisão" type="date" value={dataDecisao} onChange={(e) => setDataDecisao(e.target.value)} />
        </div>
        <Textarea label="Requisitos analisados" placeholder="Requisito objetivo/subjetivo, impeditivos, falta grave, lapso..." rows={4} value={requisitos} onChange={(e) => setRequisitos(e.target.value)} />
        <Textarea label="Resultado" placeholder="Decisão, fundamento e providências..." rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} />
        <Textarea label="Observações internas" placeholder="Notas de estratégia e pendências..." rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{beneficio ? "Salvar alterações" : "Criar pedido"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function VincularInqueritoModal({
  open, onClose, acaoPenal, processos, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  acaoPenal: Processo;
  processos: Processo[];
  onSaved: () => void;
}) {
  const [inqueritoId, setInqueritoId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setInqueritoId("");
  }, [open]);

  const inqueritos = processos
    .filter((p) => isInqueritoTipo(p.tipo) && p.id !== acaoPenal.id)
    .filter((p) => !p.processo_principal_id || p.processo_principal_id === acaoPenal.id)
    .sort((a, b) => {
      const sameA = mesmoCliente(a, acaoPenal) ? 0 : 1;
      const sameB = mesmoCliente(b, acaoPenal) ? 0 : 1;
      return sameA - sameB || a.cliente_nome.localeCompare(b.cliente_nome) || a.numero.localeCompare(b.numero);
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!inqueritoId) return;
    setSaving(true);
    try {
      await updateProcesso(inqueritoId, { processo_principal_id: acaoPenal.id });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vincular inquérito" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Selecione um inquérito policial já cadastrado para vincular a esta ação penal.
        </p>
        {inqueritos.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Não há inquéritos disponíveis. Cadastre primeiro um processo do tipo Inquérito policial.
          </p>
        ) : (
          <ComboBox
            label="Inquérito"
            placeholder="Selecione o inquérito..."
            value={inqueritoId}
            onChange={setInqueritoId}
            options={inqueritos.map((p) => ({
              value: p.id,
              label: `${p.numero_inquerito || p.numero} · ${p.cliente_nome}${mesmoCliente(p, acaoPenal) ? "" : " · outro cliente"}`,
            }))}
          />
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!inqueritoId || saving}>{saving ? "Vinculando..." : "Vincular"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TransformarInqueritoModal({
  open, onClose, inquerito, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  inquerito: Processo;
  onCreated: (acaoId: string) => void;
}) {
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [vara, setVara] = useState("");
  const [comarca, setComarca] = useState("");
  const [uf, setUf] = useState("");
  const [dataDistribuicao, setDataDistribuicao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNumero("");
    setTitulo(inquerito.titulo && !/inquerito/i.test(inquerito.titulo) ? inquerito.titulo : "Ação penal");
    setTribunal(inquerito.tribunal ?? "TJRJ");
    setVara(inquerito.vara ?? "");
    setComarca(inquerito.comarca ?? "");
    setUf(inquerito.uf ?? "RJ");
    setDataDistribuicao("");
    setDescricao([
      `Ação penal originada do inquérito ${inquerito.numero_inquerito || inquerito.numero}.`,
      inquerito.delegacia ? `Delegacia: ${inquerito.delegacia}.` : "",
      inquerito.autoridade_policial ? `Autoridade policial: ${inquerito.autoridade_policial}.` : "",
      inquerito.relatorio_final ? `\nRelatório final do inquérito:\n${inquerito.relatorio_final}` : "",
    ].filter(Boolean).join("\n"));
  }, [open, inquerito]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim() || !titulo.trim()) return;
    setSaving(true);
    try {
      const acao = await createProcesso({
        numero: numero.trim(),
        titulo: titulo.trim(),
        descricao: cleanText(descricao),
        status: "ativo",
        tribunal: cleanText(tribunal),
        vara: cleanText(vara),
        comarca: cleanText(comarca),
        uf: cleanText(uf),
        tipo: "criminal",
        fase: "Ação penal",
        cliente_id: inquerito.cliente_id,
        cliente_nome: inquerito.cliente_nome,
        cliente_cpf_cnpj: inquerito.cliente_cpf_cnpj,
        parte_contraria: inquerito.parte_contraria,
        data_distribuicao: dataDistribuicao || undefined,
        monitorar_datajud: true,
      });
      await updateProcesso(inquerito.id, {
        processo_principal_id: acao.id,
        situacao_inquerito: "denunciado",
      });
      onCreated(acao.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Transformar em ação penal" size="md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          O inquérito será mantido como origem e uma nova ação penal será criada vinculada a ele.
        </p>
        <Input label="Número da ação penal *" placeholder="0000000-00.0000.0.00.0000" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <Input label="Título / assunto *" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Tribunal" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
          <Input label="Vara" value={vara} onChange={(e) => setVara(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Comarca" value={comarca} onChange={(e) => setComarca(e.target.value)} />
          <Input label="UF" value={uf} onChange={(e) => setUf(e.target.value)} />
          <Input label="Distribuição" type="date" value={dataDistribuicao} onChange={(e) => setDataDistribuicao(e.target.value)} />
        </div>
        <Textarea label="Descrição inicial" rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!numero.trim() || !titulo.trim() || saving}>
            {saving ? "Criando..." : "Criar ação penal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditarProcessoModal({ open, onClose, processo, onSaved }: { open: boolean; onClose: () => void; processo: Processo; onSaved: () => void }) {
  const [form, setForm] = useState({ ...processo, valor_causa: processo.valor_causa?.toString() ?? "" });
  const [processosRelacionaveis, setProcessosRelacionaveis] = useState<Processo[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...processo, valor_causa: processo.valor_causa?.toString() ?? "" });
    getProcessos().then((lista) => {
      setProcessosRelacionaveis(
        lista.filter((p) => p.id !== processo.id && (p.tipo === "criminal" || p.tipo === "execucao_penal"))
      );
    });
  }, [open, processo]);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  const permiteIntegracao = form.tipo === "inquerito_policial" || form.tipo === "bo_pm";
  const isInqueritoForm = isInqueritoTipo(form.tipo as string);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProcesso(processo.id, {
        titulo: form.titulo, cliente_nome: form.cliente_nome,
        parte_contraria: form.parte_contraria || undefined,
        tribunal: form.tribunal || undefined, vara: form.vara || undefined,
        comarca: form.comarca || undefined, uf: form.uf || undefined,
        tipo: (form.tipo as ProcessoTipo) || undefined,
        processo_principal_id: permiteIntegracao ? form.processo_principal_id || undefined : undefined,
        numero_inquerito: isInqueritoForm ? form.numero_inquerito || undefined : undefined,
        delegacia: isInqueritoForm ? form.delegacia || undefined : undefined,
        autoridade_policial: isInqueritoForm ? form.autoridade_policial || undefined : undefined,
        data_instauracao: isInqueritoForm ? form.data_instauracao || undefined : undefined,
        situacao_inquerito: isInqueritoForm ? (form.situacao_inquerito as InqueritoSituacao) || undefined : undefined,
        relatorio_final: isInqueritoForm ? form.relatorio_final || undefined : undefined,
        status: form.status as any, fase: form.fase || undefined,
        valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : undefined,
        descricao: form.descricao || undefined,
      });
      onSaved();
    } catch (error) {
      alert(`Não consegui salvar o processo. Se você escolheu uma classificação nova ou integrou a um processo criminal, rode primeiro o SQL supabase-processos-resultados.sql.\n\nDetalhe: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar Processo" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Título *" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Cliente *" value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} required />
          <Input label="Parte Contrária" value={form.parte_contraria ?? ""} onChange={(e) => set("parte_contraria", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectComOutro label="Classificação" category="processo_tipo" baseOptions={processoTipoOptions} value={form.tipo ?? "outro"} onChange={(v) => set("tipo", v)} />
          <Select label="Status" options={statusOptions} value={form.status} onChange={(e) => set("status", e.target.value)} />
        </div>
        {permiteIntegracao && (
          <ComboBox
            label="Integrar a processo criminal principal"
            placeholder="Selecione um processo criminal..."
            value={form.processo_principal_id ?? ""}
            onChange={(v) => set("processo_principal_id", v)}
            options={processosRelacionaveis.map((p) => ({
              value: p.id,
              label: `${p.numero} · ${p.cliente_nome}`,
            }))}
          />
        )}
        {isInqueritoForm && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#21181d]" />
              <p className="text-sm font-semibold text-gray-900">Informações do inquérito policial</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Número do inquérito" value={form.numero_inquerito ?? ""} onChange={(e) => set("numero_inquerito", e.target.value)} />
              <Select
                label="Situação"
                options={inqueritoSituacaoOptions}
                value={form.situacao_inquerito ?? "em_andamento"}
                onChange={(e) => set("situacao_inquerito", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Delegacia" value={form.delegacia ?? ""} onChange={(e) => set("delegacia", e.target.value)} />
              <Input label="Autoridade policial" value={form.autoridade_policial ?? ""} onChange={(e) => set("autoridade_policial", e.target.value)} />
            </div>
            <Input label="Data de instauração" type="date" value={form.data_instauracao ?? ""} onChange={(e) => set("data_instauracao", e.target.value)} />
            <Textarea label="Relatório final / observações do inquérito" rows={4} value={form.relatorio_final ?? ""} onChange={(e) => set("relatorio_final", e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Input label="Tribunal" value={form.tribunal ?? ""} onChange={(e) => set("tribunal", e.target.value)} />
          <Input label="Vara" value={form.vara ?? ""} onChange={(e) => set("vara", e.target.value)} />
          <Input label="Comarca" value={form.comarca ?? ""} onChange={(e) => set("comarca", e.target.value)} />
          <Input label="UF" value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value)} />
        </div>
        <Textarea label="Descrição" value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}
