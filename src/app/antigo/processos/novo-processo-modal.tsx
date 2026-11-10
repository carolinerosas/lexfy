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
import { createProcesso, createCliente, getClientes, getProcessos } from "@/lib/store";
import { comarcaBaseOptions, mergeOptions, tipoPenalBaseOptions, unidadePrisionalBaseOptions, valuesToOptions, varaBaseOptions } from "@/lib/cadastro-options";
import {
  buscarNoDataJud,
  DataJudError,
  formatarCNJ,
  parseCNJ,
  ufFromTribunalDataJud,
  type DataJudResult,
} from "@/lib/datajud";
import type { Cliente, InqueritoSituacao, Processo, ProcessoClienteParte, ProcessoTipo } from "@/types";

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

export function inferirTipoDataJud(data: DataJudResult, tribunal: string | null): ProcessoTipo {
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

export function descricaoDataJud(data: DataJudResult): string {
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
  const [partes, setPartes] = useState<ProcessoClienteParte[]>(
    clienteInicial ? [{ cliente_id: clienteInicial.id, nome: clienteInicial.nome, cpf_cnpj: clienteInicial.cpf, papel: "Cliente principal" }] : []
  );
  const [parteManualNome, setParteManualNome] = useState("");
  const [parteManualCpf, setParteManualCpf] = useState("");
  const [tiposPenais, setTiposPenais] = useState<string[]>([]);
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
    setClienteId(clienteInicial?.id ?? "");
    setPartes(clienteInicial ? [{ cliente_id: clienteInicial.id, nome: clienteInicial.nome, cpf_cnpj: clienteInicial.cpf, papel: "Cliente principal" }] : []);
    setParteManualNome("");
    setParteManualCpf("");
    setTiposPenais([]);
    setForm({
      ...emptyForm(),
      cliente_nome: clienteInicial?.nome ?? "",
      cliente_cpf_cnpj: clienteInicial?.cpf ?? "",
    });
    setSaveError("");
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

  function addParte(parte: ProcessoClienteParte) {
    const nome = parte.nome.trim();
    if (!nome) return;
    setPartes((atuais) => {
      const key = parte.cliente_id || nome.toLocaleLowerCase("pt-BR");
      if (atuais.some((p) => (p.cliente_id || p.nome.trim().toLocaleLowerCase("pt-BR")) === key)) return atuais;
      return [...atuais, { ...parte, nome, papel: parte.papel || "Cliente" }];
    });
  }

  function removerParte(index: number) {
    setPartes((atuais) => atuais.filter((_, i) => i !== index));
  }

  function adicionarParteManual() {
    const nome = parteManualNome.trim();
    if (!nome) return;
    addParte({ nome, cpf_cnpj: parteManualCpf.trim() || undefined, papel: "Cliente" });
    setParteManualNome("");
    setParteManualCpf("");
  }

  function addTipoPenal(value: string) {
    const tipo = value.trim();
    if (!tipo) return;
    setTiposPenais((atuais) => atuais.some((item) => item.toLocaleLowerCase("pt-BR") === tipo.toLocaleLowerCase("pt-BR")) ? atuais : [...atuais, tipo]);
    set("tipo_penal", "");
  }

  function removerTipoPenal(index: number) {
    setTiposPenais((atuais) => atuais.filter((_, i) => i !== index));
  }

  const varaOptions = mergeOptions(varaBaseOptions, valuesToOptions(processosExistentes.map((p) => p.vara)));
  const comarcaOptions = mergeOptions(comarcaBaseOptions, valuesToOptions(processosExistentes.map((p) => p.comarca)));
  const unidadePrisionalOptions = mergeOptions(unidadePrisionalBaseOptions, valuesToOptions(processosExistentes.map((p) => p.unidade_prisional)));
  const tipoPenalOptions = mergeOptions(tipoPenalBaseOptions, valuesToOptions(processosExistentes.flatMap((p) => p.tipos_penais?.length ? p.tipos_penais : [p.tipo_penal])), valuesToOptions(tiposPenais));

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
      addParte({ cliente_id: c.id, nome: c.nome, cpf_cnpj: c.cpf, papel: partes.length === 0 ? "Cliente principal" : "Cliente" });
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
      const partesBase = [
        ...partes,
        form.cliente_nome.trim()
          ? { cliente_id: clienteId || undefined, nome: form.cliente_nome.trim(), cpf_cnpj: form.cliente_cpf_cnpj || undefined, papel: "Cliente principal" }
          : undefined,
      ].filter((parte): parte is ProcessoClienteParte => Boolean(parte?.nome?.trim()));

      const partesUnicas: ProcessoClienteParte[] = [];
      for (const parte of partesBase) {
        const key = parte.cliente_id || parte.nome.trim().toLocaleLowerCase("pt-BR");
        if (!key || partesUnicas.some((p) => (p.cliente_id || p.nome.trim().toLocaleLowerCase("pt-BR")) === key)) continue;
        partesUnicas.push(parte);
      }

      const partesResolvidas: ProcessoClienteParte[] = [];
      for (const parte of partesUnicas) {
        let resolvedClienteId = parte.cliente_id;
        let cpf = parte.cpf_cnpj;
        if (!resolvedClienteId && parte.nome.trim()) {
          const existente = clientes.find(
            (c) => c.nome.toLowerCase().trim() === parte.nome.toLowerCase().trim()
          );
          if (existente) {
            resolvedClienteId = existente.id;
            cpf = cpf || existente.cpf;
          } else {
            const novo = await createCliente({
              nome: parte.nome.trim(),
              cpf: cpf || undefined,
            });
            resolvedClienteId = novo.id;
            cpf = novo.cpf;
          }
        }
        partesResolvidas.push({
          cliente_id: resolvedClienteId,
          nome: parte.nome.trim(),
          cpf_cnpj: cpf || undefined,
          papel: parte.papel || (partesResolvidas.length === 0 ? "Cliente principal" : "Cliente"),
        });
      }

      const principal = partesResolvidas[0];
      if (!principal) {
        setSaveError("Informe pelo menos um cliente para o processo.");
        setSaving(false);
        return;
      }

      await createProcesso({
        numero: form.numero.trim(),
        titulo: form.titulo,
        cliente_id: principal.cliente_id || undefined,
        cliente_nome: principal.nome,
        cliente_cpf_cnpj: principal.cpf_cnpj || undefined,
        clientes_partes: partesResolvidas,
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
        tipo_penal: isPenal ? tiposPenais.join("; ") || undefined : undefined,
        tipos_penais: isPenal ? tiposPenais : undefined,
        data_instauracao: isInquerito ? form.data_instauracao || undefined : undefined,
        situacao_inquerito: isInquerito ? form.situacao_inquerito || undefined : undefined,
        relatorio_final: isInquerito ? form.relatorio_final || undefined : undefined,
        status: "ativo",
      });
      onCreated();
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : "Não foi possível salvar o cadastro.";
      const precisaSql = /clientes_partes|tipos_penais/i.test(detalhe)
        ? "supabase-processos-litisconsorcio.sql"
        : /unidade_prisional|schema cache|column/i.test(detalhe)
          ? "supabase-processos-unidade-prisional.sql"
          : "";
      setSaveError(precisaSql ? `${detalhe} — rode o SQL ${precisaSql} no Supabase.` : detalhe);
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
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Tipos penais imputados</p>
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
              label="Adicionar tipo penal"
              category="processo_tipo_penal"
              baseOptions={tipoPenalOptions}
              placeholder="Selecione ou cadastre..."
              value={form.tipo_penal}
              onChange={addTipoPenal}
            />
            </div>
            {tiposPenais.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tiposPenais.map((tipo, index) => (
                  <button
                    key={`${tipo}-${index}`}
                    type="button"
                    onClick={() => removerTipoPenal(index)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600"
                    title="Remover tipo penal"
                  >
                    {tipo} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Você pode adicionar mais de um tipo penal.</p>
            )}
          </div>
        )}

        {clientes.length > 0 && (
          <ComboBox
            label="Cliente principal cadastrado"
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar cliente principal…"
            value={clienteId}
            onChange={handleClienteSelect}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome do cliente principal *"
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

        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Clientes / partes do processo</p>
            <p className="mt-0.5 text-xs text-gray-500">Use para litisconsórcio. O primeiro nome fica como cliente principal.</p>
          </div>
          {partes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {partes.map((parte, index) => (
                <button
                  key={`${parte.cliente_id || parte.nome}-${index}`}
                  type="button"
                  onClick={() => removerParte(index)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600"
                  title="Remover cliente do processo"
                >
                  {parte.nome}{index === 0 ? " · principal" : ""} ×
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nenhum litisconsorte adicionado ainda.</p>
          )}
          {clientes.length > 0 && (
            <ComboBox
              label="Adicionar cliente cadastrado"
              options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Escolha um cliente para adicionar ao processo"
              value=""
              onChange={(id) => {
                const c = clientes.find((cliente) => cliente.id === id);
                if (c) addParte({ cliente_id: c.id, nome: c.nome, cpf_cnpj: c.cpf, papel: partes.length === 0 ? "Cliente principal" : "Cliente" });
              }}
            />
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Input label="Adicionar novo cliente/parte" placeholder="Nome completo" value={parteManualNome} onChange={(e) => setParteManualNome(e.target.value)} />
            <Input label="CPF/CNPJ" placeholder="Opcional" value={parteManualCpf} onChange={(e) => setParteManualCpf(e.target.value)} />
            <Button type="button" variant="secondary" onClick={adicionarParteManual} disabled={!parteManualNome.trim()}>
              Adicionar
            </Button>
          </div>
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
