"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SelectComOutro } from "@/components/ui/select-com-outro";
import { ComboBox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProcesso, createCliente, updateCliente, updateProcesso, getClientes, getProcessos } from "@/lib/store";
import { comarcaBaseOptions, mergeOptions, tipoPenalBaseOptions, unidadePrisionalBaseOptions, valuesToOptions, varaBaseOptions } from "@/lib/cadastro-options";
import {
  buscarNoDataJud,
  DataJudError,
  formatarCNJ,
  parseCNJ,
  ufFromTribunalDataJud,
  type DataJudResult,
} from "@/lib/datajud";
import type { Cliente, InqueritoSituacao, Processo, ProcessoTipo } from "@/types";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

const tipoOptions = [
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "criminal", label: "Criminal" },
  { value: "juri", label: "Júri" },
  { value: "execucao_penal", label: "Execução penal" },
  { value: "inquerito_policial", label: "Inquérito policial" },
  { value: "bo_pm", label: "BO PM" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "federal", label: "Federal" },
  { value: "outro", label: "Outro" },
];

const inqueritoSituacaoOptions: { value: InqueritoSituacao; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "relatado", label: "Relatado" },
  { value: "denunciado", label: "Denunciado / ação penal proposta" },
  { value: "arquivado", label: "Arquivado" },
  { value: "baixado", label: "Baixado" },
  { value: "outro", label: "Outro" },
];

type LookupStatus = "idle" | "loading" | "ok" | "erro";

function textoBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferirTipoDataJud(data: DataJudResult, tribunal: string | null): ProcessoTipo {
  const texto = textoBusca([
    data.classe,
    data.sistema,
    data.grau,
    tribunal,
    ...(data.assuntos ?? []),
  ].filter(Boolean).join(" "));

  if (/(execucao penal|seep|seeu|pena privativa|pena restritiva)/.test(texto)) return "execucao_penal";
  if (/(inquerito policial|inquérito policial)/.test(texto)) return "inquerito_policial";
  if (/(boletim de ocorrencia|boletim de ocorrência)/.test(texto)) return "bo_pm";
  if (/(familia|família|alimentos|guarda|divorcio|divórcio|uniao estavel|união estável)/.test(texto)) return "familia";
  if (/(juri|júri|tribunal do juri|tribunal do júri)/.test(texto)) return "juri";
  if (/(penal|criminal|crime|pena|trafico|tráfico)/.test(texto)) return "criminal";
  if (/(trabalh|reclamacao trabalhista|trt)/.test(texto)) return "trabalhista";
  if (/(previdenc|beneficio|aposentad|inss)/.test(texto)) return "previdenciario";
  if (/(tribut|fiscal|execucao fiscal)/.test(texto)) return "tributario";
  if ((tribunal ?? "").startsWith("trf")) return "federal";
  return "civel";
}

function descricaoDataJud(data: DataJudResult): string {
  const linhas = [
    data.classe ? `Classe: ${data.classe}` : "",
    data.assuntos?.length ? `Assuntos: ${data.assuntos.slice(0, 5).join("; ")}` : "",
    data.sistema ? `Sistema: ${data.sistema}` : "",
    data.grau ? `Grau: ${data.grau}` : "",
  ].filter(Boolean);

  return linhas.join("\n");
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clienteInicial?: Pick<Cliente, "id" | "nome" | "cpf">;
}

function emptyForm() {
  return {
    numero: "",
    titulo: "",
    cliente_nome: "",
    cliente_cpf_cnpj: "",
    parte_contraria: "",
    tribunal: "",
    vara: "",
    comarca: "",
    uf: "",
    tipo: "",
    fase: "",
    valor_causa: "",
    data_distribuicao: "",
    descricao: "",
    numero_inquerito: "",
    delegacia: "",
    autoridade_policial: "",
    unidade_prisional: "",
    tipo_penal: "",
    data_instauracao: "",
    situacao_inquerito: "em_andamento" as InqueritoSituacao,
    relatorio_final: "",
    status: "ativo" as const,
  };
}

