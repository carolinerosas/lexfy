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
import { createProcesso, createCliente, getClientes } from "@/lib/store";
import {
  buscarNoDataJud,
  DataJudError,
  formatarCNJ,
  parseCNJ,
  ufFromTribunalDataJud,
  type DataJudResult,
} from "@/lib/datajud";
import type { Cliente, ProcessoTipo } from "@/types";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

const tipoOptions = [
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "criminal", label: "Criminal" },
  { value: "execucao_penal", label: "Execução penal" },
  { value: "inquerito_policial", label: "Inquérito policial" },
  { value: "bo_pm", label: "BO PM" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "federal", label: "Federal" },
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
  if (/(penal|criminal|crime|pena|juri|júri|trafico|tráfico)/.test(texto)) return "criminal";
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
}

export function NovoProcessoModal({ open, onClose, onCreated }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [form, setForm] = useState({
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
    status: "ativo" as const,
  });
  const [saving, setSaving] = useState(false);
  const [dataJudStatus, setDataJudStatus] = useState<LookupStatus>("idle");
  const [dataJudMessage, setDataJudMessage] = useState("");
  const [numeroConsultado, setNumeroConsultado] = useState("");

  useEffect(() => {
    if (open) {
      getClientes().then(setClientes);
    } else {
      setDataJudStatus("idle");
      setDataJudMessage("");
      setNumeroConsultado("");
    }
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
    if (!form.numero || !form.titulo || !form.cliente_nome) return;
    setSaving(true);
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
        numero: form.numero,
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
        status: "ativo",
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Processo" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Número do Processo *"
            placeholder="0000000-00.0000.0.00.0000"
            value={form.numero}
            onChange={(e) => set("numero", e.target.value)}
            required
          />
          <SelectComOutro
            label="Tipo"
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

        {clientes.length > 0 && (
          <ComboBox
            label="Cliente cadastrado"
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar da lista de clientes…"
            value={clienteId}
            onChange={handleClienteSelect}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Tribunal"
            placeholder="TJERJ, TRT, TRF..."
            value={form.tribunal}
            onChange={(e) => set("tribunal", e.target.value)}
          />
          <Input
            label="Vara / Câmara"
            placeholder="1ª Vara Cível"
            value={form.vara}
            onChange={(e) => set("vara", e.target.value)}
          />
          <Select
            label="UF"
            options={ufs}
            placeholder="Estado"
            value={form.uf}
            onChange={(e) => set("uf", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Comarca"
            placeholder="Rio de Janeiro"
            value={form.comarca}
            onChange={(e) => set("comarca", e.target.value)}
          />
          <Input
            label="Fase Processual"
            placeholder="Conhecimento, Execução..."
            value={form.fase}
            onChange={(e) => set("fase", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-2 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar Processo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
