import { supabase } from "./supabase";
import type {
  Cliente,
  Processo,
  Prazo,
  Audiencia,
  Movimentacao,
  Honorario,
  ContaEscritorio,
  Atendimento,
  Publicacao,
  Anotacao,
  Tarefa,
  IncidenteExecucao,
  CalculoPena,
  BeneficioPenal,
  TriagemLead,
  TriagemImportacao,
} from "@/types";

const USER_ID = "lexfy_shared";

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

const PARTICULAS_NOME = new Set(["de", "da", "do", "das", "dos", "e"]);

function formatarNomeCliente(nome: string): string {
  return nome
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, index) => {
      if (index > 0 && PARTICULAS_NOME.has(palavra)) return palavra;
      return palavra
        .split("-")
        .map((parte) => {
          if (!parte) return parte;
          if (index > 0 && PARTICULAS_NOME.has(parte)) return parte;
          return parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1);
        })
        .join("-");
    })
    .join(" ");
}

function normalizarNomeCliente<T extends { nome?: string; cliente_nome?: string }>(input: T): T {
  const normalizado = { ...input };
  if (typeof normalizado.nome === "string") {
    normalizado.nome = formatarNomeCliente(normalizado.nome);
  }
  if (typeof normalizado.cliente_nome === "string") {
    normalizado.cliente_nome = formatarNomeCliente(normalizado.cliente_nome);
  }
  return normalizado;
}

type LocalTable = "anotacoes" | "tarefas" | "contas_escritorio" | "incidentes_execucao" | "calculos_pena" | "beneficios_penais";

function isMissingTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["PGRST205", "42P01"].includes((error as { code?: string }).code ?? "")
  );
}

function localKey(table: LocalTable): string {
  return `justio_${table}`;
}

function getLocalRows<T>(table: LocalTable): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(localKey(table)) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function setLocalRows<T>(table: LocalTable, rows: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localKey(table), JSON.stringify(rows));
}

function localInsert<T extends { id: string }>(table: LocalTable, row: T): T {
  const rows = getLocalRows<T>(table);
  setLocalRows(table, [row, ...rows]);
  return row;
}

function localUpdate<T extends { id: string; updated_at?: string }>(table: LocalTable, id: string, input: Partial<T>): void {
  const rows = getLocalRows<T>(table).map((row) => (
    row.id === id ? { ...row, ...input, updated_at: now() } : row
  ));
  setLocalRows(table, rows);
}

function localDelete(table: LocalTable, id: string): void {
  setLocalRows(table, getLocalRows<{ id: string }>(table).filter((row) => row.id !== id));
}

function localDeleteByProcesso(table: LocalTable, processoId: string): void {
  setLocalRows(table, getLocalRows<{ processo_id: string }>(table).filter((row) => row.processo_id !== processoId));
}

// --- Processos ---

export async function getProcessos(): Promise<Processo[]> {
  const { data } = await supabase
    .from("processos")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Processo[];
}

