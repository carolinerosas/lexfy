"use client";
// Execução penal: incidentes (progressão, livramento, remição...) e comutação/indulto.
// Mesmas tabelas e telas do JUSTIO antigo, carregando os dados pelo id do processo.
import { useCallback, useEffect, useState } from "react";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  getIncidentesByProcesso, createIncidente, updateIncidente, deleteIncidente,
  getBeneficiosPenaisByProcesso, createBeneficioPenal, updateBeneficioPenal, deleteBeneficioPenal,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { alterar, useDB } from "@/novo/lib/store";
import type { RecursoPedido } from "@/novo/lib/types";
import type { IncidenteExecucao, BeneficioPenal, IncidenteExecucaoTipo, IncidenteExecucaoStatus, BeneficioPenalTipo, BeneficioPenalStatus } from "@/types";


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
  { value: "parcialmente_deferido", label: "Parcialmente deferido" },
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
  { value: "parcialmente_deferido", label: "Parcialmente deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "prejudicado", label: "Prejudicado" },
];


const recursoInterpostoOptions = [
  { value: "", label: "Não interposto" },
  { value: "Agravo em execução da defesa", label: "Agravo em execução da defesa" },
  { value: "Agravo em execução do MP", label: "Agravo em execução do MP" },
  { value: "Habeas corpus", label: "Habeas corpus" },
];
const recursoResultadoOptions = [
  { value: "", label: "Pendente" },
  { value: "Provido", label: "Provido" },
  { value: "Parcialmente provido", label: "Parcialmente provido" },
  { value: "Desprovido", label: "Desprovido" },
  { value: "Não conhecido", label: "Não conhecido" },
  { value: "Ordem concedida", label: "Ordem concedida" },
  { value: "Ordem denegada", label: "Ordem denegada" },
];

/** Recursos dos pedidos, guardados na execução do caso (sem coluna nova no banco). */
function useRecursos(processoId: string) {
  const db = useDB();
  const caso = db.casos.find((c) => c.id === processoId);
  const recursos = caso?.execucao?.recursos ?? {};
  const salvar = (id: string, r: RecursoPedido) => {
    if (!caso) return;
    const ex = caso.execucao ?? { crimes: [], remicoes: [], interrupcoes: [] };
    const limpo = Object.fromEntries(Object.entries(r).filter(([, v]) => v)) as RecursoPedido;
    const novos = { ...(ex.recursos ?? {}) };
    if (Object.keys(limpo).length) novos[id] = limpo; else delete novos[id];
    alterar("casos", caso.id, { execucao: { ...ex, recursos: novos } });
  };
  return { recursos, salvar };
}

function LinhaRecurso({ r }: { r?: RecursoPedido }) {
  if (!r?.interposto) return null;
  return (
    <p className="mt-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
      <strong>Recurso:</strong> {r.interposto} · <strong>Resultado:</strong> {r.resultado || "Pendente"}{r.data ? ` (${formatDate(r.data)})` : ""}
      {r.efeito ? `\n${r.efeito}` : ""}
    </p>
  );
}

function CamposRecurso({ r, setR }: { r: RecursoPedido; setR: (r: RecursoPedido) => void }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-700">Recurso contra a decisão</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Recurso" options={recursoInterpostoOptions} value={r.interposto ?? ""} onChange={(e) => setR({ ...r, interposto: e.target.value })} />
        <Select label="Resultado do recurso" options={recursoResultadoOptions} value={r.resultado ?? ""} onChange={(e) => setR({ ...r, resultado: e.target.value })} />
        <Input label="Data do acórdão" type="date" value={r.data ?? ""} onChange={(e) => setR({ ...r, data: e.target.value })} />
      </div>
      <Textarea label="O que o acórdão mudou" rows={2} value={r.efeito ?? ""} onChange={(e) => setR({ ...r, efeito: e.target.value })} />
    </fieldset>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{text}</div>;
}