export function NovoProcessoModal({ open, onClose, onCreated, clienteInicial }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processosExistentes, setProcessosExistentes] = useState<Processo[]>([]);
  const [clienteId, setClienteId] = useState(clienteInicial?.id ?? "");
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    cliente_nome: clienteInicial?.nome ?? "",
    cliente_cpf_cnpj: clienteInicial?.cpf ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dataJudStatus, setDataJudStatus] = useState<LookupStatus>("idle");
  const [dataJudMessage, setDataJudMessage] = useState("");
  const [numeroConsultado, setNumeroConsultado] = useState("");
  const isInquerito = form.tipo === "inquerito_policial";
  const isPenal = ["criminal", "juri", "execucao_penal"].includes(form.tipo);

  useEffect(() => {
    if (!open) return;
    Promise.all([getClientes(), getProcessos()]).then(([cls, procs]) => {
      setClientes(cls);
      setProcessosExistentes(procs);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const numeroFormatado = formatarCNJ(form.numero);
    const digits = form.numero.replace(/\D/g, "");

    if (!numeroFormatado) {
      if (digits.length < 20) {
        setDataJudStatus("idle");
        setDataJudMessage("");
      } else {
        setDataJudStatus("erro");
        setDataJudMessage("Formato CNJ invalido. Use 0000000-00.0000.0.00.0000.");
      }
      return;
    }

    if (numeroFormatado === numeroConsultado) return;

    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setDataJudStatus("loading");
      setDataJudMessage("Buscando dados publicos no DataJud...");

      try {
        const data = await buscarNoDataJud(numeroFormatado);
        if (cancelado) return;

        const { tribunal } = parseCNJ(numeroFormatado);
        const tribunalLabel = tribunal?.toUpperCase() ?? "";
        const titulo = data.classe || data.assuntos?.[0] || "Processo judicial";
        const descricao = descricaoDataJud(data);

        setForm((f) => ({
          ...f,
          numero: numeroFormatado,
          titulo: f.titulo.trim() ? f.titulo : titulo,
          tribunal: f.tribunal.trim() ? f.tribunal : tribunalLabel,
          vara: f.vara.trim() ? f.vara : data.orgaoJulgador ?? "",
          uf: f.uf || ufFromTribunalDataJud(tribunal),
          tipo: f.tipo || inferirTipoDataJud(data, tribunal),
          fase: f.fase.trim() ? f.fase : data.sistema ?? data.grau ?? "",
          data_distribuicao: f.data_distribuicao || data.dataAjuizamento?.slice(0, 10) || "",
          descricao: f.descricao.trim() ? f.descricao : descricao,
        }));

        setNumeroConsultado(numeroFormatado);
        setDataJudStatus("ok");
        setDataJudMessage(
          "Capa encontrada. Confira cliente, parte contraria e valor, porque o DataJud publico nem sempre informa esses dados."
        );
      } catch (error) {
        if (cancelado) return;
        setNumeroConsultado(numeroFormatado);
        setDataJudStatus("erro");
        setDataJudMessage(
          error instanceof DataJudError
            ? error.message
            : "Nao consegui consultar o DataJud agora. Voce ainda pode preencher manualmente."
        );
      }
    }, 600);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [open, form.numero, numeroConsultado]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const varaOptions = mergeOptions(varaBaseOptions, valuesToOptions(processosExistentes.map((p) => p.vara)));
  const comarcaOptions = mergeOptions(comarcaBaseOptions, valuesToOptions(processosExistentes.map((p) => p.comarca)));
  const unidadePrisionalOptions = mergeOptions(unidadePrisionalBaseOptions, valuesToOptions(processosExistentes.map((p) => p.unidade_prisional)));
  const tipoPenalOptions = mergeOptions(tipoPenalBaseOptions, valuesToOptions(processosExistentes.map((p) => p.tipo_penal)));

  function handleClienteSelect(id: string) {
    setClienteId(id);
    if (!id) return;
    const c = clientes.find((cl) => cl.id === id);
    if (c) {
      setForm((f) => ({
        ...f,
        cliente_nome: c.nome,
        cliente_cpf_cnpj: c.cpf ?? f.cliente_cpf_cnpj,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isInquerito && !form.numero.trim()) {
      setSaveError("Informe o número do processo. Para cadastrar sem esse número, selecione Inquérito policial.");
      return;
    }
    if (!form.titulo.trim() || !form.cliente_nome.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      let resolvedClienteId = clienteId;
      if (!resolvedClienteId && form.cliente_nome.trim()) {
        const existente = clientes.find(
          (c) => c.nome.toLowerCase().trim() === form.cliente_nome.toLowerCase().trim()
        );
        if (existente) {
          resolvedClienteId = existente.id;
        } else {
          const novo = await createCliente({
            nome: form.cliente_nome.trim(),
            cpf: form.cliente_cpf_cnpj || undefined,
          });
          resolvedClienteId = novo.id;
        }
      }

      await createProcesso({
        numero: form.numero.trim(),
        titulo: form.titulo,
        cliente_id: resolvedClienteId || undefined,
        cliente_nome: form.cliente_nome,
        cliente_cpf_cnpj: form.cliente_cpf_cnpj || undefined,
        parte_contraria: form.parte_contraria || undefined,
        tribunal: form.tribunal || undefined,
        vara: form.vara || undefined,
        comarca: form.comarca || undefined,
        uf: form.uf || undefined,
        tipo: (form.tipo as any) || undefined,
        fase: form.fase || undefined,
        valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : undefined,
        data_distribuicao: form.data_distribuicao || undefined,
        descricao: form.descricao || undefined,
        numero_inquerito: isInquerito ? form.numero_inquerito || undefined : undefined,
        delegacia: isInquerito ? form.delegacia || undefined : undefined,
        autoridade_policial: isInquerito ? form.autoridade_policial || undefined : undefined,
        unidade_prisional: isPenal ? form.unidade_prisional || undefined : undefined,
        tipo_penal: isPenal ? form.tipo_penal || undefined : undefined,
        data_instauracao: isInquerito ? form.data_instauracao || undefined : undefined,
        situacao_inquerito: isInquerito ? form.situacao_inquerito || undefined : undefined,
        relatorio_final: isInquerito ? form.relatorio_final || undefined : undefined,
        status: "ativo",
      });
      // A unidade prisional é do apenado: guarda na ficha do cliente e nos demais processos criminais/execução do mesmo cliente.
      if (isPenal && resolvedClienteId && form.unidade_prisional.trim()) {
        const unidade = form.unidade_prisional.trim();
        await updateCliente(resolvedClienteId, { unidade_prisional: unidade });
        const irmaos = processosExistentes.filter(
          (p) =>
            p.cliente_id === resolvedClienteId &&
            ["criminal", "juri", "execucao_penal"].includes(String(p.tipo ?? "")) &&
            (p.unidade_prisional ?? "") !== unidade
        );
        await Promise.all(irmaos.map((p) => updateProcesso(p.id, { unidade_prisional: unidade })));
      }
      onCreated();
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Não foi possível salvar o cadastro.";
      const precisaSql = /unidade_prisional|schema cache|column/i.test(detalhe);
      setSaveError(precisaSql ? `${detalhe} — rode o SQL supabase-processos-unidade-prisional.sql no Supabase.` : detalhe);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Processo" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={isInquerito ? "Número do processo (opcional)" : "Número do Processo *"}
            placeholder={isInquerito ? "Preencha somente se já houver processo judicial" : "0000000-00.0000.0.00.0000"}
            hint={isInquerito ? "O inquérito pode ser cadastrado sem número de processo." : undefined}
            value={form.numero}
            onChange={(e) => set("numero", e.target.value)}
          />
          <SelectComOutro
            label="Classificação"
            category="processo_tipo"
            baseOptions={tipoOptions}
            placeholder="Selecione..."
            value={form.tipo}
            onChange={(v) => set("tipo", v)}
          />
        </div>

        {dataJudStatus !== "idle" && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
              dataJudStatus === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : dataJudStatus === "erro"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            {dataJudStatus === "loading" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
            {dataJudStatus === "ok" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {dataJudStatus === "erro" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{dataJudMessage}</span>
          </div>
        )}

        <Input
          label="Título / Assunto *"
          placeholder="Descreva brevemente o processo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          required
        />

        {form.tipo === "inquerito_policial" && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Informações do inquérito policial</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Número do inquérito" value={form.numero_inquerito} onChange={(e) => set("numero_inquerito", e.target.value)} />
              <Select
                label="Situação"
                options={inqueritoSituacaoOptions}
                value={form.situacao_inquerito}
                onChange={(e) => set("situacao_inquerito", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Delegacia" value={form.delegacia} onChange={(e) => set("delegacia", e.target.value)} />
              <Input label="Autoridade policial" value={form.autoridade_policial} onChange={(e) => set("autoridade_policial", e.target.value)} />
            </div>
            <Input label="Data de instauração" type="date" value={form.data_instauracao} onChange={(e) => set("data_instauracao", e.target.value)} />
            <Textarea label="Relatório final / observações do inquérito" rows={4} value={form.relatorio_final} onChange={(e) => set("relatorio_final", e.target.value)} />
          </div>
        )}

        {isPenal && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectComOutro
              label="Unidade prisional (do apenado)"
              category="processo_unidade_prisional"
              baseOptions={unidadePrisionalOptions}
              placeholder="Selecione ou cadastre..."
              value={form.unidade_prisional}
              onChange={(v) => set("unidade_prisional", v)}
            />
            <SelectComOutro
              label="Tipo penal imputado"
              category="processo_tipo_penal"
              baseOptions={tipoPenalOptions}
              placeholder="Selecione ou cadastre..."
              value={form.tipo_penal}
              onChange={(v) => set("tipo_penal", v)}
            />
          </div>
        )}

        {clientes.length > 0 && (
          <ComboBox
            label="Cliente cadastrado"
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar da lista de clientes…"
            value={clienteId}
            onChange={handleClienteSelect}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome do Cliente *"
            placeholder="Nome completo"
            value={form.cliente_nome}
            onChange={(e) => set("cliente_nome", e.target.value)}
            required
          />
          <Input
            label="CPF/CNPJ do Cliente"
            placeholder="000.000.000-00"
            value={form.cliente_cpf_cnpj}
            onChange={(e) => set("cliente_cpf_cnpj", e.target.value)}
          />
        </div>

        <Input
          label="Parte Contrária"
          placeholder="Nome da parte contrária"
          value={form.parte_contraria}
          onChange={(e) => set("parte_contraria", e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Tribunal"
            placeholder="TJERJ, TRT, TRF..."
            value={form.tribunal}
            onChange={(e) => set("tribunal", e.target.value)}
          />
          <SelectComOutro
            label="Vara / Câmara"
            category="processo_vara"
            baseOptions={varaOptions}
            placeholder="Selecione ou cadastre..."
            value={form.vara}
            onChange={(v) => set("vara", v)}
          />
          <Select
            label="UF"
            options={ufs}
            placeholder="Estado"
            value={form.uf}
            onChange={(e) => set("uf", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectComOutro
            label="Comarca"
            category="processo_comarca"
            baseOptions={comarcaOptions}
            placeholder="Selecione ou cadastre..."
            value={form.comarca}
            onChange={(v) => set("comarca", v)}
          />
          <Input
            label="Fase Processual"
            placeholder="Conhecimento, Execução..."
            value={form.fase}
            onChange={(e) => set("fase", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Valor da Causa (R$)"
            type="number"
            placeholder="0,00"
            min="0"
            step="0.01"
            value={form.valor_causa}
            onChange={(e) => set("valor_causa", e.target.value)}
          />
          <Input
            label="Data de Distribuição"
            type="date"
            value={form.data_distribuicao}
            onChange={(e) => set("data_distribuicao", e.target.value)}
          />
        </div>

        <Textarea
          label="Descrição / Observações"
          placeholder="Histórico do caso, estratégia, informações relevantes..."
          rows={4}
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
        />

        {saveError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível salvar: {saveError}</p>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 mt-2 flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:-mx-6 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar Processo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
