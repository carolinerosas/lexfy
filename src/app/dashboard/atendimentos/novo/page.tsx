"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combobox";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { createAtendimento, getProcessos, getClientes } from "@/lib/store";
import type { Cliente, Processo } from "@/types";

const tipoOptions = [
  { value: "consulta_inicial", label: "Consulta Inicial" },
  { value: "retorno", label: "Retorno" },
  { value: "orientacao", label: "Orientação Jurídica" },
  { value: "audiencia_prep", label: "Preparação para Audiência" },
  { value: "outro", label: "Outro" },
];

const statusOptions = [
  { value: "realizado", label: "Realizado" },
  { value: "agendado", label: "Agendado" },
];

function numeroKey(numero?: string): string {
  return (numero ?? "").replace(/\D/g, "");
}

function numeroProcessoLabel(processo: Processo): string {
  return processo.numero?.trim() || processo.numero_inquerito?.trim() || "";
}

function findProcessoByNumero(processos: Processo[], numero: string): Processo | undefined {
  const texto = numero.trim().toLocaleLowerCase("pt-BR");
  const digits = numeroKey(numero);
  if (!texto && !digits) return undefined;

  return processos.find((p) => {
    const numeros = [p.numero, p.numero_inquerito].filter(Boolean) as string[];
    return numeros.some((n) => {
      const nTexto = n.trim().toLocaleLowerCase("pt-BR");
      const nDigits = numeroKey(n);
      return (digits && nDigits === digits) || (!!texto && nTexto === texto);
    });
  });
}

function agoraLocalISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NovoAtendimentoPage() {
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: "",
    processo_id: "",
    processo_numero: "",
    data_hora: agoraLocalISO(),
    tipo: "",
    duracao_min: "",
    status: "realizado",
    notas: "",
    valor_cobrado: "",
  });

  useEffect(() => {
    getProcessos().then(setProcessos);
    getClientes().then(setClientes);
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleClienteSelect(id: string) {
    setClienteId(id);
    if (!id) return;
    const c = clientes.find((cl) => cl.id === id);
    if (c) set("cliente_nome", c.nome);
  }

  function handleProcessoChange(processoId: string) {
    const proc = processos.find((p) => p.id === processoId);
    setForm((f) => ({
      ...f,
      processo_id: processoId,
      processo_numero: proc ? numeroProcessoLabel(proc) : f.processo_numero,
      cliente_nome: proc && !f.cliente_nome ? proc.cliente_nome : f.cliente_nome,
    }));
    if (proc?.cliente_id) setClienteId(proc.cliente_id);
  }

  function handleProcessoNumeroChange(value: string) {
    const proc = findProcessoByNumero(processos, value);
    setForm((f) => ({
      ...f,
      processo_numero: value,
      processo_id: proc ? proc.id : value.trim() ? "" : f.processo_id,
      cliente_nome: proc && !f.cliente_nome ? proc.cliente_nome : f.cliente_nome,
    }));
    if (proc?.cliente_id) setClienteId(proc.cliente_id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_nome || !form.data_hora) return;
    setSaving(true);
    try {
      const processoPorNumero = form.processo_numero ? findProcessoByNumero(processos, form.processo_numero) : undefined;
      const notaNumeroProcesso = form.processo_numero && !processoPorNumero
        ? `Número do processo informado no atendimento: ${form.processo_numero.trim()}`
        : "";
      await createAtendimento({
        cliente_id: clienteId || undefined,
        cliente_nome: form.cliente_nome,
        processo_id: form.processo_id || processoPorNumero?.id || undefined,
        data_hora: form.data_hora,
        tipo: (form.tipo as Parameters<typeof createAtendimento>[0]["tipo"]) || undefined,
        duracao_min: form.duracao_min ? parseInt(form.duracao_min) : undefined,
        status: form.status as "agendado" | "realizado" | "cancelado",
        notas: [notaNumeroProcesso, form.notas].filter(Boolean).join("\n\n") || undefined,
        valor_cobrado: form.valor_cobrado ? parseFloat(form.valor_cobrado) : undefined,
      });
      router.push("/dashboard/atendimentos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/atendimentos">
          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Iniciar Atendimento</h1>
          <p className="text-gray-400 text-sm mt-0.5">Registre o atendimento com anotações completas</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardContent className="py-6 space-y-4">
            {clientes.length > 0 && (
              <ComboBox
                label="Cliente cadastrado"
                options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                placeholder="Selecionar da lista de clientes…"
                value={clienteId}
                onChange={handleClienteSelect}
              />
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nome do Cliente *"
                placeholder="Nome completo"
                value={form.cliente_nome}
                onChange={(e) => set("cliente_nome", e.target.value)}
                required
              />
              <ComboBox
                label="Processo (opcional)"
                options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))}
                placeholder="Selecione se vinculado a processo..."
                value={form.processo_id}
                onChange={handleProcessoChange}
              />
            </div>
            <Input
              label="Número do processo relacionado (opcional)"
              placeholder="Digite o número para vincular automaticamente"
              value={form.processo_numero}
              onChange={(e) => handleProcessoNumeroChange(e.target.value)}
              hint={
                form.processo_numero && findProcessoByNumero(processos, form.processo_numero)
                  ? "Processo encontrado. O atendimento será vinculado a ele."
                  : "Se o processo já estiver cadastrado, ele aparecerá também na aba Atendimentos do processo."
              }
            />
            <div className="grid gap-4 md:grid-cols-4">
              <Select label="Tipo" options={tipoOptions} placeholder="Tipo..." value={form.tipo} onChange={(e) => set("tipo", e.target.value)} />
              <Input label="Data e Hora *" type="datetime-local" value={form.data_hora} onChange={(e) => set("data_hora", e.target.value)} required />
              <Input label="Duração (min)" type="number" min="15" step="15" placeholder="60" value={form.duracao_min} onChange={(e) => set("duracao_min", e.target.value)} />
              <Select label="Situação" options={statusOptions} value={form.status} onChange={(e) => set("status", e.target.value)} />
            </div>
            <Input label="Valor Cobrado (R$)" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_cobrado} onChange={(e) => set("valor_cobrado", e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <VoiceTextarea
              id="notas-atendimento"
              label="Anotações do atendimento"
              description="Tudo que foi tratado, orientações dadas, próximos passos, documentos pendentes…"
              value={form.notas}
              onChange={(value) => set("notas", value)}
              placeholder="Escreva aqui as anotações completas do atendimento..."
              className="w-full min-h-[320px] rounded-lg border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-colors resize-y"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard/atendimentos">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={saving || !form.cliente_nome || !form.data_hora}>
            {saving ? "Salvando..." : "Salvar atendimento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