function optionLabel<T extends string>(options: { value: T; label: string }[], value?: T): string {
  if (!value) return "-";
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


function IncidentesTab({
  incidentes, onAdd, onEdit, onDelete, recursos,
}: {
  recursos: Record<string, RecursoPedido>;
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
                      <Badge variant={incidente.status === "deferido" || incidente.status === "parcialmente_deferido" || incidente.status === "cumprido" ? "success" : incidente.status === "indeferido" ? "warning" : "neutral"}>
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
                    <LinhaRecurso r={recursos[incidente.id]} />
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


function BeneficiosPenaisTab({
  beneficios, onAdd, onEdit, onDelete, recursos,
}: {
  recursos: Record<string, RecursoPedido>;
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
                      <Badge variant={beneficio.status === "deferido" || beneficio.status === "parcialmente_deferido" ? "success" : beneficio.status === "indeferido" ? "warning" : "neutral"}>
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
                    <LinhaRecurso r={recursos[beneficio.id]} />
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


function IncidenteModal({
  open, onClose, processoId, incidente, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  processoId: string;
  incidente: IncidenteExecucao | null;
  onSaved: () => void;
}) {
  const { recursos, salvar: salvarRecurso } = useRecursos(processoId);
  const [recurso, setRecurso] = useState<RecursoPedido>({});
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
    setRecurso(incidente ? recursos[incidente.id] ?? {} : {});
    setTitulo(incidente?.titulo ?? "");
    setTipo(incidente?.tipo ?? "trabalho_extramuros");
    setStatus(incidente?.status ?? "em_preparacao");
    setDataPedido(incidente?.data_pedido ?? "");
    setDataDecisao(incidente?.data_decisao ?? "");
    setDescricao(incidente?.descricao ?? "");
    setResultado(incidente?.resultado ?? "");
    setObservacoes(incidente?.observacoes ?? "");
  }, [open, incidente]); // eslint-disable-line react-hooks/exhaustive-deps -- recarrega só ao abrir

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
    const id = incidente ? (await updateIncidente(incidente.id, payload), incidente.id) : (await createIncidente(payload)).id;
    salvarRecurso(id, recurso);
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
        <CamposRecurso r={recurso} setR={setRecurso} />
        <Textarea label="Observações internas" placeholder="Estratégia, próximos passos, pendências..." rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{incidente ? "Salvar alterações" : "Criar incidente"}</Button>
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
  const { recursos, salvar: salvarRecurso } = useRecursos(processoId);
  const [recurso, setRecurso] = useState<RecursoPedido>({});
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
    setRecurso(beneficio ? recursos[beneficio.id] ?? {} : {});
    setTitulo(beneficio?.titulo ?? "");
    setTipo(beneficio?.tipo ?? "comutacao");
    setStatus(beneficio?.status ?? "em_estudo");
    setDecreto(beneficio?.decreto ?? "");
    setDataRequerimento(beneficio?.data_requerimento ?? "");
    setDataDecisao(beneficio?.data_decisao ?? "");
    setRequisitos(beneficio?.requisitos ?? "");
    setResultado(beneficio?.resultado ?? "");
    setObservacoes(beneficio?.observacoes ?? "");
  }, [open, beneficio]); // eslint-disable-line react-hooks/exhaustive-deps -- recarrega só ao abrir

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
    const id = beneficio ? (await updateBeneficioPenal(beneficio.id, payload), beneficio.id) : (await createBeneficioPenal(payload)).id;
    salvarRecurso(id, recurso);
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
        <CamposRecurso r={recurso} setR={setRecurso} />
        <Textarea label="Observações internas" placeholder="Notas de estratégia e pendências..." rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{beneficio ? "Salvar alterações" : "Criar pedido"}</Button>
        </div>
      </form>
    </Modal>
  );
}



export function ExecucaoPenalPanel({ processoId, parte }: { processoId: string; parte: "incidentes" | "beneficios" }) {
  const { recursos } = useRecursos(processoId);
  const [incidentes, setIncidentes] = useState<IncidenteExecucao[]>([]);
  const [beneficios, setBeneficios] = useState<BeneficioPenal[]>([]);
  const [incidenteModal, setIncidenteModal] = useState(false);
  const [editingIncidente, setEditingIncidente] = useState<IncidenteExecucao | null>(null);
  const [beneficioModal, setBeneficioModal] = useState(false);
  const [editingBeneficio, setEditingBeneficio] = useState<BeneficioPenal | null>(null);
  const [rodada, setRodada] = useState(0);
  const load = useCallback(() => setRodada((r) => r + 1), []);
  useEffect(() => {
    let vivo = true;
    Promise.all([getIncidentesByProcesso(processoId), getBeneficiosPenaisByProcesso(processoId)]).then(([i, b]) => {
      if (vivo) { setIncidentes(i); setBeneficios(b); }
    });
    return () => { vivo = false; };
  }, [processoId, rodada]);

  return (
    <>
      {parte === "incidentes" ? (
        <IncidentesTab
          recursos={recursos}
          incidentes={incidentes}
          onAdd={() => { setEditingIncidente(null); setIncidenteModal(true); }}
          onEdit={(i) => { setEditingIncidente(i); setIncidenteModal(true); }}
          onDelete={async (iid) => { await deleteIncidente(iid); load(); }}
        />
      ) : (
        <BeneficiosPenaisTab
          recursos={recursos}
          beneficios={beneficios}
          onAdd={() => { setEditingBeneficio(null); setBeneficioModal(true); }}
          onEdit={(b) => { setEditingBeneficio(b); setBeneficioModal(true); }}
          onDelete={async (bid) => { await deleteBeneficioPenal(bid); load(); }}
        />
      )}
      <IncidenteModal
        open={incidenteModal}
        onClose={() => { setIncidenteModal(false); setEditingIncidente(null); }}
        processoId={processoId}
        incidente={editingIncidente}
        onSaved={() => { load(); setIncidenteModal(false); setEditingIncidente(null); }}
      />
      <BeneficioPenalModal
        open={beneficioModal}
        onClose={() => { setBeneficioModal(false); setEditingBeneficio(null); }}
        processoId={processoId}
        beneficio={editingBeneficio}
        onSaved={() => { load(); setBeneficioModal(false); setEditingBeneficio(null); }}
      />
    </>
  );
}
