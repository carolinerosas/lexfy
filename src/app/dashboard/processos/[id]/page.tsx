"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit2, Trash2, Plus, Clock, Calendar,
  DollarSign, FileText, MapPin, User, Scale, CheckCircle, Users, X,
  RefreshCw, Bell, BellOff, Copy, ListTodo, StickyNote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  getProcesso, getProcessos, updateProcesso, deleteProcesso,
  getMovimentacoesByProcesso, createMovimentacao, updateMovimentacao, deleteMovimentacao, deleteMovimentacoesByProcesso,
  marcarTodasMovimentacoesLidas,
  getPrazos, createPrazo, updatePrazo, deletePrazo,
  getAudiencias, createAudiencia, updateAudiencia, deleteAudiencia,
  getHonorarios, createHonorario, updateHonorario, deleteHonorario,
  getAtendimentosByProcesso, createAtendimento, updateAtendimento, deleteAtendimento,
  getAnotacoesByProcesso, createAnotacao, updateAnotacao, deleteAnotacao,
  getTarefasByProcesso, createTarefa, updateTarefa, deleteTarefa,
  sincronizarProcesso,
} from "@/lib/store";
import { formatCurrency, formatDate, formatDateTime, daysUntil, prazoColor } from "@/lib/utils";
import type { Processo, Movimentacao, Prazo, Audiencia, Honorario, Atendimento, Anotacao, Tarefa, Prioridade, ProcessoTipo, ProcessoResultadoTipo } from "@/types";

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