export async function getProcesso(id: string): Promise<Processo | undefined> {
  const { data } = await supabase
    .from("processos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Processo | undefined;
}

export async function createProcesso(
  input: Omit<Processo, "id" | "created_at" | "updated_at" | "user_id">
): Promise<Processo> {
  const novo = { ...normalizarNomeCliente(input), id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("processos").insert(novo).select().single();
  if (error) throw new Error(error.message);
  return data as Processo;
}

export async function updateProcesso(id: string, input: Partial<Processo>): Promise<void> {
  const { error } = await supabase.from("processos").update({ ...normalizarNomeCliente(input), updated_at: now() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProcesso(id: string): Promise<void> {
  await Promise.all([
    supabase.from("prazos").delete().eq("processo_id", id),
    supabase.from("audiencias").delete().eq("processo_id", id),
    supabase.from("movimentacoes").delete().eq("processo_id", id),
    supabase.from("honorarios").delete().eq("processo_id", id),
    supabase.from("atendimentos").delete().eq("processo_id", id),
    supabase.from("anotacoes").delete().eq("processo_id", id),
    supabase.from("tarefas").delete().eq("processo_id", id),
    supabase.from("incidentes_execucao").delete().eq("processo_id", id),
    supabase.from("calculos_pena").delete().eq("processo_id", id),
    supabase.from("beneficios_penais").delete().eq("processo_id", id),
  ]);
  localDeleteByProcesso("anotacoes", id);
  localDeleteByProcesso("tarefas", id);
  localDeleteByProcesso("incidentes_execucao", id);
  localDeleteByProcesso("calculos_pena", id);
  localDeleteByProcesso("beneficios_penais", id);
  await supabase.from("processos").delete().eq("id", id);
}

// --- Prazos ---

export async function getPrazos(): Promise<Prazo[]> {
  const { data } = await supabase.from("prazos").select("*");
  return (data ?? []) as Prazo[];
}

export async function getPrazosWithProcesso(): Promise<(Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]> {
  const [prazos, processos] = await Promise.all([getPrazos(), getProcessos()]);
  return prazos.map((p) => {
    const proc = processos.find((pr) => pr.id === p.processo_id);
    return { ...p, processo: proc ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome } : undefined };
  });
}

export async function createPrazo(
  input: Omit<Prazo, "id" | "created_at" | "user_id">
): Promise<Prazo> {
  const novo = { ...input, id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("prazos").insert(novo).select().single();
  return data as Prazo;
}

export async function updatePrazo(id: string, input: Partial<Prazo>): Promise<void> {
  await supabase.from("prazos").update(input).eq("id", id);
}

export async function deletePrazo(id: string): Promise<void> {
  await supabase.from("prazos").delete().eq("id", id);
}

// --- Audiências ---

export async function getAudiencias(): Promise<Audiencia[]> {
  const { data } = await supabase.from("audiencias").select("*");
  return (data ?? []) as Audiencia[];
}

export async function getAudienciasWithProcesso(): Promise<(Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]> {
  const [audiencias, processos] = await Promise.all([getAudiencias(), getProcessos()]);
  return audiencias.map((a) => {
    const proc = processos.find((pr) => pr.id === a.processo_id);
    return { ...a, processo: proc ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome } : undefined };
  });
}

export async function createAudiencia(
  input: Omit<Audiencia, "id" | "created_at" | "user_id">
): Promise<Audiencia> {
  const nova = { ...input, id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("audiencias").insert(nova).select().single();
  return data as Audiencia;
}

export async function updateAudiencia(id: string, input: Partial<Audiencia>): Promise<void> {
  await supabase.from("audiencias").update(input).eq("id", id);
}

export async function deleteAudiencia(id: string): Promise<void> {
  await supabase.from("audiencias").delete().eq("id", id);
}

// --- Movimentações ---

export async function getMovimentacoes(): Promise<Movimentacao[]> {
  const { data } = await supabase.from("movimentacoes").select("*");
  return (data ?? []) as Movimentacao[];
}

export async function getMovimentacoesByProcesso(processoId: string): Promise<Movimentacao[]> {
  const { data } = await supabase
    .from("movimentacoes")
    .select("*")
    .eq("processo_id", processoId)
    .order("data_movimentacao", { ascending: false });
  return (data ?? []) as Movimentacao[];
}

export async function createMovimentacao(
  input: Omit<Movimentacao, "id" | "created_at" | "user_id">
): Promise<Movimentacao> {
  const nova = { ...input, id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("movimentacoes").insert(nova).select().single();
  return data as Movimentacao;
}

export async function updateMovimentacao(id: string, input: Partial<Movimentacao>): Promise<void> {
  const { error } = await supabase.from("movimentacoes").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function marcarMovimentacaoLida(id: string): Promise<void> {
  await supabase.from("movimentacoes").update({ lida: true }).eq("id", id);
}

export async function marcarTodasMovimentacoesLidas(processoId: string): Promise<void> {
  await supabase.from("movimentacoes").update({ lida: true }).eq("processo_id", processoId);
}

export async function getMovimentacoesNaoLidas(): Promise<number> {
  const { count } = await supabase
    .from("movimentacoes")
    .select("*", { count: "exact", head: true })
    .eq("lida", false);
  return count ?? 0;
}

export async function deleteMovimentacao(id: string): Promise<void> {
  await supabase.from("movimentacoes").delete().eq("id", id);
}

export async function deleteMovimentacoesByProcesso(processoId: string): Promise<void> {
  await supabase.from("movimentacoes").delete().eq("processo_id", processoId);
}

// --- Honorários ---

export async function getHonorarios(): Promise<Honorario[]> {
  const { data } = await supabase.from("honorarios").select("*");
  return ((data ?? []) as Honorario[]).map((h) => ({ ...h, categoria: h.categoria ?? "pagamento" }));
}

export async function getHonorariosWithProcesso(): Promise<(Honorario & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]> {
  const [honorarios, processos] = await Promise.all([getHonorarios(), getProcessos()]);
  return honorarios.map((h) => {
    const proc = processos.find((pr) => pr.id === h.processo_id);
    return { ...h, processo: proc ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome } : undefined };
  });
}

export async function createHonorario(
  input: Omit<Honorario, "id" | "created_at" | "user_id">
): Promise<Honorario> {
  const novo = { ...input, id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("honorarios").insert(novo).select().single();
  return data as Honorario;
}

export async function updateHonorario(id: string, input: Partial<Honorario>): Promise<void> {
  await supabase.from("honorarios").update(input).eq("id", id);
}

export async function deleteHonorario(id: string): Promise<void> {
  await supabase.from("honorarios").delete().eq("id", id);
}

// --- Contas do escritorio ---

export async function getContasEscritorio(): Promise<ContaEscritorio[]> {
  const { data, error } = await supabase
    .from("contas_escritorio")
    .select("*")
    .order("data_vencimento", { ascending: true });

  if (error) {
    if (isMissingTable(error)) return getLocalRows<ContaEscritorio>("contas_escritorio");
    throw new Error(error.message);
  }

  return (data ?? []) as ContaEscritorio[];
}

export async function createContaEscritorio(
  input: Omit<ContaEscritorio, "id" | "created_at" | "updated_at" | "user_id">
): Promise<ContaEscritorio> {
  const nova = {
    ...input,
    id: generateId(),
    created_at: now(),
    updated_at: now(),
    user_id: USER_ID,
  };
  const { data, error } = await supabase.from("contas_escritorio").insert(nova).select().single();

  if (error) {
    if (isMissingTable(error)) return localInsert("contas_escritorio", nova);
    throw new Error(error.message);
  }

  return data as ContaEscritorio;
}

export async function updateContaEscritorio(id: string, input: Partial<ContaEscritorio>): Promise<void> {
  const { error } = await supabase
    .from("contas_escritorio")
    .update({ ...input, updated_at: now() })
    .eq("id", id);

  if (error) {
    if (isMissingTable(error)) {
      localUpdate("contas_escritorio", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteContaEscritorio(id: string): Promise<void> {
  const { error } = await supabase.from("contas_escritorio").delete().eq("id", id);

  if (error) {
    if (isMissingTable(error)) {
      localDelete("contas_escritorio", id);
      return;
    }
    throw new Error(error.message);
  }
}

// --- Publicações ---

export async function getPublicacoes(): Promise<Publicacao[]> {
  const { data } = await supabase
    .from("publicacoes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Publicacao[];
}

export async function createPublicacao(
  input: Omit<Publicacao, "id" | "created_at" | "user_id">
): Promise<Publicacao> {
  const nova = { ...input, id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("publicacoes").insert(nova).select().single();
  return data as Publicacao;
}

export async function marcarPublicacaoLida(id: string): Promise<void> {
  await supabase.from("publicacoes").update({ lida: true }).eq("id", id);
}

export async function updatePublicacao(id: string, input: Partial<Publicacao>): Promise<void> {
  await supabase.from("publicacoes").update(input).eq("id", id);
}

export async function vincularPublicacoesAoProcesso(processoId: string, numeroCNJ: string): Promise<void> {
  const digits = numeroCNJ.replace(/\D/g, "");
  const todas = await getPublicacoes();
  const alvo = todas.filter((p) => {
    if (p.processo_id) return false;
    const texto = `${p.titulo ?? ""} ${p.conteudo ?? ""}`.replace(/\D/g, "");
    return texto.includes(digits);
  });
  await Promise.all(alvo.map((p) => updatePublicacao(p.id, { processo_id: processoId })));
}

// --- Triagem (leads / atendimento automático) ---

export async function getTriagemLeads(): Promise<TriagemLead[]> {
  const { data } = await supabase
    .from("triagem_leads")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as TriagemLead[];
}

export async function getTriagemNovosCount(): Promise<number> {
  const [{ count: leadsCount, error: leadsError }, { count: importacoesCount, error: importacoesError }] = await Promise.all([
    supabase
    .from("triagem_leads")
    .select("*", { count: "exact", head: true })
      .eq("status", "novo"),
    supabase
      .from("triagem_importacoes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente"),
  ]);

  return (leadsError ? 0 : leadsCount ?? 0) + (importacoesError ? 0 : importacoesCount ?? 0);
}

export async function createTriagemLead(
  input: Omit<TriagemLead, "id" | "created_at" | "user_id" | "status"> & { status?: TriagemLead["status"] }
): Promise<TriagemLead> {
  const novo = {
    ...input,
    status: input.status ?? "novo",
    id: generateId(),
    created_at: now(),
    user_id: USER_ID,
  };
  const { data, error } = await supabase.from("triagem_leads").insert(novo).select().single();
  if (error) throw new Error(error.message);
  return data as TriagemLead;
}

export async function updateTriagemLead(id: string, input: Partial<TriagemLead>): Promise<void> {
  await supabase.from("triagem_leads").update(input).eq("id", id);
}

export async function deleteTriagemLead(id: string): Promise<void> {
  await supabase.from("triagem_leads").delete().eq("id", id);
}

export async function getTriagemImportacoes(): Promise<TriagemImportacao[]> {
  const { data, error } = await supabase
    .from("triagem_importacoes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as TriagemImportacao[];
}

export async function createTriagemImportacao(
  input: Omit<TriagemImportacao, "id" | "created_at" | "updated_at" | "user_id" | "status"> & { status?: TriagemImportacao["status"] }
): Promise<TriagemImportacao> {
  const nova = {
    ...input,
    status: input.status ?? "pendente",
    id: generateId(),
    created_at: now(),
    updated_at: now(),
    user_id: USER_ID,
  };
  const { data, error } = await supabase.from("triagem_importacoes").insert(nova).select().single();
  if (error) throw new Error(error.message);
  return data as TriagemImportacao;
}

export async function updateTriagemImportacao(id: string, input: Partial<TriagemImportacao>): Promise<void> {
  const { error } = await supabase
    .from("triagem_importacoes")
    .update({ ...input, updated_at: now() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTriagemImportacao(id: string): Promise<void> {
  const { error } = await supabase.from("triagem_importacoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Atendimentos ---

export async function getAtendimentos(): Promise<Atendimento[]> {
  const { data } = await supabase.from("atendimentos").select("*");
  return (data ?? []) as Atendimento[];
}

export async function getAtendimentosWithProcesso(): Promise<Atendimento[]> {
  const [atendimentos, processos] = await Promise.all([getAtendimentos(), getProcessos()]);
  return atendimentos.map((a) => {
    const proc = processos.find((p) => p.id === a.processo_id);
    return { ...a, processo: proc ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome } : undefined };
  });
}

export async function getAtendimentosByProcesso(processoId: string): Promise<Atendimento[]> {
  const { data } = await supabase
    .from("atendimentos")
    .select("*")
    .eq("processo_id", processoId)
    .order("data_hora", { ascending: false });
  return (data ?? []) as Atendimento[];
}

export async function createAtendimento(
  input: Omit<Atendimento, "id" | "created_at" | "user_id" | "processo">
): Promise<Atendimento> {
  const novo = { ...normalizarNomeCliente(input), id: generateId(), created_at: now(), user_id: USER_ID };
  const { data } = await supabase.from("atendimentos").insert(novo).select().single();
  return data as Atendimento;
}

export async function updateAtendimento(id: string, input: Partial<Atendimento>): Promise<void> {
  await supabase.from("atendimentos").update(normalizarNomeCliente(input)).eq("id", id);
}

export async function deleteAtendimento(id: string): Promise<void> {
  await supabase.from("atendimentos").delete().eq("id", id);
}

// --- Anotações ---

export async function getAnotacoesByProcesso(processoId: string): Promise<Anotacao[]> {
  const { data, error } = await supabase
    .from("anotacoes")
    .select("*")
    .eq("processo_id", processoId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return getLocalRows<Anotacao>("anotacoes")
        .filter((a) => a.processo_id === processoId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    throw new Error(error.message);
  }
  return (data ?? []) as Anotacao[];
}

export async function createAnotacao(
  input: Omit<Anotacao, "id" | "created_at" | "updated_at" | "user_id">
): Promise<Anotacao> {
  const nova = { ...input, id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("anotacoes").insert(nova).select().single();
  if (error) {
    if (isMissingTable(error)) return localInsert("anotacoes", nova);
    throw new Error(error.message);
  }
  return data as Anotacao;
}

export async function updateAnotacao(id: string, input: Partial<Anotacao>): Promise<void> {
  const { error } = await supabase.from("anotacoes").update({ ...input, updated_at: now() }).eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localUpdate<Anotacao>("anotacoes", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteAnotacao(id: string): Promise<void> {
  const { error } = await supabase.from("anotacoes").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localDelete("anotacoes", id);
      return;
    }
    throw new Error(error.message);
  }
}

// --- Tarefas ---

function sortTarefas(a: Tarefa, b: Tarefa): number {
  return Number(a.concluida) - Number(b.concluida)
    || (a.data_limite ?? "9999-12-31").localeCompare(b.data_limite ?? "9999-12-31")
    || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export async function getTarefas(): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("tarefas")
    .select("*")
    .order("concluida", { ascending: true })
    .order("data_limite", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) return getLocalRows<Tarefa>("tarefas").sort(sortTarefas);
    throw new Error(error.message);
  }
  return ((data ?? []) as Tarefa[]).sort(sortTarefas);
}

export async function getTarefasWithProcesso(): Promise<(Tarefa & { processo?: Pick<Processo, "id" | "numero" | "titulo" | "cliente_nome"> })[]> {
  const [tarefas, processos] = await Promise.all([getTarefas(), getProcessos()]);
  const processosById = new Map(processos.map((p) => [p.id, p]));

  return tarefas.map((tarefa) => {
    const processo = processosById.get(tarefa.processo_id);
    return {
      ...tarefa,
      processo: processo ? {
        id: processo.id,
        numero: processo.numero,
        titulo: processo.titulo,
        cliente_nome: processo.cliente_nome,
      } : undefined,
    };
  });
}

export async function getTarefasByProcesso(processoId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from("tarefas")
    .select("*")
    .eq("processo_id", processoId)
    .order("data_limite", { ascending: true, nullsFirst: false });

  if (error) {
    if (isMissingTable(error)) {
      return getLocalRows<Tarefa>("tarefas")
        .filter((t) => t.processo_id === processoId)
        .sort((a, b) => Number(a.concluida) - Number(b.concluida) || (a.data_limite ?? "").localeCompare(b.data_limite ?? ""));
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Tarefa[]).sort(sortTarefas);
}

export async function createTarefa(
  input: Omit<Tarefa, "id" | "created_at" | "updated_at" | "user_id">
): Promise<Tarefa> {
  const nova = { ...input, id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("tarefas").insert(nova).select().single();
  if (error) {
    if (isMissingTable(error)) return localInsert("tarefas", nova);
    throw new Error(error.message);
  }
  return data as Tarefa;
}

export async function updateTarefa(id: string, input: Partial<Tarefa>): Promise<void> {
  const { error } = await supabase.from("tarefas").update({ ...input, updated_at: now() }).eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localUpdate<Tarefa>("tarefas", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteTarefa(id: string): Promise<void> {
  const { error } = await supabase.from("tarefas").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localDelete("tarefas", id);
      return;
    }
    throw new Error(error.message);
  }
}

// --- Execução penal: incidentes, cálculo de pena e benefícios ---

export async function getIncidentesByProcesso(processoId: string): Promise<IncidenteExecucao[]> {
  const { data, error } = await supabase
    .from("incidentes_execucao")
    .select("*")
    .eq("processo_id", processoId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return getLocalRows<IncidenteExecucao>("incidentes_execucao")
        .filter((i) => i.processo_id === processoId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    throw new Error(error.message);
  }

  return (data ?? []) as IncidenteExecucao[];
}

export async function createIncidente(
  input: Omit<IncidenteExecucao, "id" | "created_at" | "updated_at" | "user_id">
): Promise<IncidenteExecucao> {
  const novo = { ...input, id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("incidentes_execucao").insert(novo).select().single();
  if (error) {
    if (isMissingTable(error)) return localInsert("incidentes_execucao", novo);
    throw new Error(error.message);
  }
  return data as IncidenteExecucao;
}

export async function updateIncidente(id: string, input: Partial<IncidenteExecucao>): Promise<void> {
  const { error } = await supabase.from("incidentes_execucao").update({ ...input, updated_at: now() }).eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localUpdate<IncidenteExecucao>("incidentes_execucao", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteIncidente(id: string): Promise<void> {
  const { error } = await supabase.from("incidentes_execucao").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localDelete("incidentes_execucao", id);
      return;
    }
    throw new Error(error.message);
  }
}

export async function getCalculosPenaByProcesso(processoId: string): Promise<CalculoPena[]> {
  const { data, error } = await supabase
    .from("calculos_pena")
    .select("*")
    .eq("processo_id", processoId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return getLocalRows<CalculoPena>("calculos_pena")
        .filter((c) => c.processo_id === processoId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    throw new Error(error.message);
  }

  return (data ?? []) as CalculoPena[];
}

export async function createCalculoPena(
  input: Omit<CalculoPena, "id" | "created_at" | "updated_at" | "user_id">
): Promise<CalculoPena> {
  const novo = { ...input, id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("calculos_pena").insert(novo).select().single();
  if (error) {
    if (isMissingTable(error)) return localInsert("calculos_pena", novo);
    throw new Error(error.message);
  }
  return data as CalculoPena;
}

export async function updateCalculoPena(id: string, input: Partial<CalculoPena>): Promise<void> {
  const { error } = await supabase.from("calculos_pena").update({ ...input, updated_at: now() }).eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localUpdate<CalculoPena>("calculos_pena", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteCalculoPena(id: string): Promise<void> {
  const { error } = await supabase.from("calculos_pena").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localDelete("calculos_pena", id);
      return;
    }
    throw new Error(error.message);
  }
}

export async function getBeneficiosPenaisByProcesso(processoId: string): Promise<BeneficioPenal[]> {
  const { data, error } = await supabase
    .from("beneficios_penais")
    .select("*")
    .eq("processo_id", processoId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return getLocalRows<BeneficioPenal>("beneficios_penais")
        .filter((b) => b.processo_id === processoId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    throw new Error(error.message);
  }

  return (data ?? []) as BeneficioPenal[];
}

export async function createBeneficioPenal(
  input: Omit<BeneficioPenal, "id" | "created_at" | "updated_at" | "user_id">
): Promise<BeneficioPenal> {
  const novo = { ...input, id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("beneficios_penais").insert(novo).select().single();
  if (error) {
    if (isMissingTable(error)) return localInsert("beneficios_penais", novo);
    throw new Error(error.message);
  }
  return data as BeneficioPenal;
}

export async function updateBeneficioPenal(id: string, input: Partial<BeneficioPenal>): Promise<void> {
  const { error } = await supabase.from("beneficios_penais").update({ ...input, updated_at: now() }).eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localUpdate<BeneficioPenal>("beneficios_penais", id, input);
      return;
    }
    throw new Error(error.message);
  }
}

export async function deleteBeneficioPenal(id: string): Promise<void> {
  const { error } = await supabase.from("beneficios_penais").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) {
      localDelete("beneficios_penais", id);
      return;
    }
    throw new Error(error.message);
  }
}

// --- Clientes ---

export async function getClientes(): Promise<Cliente[]> {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .order("nome", { ascending: true });
  return (data ?? []) as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente | undefined> {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Cliente | undefined;
}

export async function createCliente(
  input: Omit<Cliente, "id" | "created_at" | "updated_at" | "user_id">
): Promise<Cliente> {
  const novo = { ...normalizarNomeCliente(input), id: generateId(), created_at: now(), updated_at: now(), user_id: USER_ID };
  const { data, error } = await supabase.from("clientes").insert(novo).select().single();
  if (error) throw new Error(error.message);
  return data as Cliente;
}

export async function updateCliente(id: string, input: Partial<Cliente>): Promise<void> {
  await supabase.from("clientes").update({ ...normalizarNomeCliente(input), updated_at: now() }).eq("id", id);
}

export async function deleteCliente(id: string): Promise<void> {
  const { error: unlinkError } = await supabase
    .from("processos")
    .update({ cliente_id: null })
    .eq("cliente_id", id);
  if (unlinkError) throw new Error(unlinkError.message);

  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Conta o que está vinculado a um nome de cliente não cadastrado
export async function contarVinculosClienteNome(nome: string): Promise<{ processos: number; atendimentos: number }> {
  const [processos, atendimentos] = await Promise.all([getProcessos(), getAtendimentos()]);
  return {
    processos: processos.filter((p) => p.cliente_nome === nome && !p.cliente_id).length,
    atendimentos: atendimentos.filter((a) => a.cliente_nome === nome && !a.cliente_id).length,
  };
}

// Remove um "cliente não cadastrado": apaga os processos e atendimentos que carregam aquele nome
export async function excluirClienteNaoCadastrado(nome: string): Promise<void> {
  const [processos, atendimentos] = await Promise.all([getProcessos(), getAtendimentos()]);
  const procs = processos.filter((p) => p.cliente_nome === nome && !p.cliente_id);
  for (const p of procs) await deleteProcesso(p.id);
  const atends = atendimentos.filter((a) => a.cliente_nome === nome && !a.cliente_id);
  await Promise.all(atends.map((a) => deleteAtendimento(a.id)));
}

export async function importarClientesExistentes(): Promise<number> {
  const [processos, clientesExistentes] = await Promise.all([getProcessos(), getClientes()]);
  let count = 0;

  for (const cliente of clientesExistentes) {
    const semLink = processos.filter((p) => p.cliente_nome === cliente.nome && !p.cliente_id);
    for (const p of semLink) await updateProcesso(p.id, { cliente_id: cliente.id });
    if (semLink.length > 0) count++;
  }

  const nomesRegistrados = new Set(clientesExistentes.map((c) => c.nome.toLowerCase().trim()));
  const novosNomes = new Map<string, string | undefined>();
  processos.forEach((p) => {
    const key = p.cliente_nome?.trim();
    if (key && !nomesRegistrados.has(key.toLowerCase())) {
      novosNomes.set(key, p.cliente_cpf_cnpj);
    }
  });

  for (const [nome, cpf] of novosNomes.entries()) {
    const novo = await createCliente({ nome, cpf: cpf || undefined });
    const sem = processos.filter((p) => p.cliente_nome === nome && !p.cliente_id);
    for (const p of sem) await updateProcesso(p.id, { cliente_id: novo.id });
    count++;
  }

  return count;
}

// --- Clientes Summary ---

export interface ClienteSummary {
  nome: string;
  totalProcessos: number;
  processosAtivos: number;
  totalCobrado: number;
  totalPago: number;
  saldo: number;
  ultimoContato?: string;
}

export async function getClientesSummary(): Promise<(ClienteSummary & { id?: string; cadastrado: boolean })[]> {
  const [clientes, processos, honorarios, atendimentos] = await Promise.all([
    getClientes(),
    getProcessos(),
    getHonorarios(),
    getAtendimentos(),
  ]);

  function buildSummary(id: string | undefined, nome: string, cadastrado: boolean) {
    const procs = processos.filter((p) =>
      id ? (p.cliente_id === id || p.cliente_nome === nome) : p.cliente_nome === nome
    );
    const procIds = new Set(procs.map((p) => p.id));
    const hons = honorarios.filter((h) => procIds.has(h.processo_id));
    const atens = atendimentos.filter((a) =>
      id ? (a.cliente_id === id || a.cliente_nome === nome) : a.cliente_nome === nome
    );
    const totalCobrado = hons.filter((h) => h.categoria === "cobranca").reduce((s, h) => s + h.valor, 0);
    const totalPago = hons.filter((h) => h.categoria === "pagamento").reduce((s, h) => s + h.valor, 0);
    const datas = [...procs.map((p) => p.updated_at), ...atens.map((a) => a.data_hora)].filter(Boolean).sort().reverse();
    return {
      id,
      nome,
      cadastrado,
      totalProcessos: procs.length,
      processosAtivos: procs.filter((p) => p.status === "ativo").length,
      totalCobrado,
      totalPago,
      saldo: Math.max(0, totalCobrado - totalPago),
      ultimoContato: datas[0],
    };
  }

  const registeredNomes = new Set(clientes.map((c) => c.nome));
  const registered = clientes.map((c) => buildSummary(c.id, c.nome, true));

  const nomesSet = new Set<string>();
  processos.forEach((p) => { if (p.cliente_nome && !registeredNomes.has(p.cliente_nome)) nomesSet.add(p.cliente_nome); });
  atendimentos.forEach((a) => { if (a.cliente_nome && !registeredNomes.has(a.cliente_nome)) nomesSet.add(a.cliente_nome); });
  const unregistered = Array.from(nomesSet).filter(Boolean).map((nome) => buildSummary(undefined, nome, false));

  return [...registered, ...unregistered].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function getProcessosByCliente(idOrNome: string): Promise<Processo[]> {
  const { data } = await supabase
    .from("processos")
    .select("*")
    .or(`cliente_id.eq.${idOrNome},cliente_nome.eq.${idOrNome}`)
    .order("updated_at", { ascending: false });
  return (data ?? []) as Processo[];
}

export async function getPrazosByCliente(idOrNome: string): Promise<(Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]> {
  const procs = await getProcessosByCliente(idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  const todos = await getPrazosWithProcesso();
  return todos
    .filter((p) => procIds.has(p.processo_id))
    .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime());
}

export async function getAudienciasByCliente(idOrNome: string): Promise<(Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[]> {
  const procs = await getProcessosByCliente(idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  const todos = await getAudienciasWithProcesso();
  return todos
    .filter((a) => procIds.has(a.processo_id))
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
}

export async function getHonorariosByCliente(idOrNome: string): Promise<Honorario[]> {
  const procs = await getProcessosByCliente(idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  const todos = await getHonorarios();
  return todos
    .filter((h) => procIds.has(h.processo_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getAtendimentosByCliente(idOrNome: string): Promise<Atendimento[]> {
  const { data } = await supabase
    .from("atendimentos")
    .select("*")
    .or(`cliente_id.eq.${idOrNome},cliente_nome.eq.${idOrNome}`)
    .order("data_hora", { ascending: false });
  return (data ?? []) as Atendimento[];
}

// --- Dashboard Stats ---

export interface DashboardStats {
  totalProcessos: number;
  processosAtivos: number;
  prazosProximos: number;
  prazosVencidos: number;
  audienciasProximas: number;
  tarefasPendentes: number;
  tarefasProximas: number;
  tarefasVencidas: number;
  atendimentosProximos: number;
  honorariosPendentes: number;
  honorariosRecebidosMes: number;
  publicacoesNaoLidas: number;
  movimentacoesNaoLidas: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [processos, prazos, audiencias, tarefas, atendimentos, honorarios, publicacoes, movNaoLidas] = await Promise.all([
    getProcessos(),
    getPrazos(),
    getAudiencias(),
    getTarefas(),
    getAtendimentos(),
    getHonorarios(),
    getPublicacoes(),
    getMovimentacoesNaoLidas(),
  ]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em7dias = new Date(hoje);
  em7dias.setDate(em7dias.getDate() + 7);

  const prazosAtivos = prazos.filter((p) => !p.concluido);
  const prazosVencidos = prazosAtivos.filter((p) => new Date(p.data_prazo) < hoje).length;
  const prazosProximos = prazosAtivos.filter((p) => {
    const d = new Date(p.data_prazo);
    return d >= hoje && d <= em7dias;
  }).length;

  const audienciasProximas = audiencias.filter((a) => {
    if (a.realizada) return false;
    const d = new Date(a.data_hora);
    return d >= hoje && d <= em7dias;
  }).length;

  const tarefasAtivas = tarefas.filter((t) => !t.concluida);
  const tarefasVencidas = tarefasAtivas.filter((t) => t.data_limite && new Date(t.data_limite) < hoje).length;
  const tarefasProximas = tarefasAtivas.filter((t) => {
    if (!t.data_limite) return false;
    const d = new Date(t.data_limite);
    return d >= hoje && d <= em7dias;
  }).length;

  const atendimentosProximos = atendimentos.filter((a) => {
    if (a.status !== "agendado") return false;
    const d = new Date(a.data_hora);
    return d >= hoje && d <= em7dias;
  }).length;

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const honorariosRecebidosMes = honorarios
    .filter((h) => h.categoria === "pagamento" && h.data_recebimento && new Date(h.data_recebimento) >= inicioMes)
    .reduce((sum, h) => sum + h.valor, 0);

  const totalCobrado = honorarios.filter((h) => h.categoria === "cobranca").reduce((sum, h) => sum + h.valor, 0);
  const totalPago = honorarios.filter((h) => h.categoria === "pagamento").reduce((sum, h) => sum + h.valor, 0);

  return {
    totalProcessos: processos.length,
    processosAtivos: processos.filter((p) => p.status === "ativo").length,
    prazosProximos,
    prazosVencidos,
    audienciasProximas,
    tarefasPendentes: tarefasAtivas.length,
    tarefasProximas,
    tarefasVencidas,
    atendimentosProximos,
    honorariosPendentes: Math.max(0, totalCobrado - totalPago),
    honorariosRecebidosMes,
    publicacoesNaoLidas: publicacoes.filter((p) => !p.lida).length,
    movimentacoesNaoLidas: movNaoLidas,
  };
}

// --- DataJud sync ---

export interface SyncResult {
  novas: number;
  erro?: string;
}

export async function sincronizarProcesso(processoId: string): Promise<SyncResult> {
  const processo = await getProcesso(processoId);
  if (!processo) return { novas: 0, erro: "Processo não encontrado" };

  const { parseCNJ } = await import("./datajud");
  const parsed = parseCNJ(processo.numero);
  const tribunalInformado = (processo.tribunal ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const tribunal =
    tribunalInformado.includes("seeu") ? "seeu" :
    tribunalInformado.includes("esaj") || tribunalInformado.includes("tjsp") ? "tjsp" :
    tribunalInformado.includes("dcp") || tribunalInformado.includes("tjerj") ? "tjrj" :
    parsed.tribunal;
  if (!tribunal) return { novas: 0, erro: "Número CNJ inválido ou tribunal não reconhecido" };

  const { buscarMovimentosSistema } = await import("./sistemas");

  let movimentos: { data: string; descricao: string; fonte: string }[];
  try {
    movimentos = await buscarMovimentosSistema(tribunal, processo.numero);
  } catch (err) {
    return { novas: 0, erro: err instanceof Error ? err.message : "Erro desconhecido" };
  }

  const existentes = await getMovimentacoesByProcesso(processoId);
  const chaves = new Set(existentes.map((m) => `${m.data_movimentacao.slice(0, 10)}|${m.descricao}`));

  let novas = 0;
  for (const mov of movimentos) {
    let iso = mov.data;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(mov.data)) {
      const [d, m, y] = mov.data.slice(0, 10).split("/");
      iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`;
    }
    const chave = `${iso.slice(0, 10)}|${mov.descricao}`;
    if (chaves.has(chave)) continue;
    await createMovimentacao({
      processo_id: processoId,
      descricao: mov.descricao,
      data_movimentacao: iso,
      fonte: mov.fonte,
      lida: false,
    });
    chaves.add(chave);
    novas++;
  }

  await updateProcesso(processoId, { ultimo_sync: now() });
  return { novas };
}

export async function sincronizarTodos(): Promise<SyncResult> {
  const processos = await getProcessos();
  const ativos = processos.filter((p) => p.monitorar_datajud && p.status === "ativo");
  let totalNovas = 0;
  for (const p of ativos) {
    const r = await sincronizarProcesso(p.id);
    totalNovas += r.novas;
  }
  return { novas: totalNovas };
}
