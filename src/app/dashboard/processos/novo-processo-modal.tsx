"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProcesso, updateProcesso, createCliente, getClientes } from "@/lib/store";
import type { Cliente } from "@/types";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

const tipoOptions = [
  { value: "civel", label: "Cível" },
  { value: "criminal", label: "Criminal" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "federal", label: "Federal" },
  { value: "outro", label: "Outro" },
];

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

  useEffect(() => {
    if (open) setClientes(getClientes());
  }, [open]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.numero || !form.titulo || !form.cliente_nome) return;
    setSaving(true);
    // Auto-cadastra o cliente se ainda não estiver registrado
    let resolvedClienteId = clienteId;
    if (!resolvedClienteId && form.cliente_nome.trim()) {
      const existente = clientes.find(
        (c) => c.nome.toLowerCase().trim() === form.cliente_nome.toLowerCase().trim()
      );
      if (existente) {
        resolvedClienteId = existente.id;
      } else {
        const novo = createCliente({
          nome: form.cliente_nome.trim(),
          cpf: form.cliente_cpf_cnpj || undefined,
        });
        resolvedClienteId = novo.id;
      }
    }

    const novoProcesso = createProcesso({
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
    setSaving(false);
    onCreated();
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
          <Select
            label="Tipo"
            options={tipoOptions}
            placeholder="Selecione..."
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
          />
        </div>

        <Input
          label="Título / Assunto *"
          placeholder="Descreva brevemente o processo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          required
        />

        {clientes.length > 0 && (
          <Select
            label="Cliente cadastrado"
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecionar da lista de clientes…"
            value={clienteId}
            onChange={(e) => handleClienteSelect(e.target.value)}
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar Processo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