type Tab = "movimentacoes" | "resultado" | "anotacoes" | "tarefas" | "prazos" | "audiencias" | "honorarios" | "atendimentos";

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
    if (!processo?.numero) return;
    await navigator.clipboard.writeText(processo.numero);
    setCopiedNumero(true);
    setTimeout(() => setCopiedNumero(false), 1400);
  }

  const [movModal, setMovModal] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<Movimentacao | null>(null);
  const [prazoModal, setPrazoModal] = useState(false);
  const [audModal, setAudModal] = useState(false);
  const [honModal, setHonModal] = useState(false);
  const [atenModal, setAtenModal] = useState(false);
  const [anotacaoModal, setAnotacaoModal] = useState(false);
  const [editingAnotacao, setEditingAnotacao] = useState<Anotacao | null>(null);
  const [tarefaModal, setTarefaModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const load = useCallback(async () => {
    const p = await getProcesso(id);
    if (!p) { router.push("/dashboard/processos"); return; }
    setProcesso(p);
    const [movs, prazosAll, audienciasAll, honorariosAll, atendimentosData, anotacoesData, tarefasData] = await Promise.all([
      getMovimentacoesByProcesso(id),
      getPrazos(),
      getAudiencias(),
      getHonorarios(),
      getAtendimentosByProcesso(id),
      getAnotacoesByProcesso(id),
      getTarefasByProcesso(id),
    ]);
    setMovimentacoes(movs);
    setPrazos(prazosAll.filter((pr) => pr.processo_id === id));
    setAudiencias(audienciasAll.filter((a) => a.processo_id === id));
    setHonorarios(honorariosAll.filter((h) => h.processo_id === id));
    setAtendimentos(atendimentosData);
    setAnotacoes(anotacoesData);
    setTarefas(tarefasData);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    await deleteProcesso(id);
    router.push("/dashboard/processos");
  }

  if (!processo) return null;

  const statusVariantMap: Record<string, "success" | "warning" | "neutral"> = {
    ativo: "success", suspenso: "warning", arquivado: "neutral", encerrado: "neutral",
  };

  const movNaoLidas = movimentacoes.filter((m) => !m.lida).length;

  const hasResultado = Boolean(processo.resultado_tipo || processo.resultado_descricao || processo.pena);

  const tabs: { key: Tab; label: string; count: number; unread?: number; showCount?: boolean }[] = [
    { key: "movimentacoes", label: "Movimentações", count: movimentacoes.length, unread: movNaoLidas },
    { key: "resultado", label: "Resultado", count: hasResultado ? 1 : 0, showCount: false },
    { key: "anotacoes", label: "Anotações", count: anotacoes.length, showCount: false },
    { key: "tarefas", label: "Tarefas", count: tarefas.filter((t) => !t.concluida).length },
    { key: "prazos", label: "Prazos", count: prazos.filter((p) => !p.concluido).length },
    { key: "audiencias", label: "Audiências", count: audiencias.filter((a) => !a.realizada).length },
    { key: "atendimentos", label: "Atendimentos", count: atendimentos.filter((a) => a.status === "agendado").length },
    { key: "honorarios", label: "Honorários", count: honorarios.length },
  ];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/processos">
            <button className="mt-1 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{processo.numero}</code>
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
            <h1 className="text-xl font-bold text-gray-900">{processo.titulo}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-stretch rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
            <button
              onClick={toggleMonitorar}
              title={processo.monitorar_datajud ? "Monitoramento ativo — clique para desativar" : "Ativar monitoramento automático"}
              className={`flex items-center justify-center px-2.5 transition-colors border-r border-gray-200 ${processo.monitorar_datajud ? "bg-gray-900 text-white hover:bg-gray-800" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              {processo.monitorar_datajud ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{syncMsg}</span>
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
        <InfoCard icon={<User className="w-4 h-4 text-blue-500" />} label="Cliente" value={processo.cliente_nome} />
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

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
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
          onAdd={(cat) => { setHonCategoria(cat); setHonModal(true); }}
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
      <EditarProcessoModal open={editModal} onClose={() => setEditModal(false)} processo={processo} onSaved={() => { load(); setEditModal(false); }} />

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

function ResultadoTab({ processo, onSaved }: { processo: Processo; onSaved: () => void }) {
  const [resultadoTipo, setResultadoTipo] = useState<ProcessoResultadoTipo | "">(processo.resultado_tipo ?? "");
  const [descricao, setDescricao] = useState(processo.resultado_descricao ?? "");
  const [pena, setPena] = useState(processo.pena ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setResultadoTipo(processo.resultado_tipo ?? "");
    setDescricao(processo.resultado_descricao ?? "");
    setPena(processo.pena ?? "");
  }, [processo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProcesso(processo.id, {
        resultado_tipo: resultadoTipo || undefined,
        resultado_descricao: descricao.trim() || undefined,
        pena: pena.trim() || undefined,
      });
      onSaved();
    } catch (error) {
      alert(`Não consegui salvar o resultado. Se você ainda não rodou o SQL supabase-processos-resultados.sql, rode primeiro.\n\nDetalhe: ${error instanceof Error ? error.message : "erro desconhecido"}`);
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
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Classificação do resultado"
              placeholder="Selecione..."
              value={resultadoTipo}
              onChange={(e) => setResultadoTipo(e.target.value as ProcessoResultadoTipo | "")}
              options={resultadoTipoOptions}
            />
            <Input
              label="Pena / condição criminal"
              placeholder="Ex: 2 anos em regime aberto, sursis..."
              value={pena}
              onChange={(e) => setPena(e.target.value)}
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
                      {!m.lida && <span className="w-1.5 h-1.5 rounded-full bg-gray-900 shrink-0" />}
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
                  <div className="flex items-center gap-3">
                    <button onClick={() => onToggle(p.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${p.concluido ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}>
                      {p.concluido && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${p.concluido ? "line-through text-gray-400" : "text-gray-900"}`}>{p.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.tipo ?? "Prazo"} · {formatDate(p.data_prazo)}</p>
                    </div>
                    {!p.concluido && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${prazoColor(days)}`}>
                        {days < 0 ? `${Math.abs(days)}d atrasado` : days === 0 ? "Hoje" : `${days}d`}
                      </span>
                    )}
                    <button onClick={() => onDelete(p.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
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
                <div className="flex items-center gap-3">
                  <button onClick={() => onToggle(a.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${a.realizada ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}>
                    {a.realizada && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${a.realizada ? "line-through text-gray-400" : "text-gray-900"}`}>{a.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.data_hora)}{a.local ? ` · ${a.local}` : ""}</p>
                  </div>
                  <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HonorariosTab({ honorarios, onAdd, onDelete }: {
  honorarios: Honorario[];
  onAdd: (categoria: "cobranca" | "pagamento") => void;
  onDelete: (id: string) => void;
}) {
  const cobracas = honorarios.filter((h) => h.categoria === "cobranca");
  const pagamentos = honorarios.filter((h) => h.categoria === "pagamento");
  const totalCobrado = cobracas.reduce((s, h) => s + h.valor, 0);
  const totalPago = pagamentos.reduce((s, h) => s + h.valor, 0);
  const saldo = totalCobrado - totalPago;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Cobrado</p>
          <p className="text-lg font-black text-gray-900">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-green-50 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Pago</p>
          <p className="text-lg font-black text-green-700">{formatCurrency(totalPago)}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 text-center ${saldo > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
          <p className="text-xs text-gray-500 mb-1">Saldo devedor</p>
          <p className={`text-lg font-black ${saldo > 0 ? "text-amber-700" : "text-gray-400"}`}>{formatCurrency(saldo)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Cobranças</h4>
          <Button size="sm" variant="outline" onClick={() => onAdd("cobranca")}>
            <Plus className="w-3.5 h-3.5" /> Cobrança
          </Button>
        </div>
        {cobracas.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">Nenhuma cobrança registrada</p>
        ) : (
          <div className="space-y-2">
            {cobracas.map((h) => (
              <Card key={h.id}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{h.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.tipo ?? "Honorário"}
                        {h.data_lancamento ? ` · ${formatDate(h.data_lancamento)}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(h.valor)}</span>
                    <button onClick={() => onDelete(h.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Pagamentos recebidos</h4>
          <Button size="sm" onClick={() => onAdd("pagamento")}>
            <Plus className="w-3.5 h-3.5" /> Pagamento
          </Button>
        </div>
        {pagamentos.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">Nenhum pagamento registrado</p>
        ) : (
          <div className="space-y-2">
            {pagamentos.map((h) => (
              <Card key={h.id}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{h.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.data_recebimento ? `Recebido em ${formatDate(h.data_recebimento)}` : "Data não informada"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(h.valor)}</span>
                    <button onClick={() => onDelete(h.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{text}</div>;
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggle(t.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.concluida ? "border-green-500 bg-green-500" : "border-gray-300 hover:border-green-400"}`}
                    >
                      {t.concluida && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
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
                    <div className="flex shrink-0 items-center gap-1">
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
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{formatDateTime(a.data_hora)}</p>
                      {a.tipo && <span className="text-xs text-gray-400">{tipoLabel[a.tipo]}</span>}
                    </div>
                    {a.notas && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.notas}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                      <span className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
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
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo" options={prazoTipoOptions} placeholder="Selecione..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <Select label="Prioridade" options={[{ value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }]} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
        <Input label="Data Limite *" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
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
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}

function NovoHonorarioModal({ open, onClose, processoId, categoria, onCreated }: {
  open: boolean; onClose: () => void; processoId: string;
  categoria: "cobranca" | "pagamento"; onCreated: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao || !valor) return;
    await createHonorario({
      processo_id: processoId,
      descricao,
      valor: parseFloat(valor),
      tipo: (tipo as any) || undefined,
      categoria,
      status: categoria === "pagamento" ? "recebido" : "pendente",
      data_recebimento: categoria === "pagamento" ? data : undefined,
      data_lancamento: categoria === "cobranca" ? data : undefined,
    });
    setDescricao(""); setValor(""); setTipo(""); setData(new Date().toISOString().split("T")[0]);
    onCreated();
  }

  const isCobranca = categoria === "cobranca";
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
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor (R$) *" type="number" min="0" step="0.01" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} required />
          <Select label="Tipo" options={honorarioTipoOptions} placeholder="Tipo..." value={tipo} onChange={(e) => setTipo(e.target.value)} />
        </div>
        <Input
          label={isCobranca ? "Data da cobrança" : "Data do recebimento"}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{isCobranca ? "Registrar cobrança" : "Confirmar pagamento"}</Button>
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
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-4">
          <Input label="Cliente *" value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} required />
          <Input label="Parte Contrária" value={form.parte_contraria ?? ""} onChange={(e) => set("parte_contraria", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Classificação" options={processoTipoOptions} value={form.tipo ?? "outro"} onChange={(e) => set("tipo", e.target.value)} />
          <Select label="Status" options={statusOptions} value={form.status} onChange={(e) => set("status", e.target.value)} />
        </div>
        {permiteIntegracao && (
          <Select
            label="Integrar a processo criminal principal"
            placeholder="Selecione um processo criminal..."
            value={form.processo_principal_id ?? ""}
            onChange={(e) => set("processo_principal_id", e.target.value)}
            options={processosRelacionaveis.map((p) => ({
              value: p.id,
              label: `${p.numero} · ${p.cliente_nome}`,
            }))}
          />
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Input label="Tribunal" value={form.tribunal ?? ""} onChange={(e) => set("tribunal", e.target.value)} />
          <Input label="Vara" value={form.vara ?? ""} onChange={(e) => set("vara", e.target.value)} />
          <Input label="Comarca" value={form.comarca ?? ""} onChange={(e) => set("comarca", e.target.value)} />
          <Input label="UF" value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value)} />
        </div>
        <Textarea label="Descrição" value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}
