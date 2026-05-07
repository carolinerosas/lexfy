"use client";

import type {
  Cliente,
  Processo,
  Prazo,
  Audiencia,
  Movimentacao,
  Honorario,
  Atendimento,
  Publicacao,
} from "@/types";

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// Generic local storage CRUD
function getAll<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function setAll<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

// --- Processos ---
const PROCESSOS_KEY = "jur_processos";

export function getProcessos(): Processo[] {
  return getAll<Processo>(PROCESSOS_KEY).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function getProcesso(id: string): Processo | undefined {
  return getAll<Processo>(PROCESSOS_KEY).find((p) => p.id === id);
}

export function createProcesso(
  data: Omit<Processo, "id" | "created_at" | "updated_at" | "user_id">
): Processo {
  const items = getAll<Processo>(PROCESSOS_KEY);
  const novo: Processo = {
    ...data,
    id: generateId(),
    created_at: now(),
    updated_at: now(),
    user_id: "local",
  };
  setAll(PROCESSOS_KEY, [...items, novo]);
  return novo;
}

export function updateProcesso(id: string, data: Partial<Processo>): void {
  const items = getAll<Processo>(PROCESSOS_KEY);
  setAll(
    PROCESSOS_KEY,
    items.map((p) =>
      p.id === id ? { ...p, ...data, updated_at: now() } : p
    )
  );
}

export function deleteProcesso(id: string): void {
  setAll(PROCESSOS_KEY, getAll<Processo>(PROCESSOS_KEY).filter((p) => p.id !== id));
  // cascade
  setPrazos(getPrazos().filter((p) => p.processo_id !== id));
  setAudiencias(getAudiencias().filter((a) => a.processo_id !== id));
  setMovimentacoes(getMovimentacoes().filter((m) => m.processo_id !== id));
  setHonorarios(getHonorarios().filter((h) => h.processo_id !== id));
  setAtendimentos(getAtendimentos().filter((a) => a.processo_id !== id));
}

// --- Prazos ---
const PRAZOS_KEY = "jur_prazos";

export function getPrazos(): Prazo[] {
  return getAll<Prazo>(PRAZOS_KEY);
}

function setPrazos(items: Prazo[]): void {
  setAll(PRAZOS_KEY, items);
}

export function getPrazosWithProcesso(): (Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[] {
  const processos = getAll<Processo>(PROCESSOS_KEY);
  return getPrazos().map((p) => {
    const proc = processos.find((pr) => pr.id === p.processo_id);
    return {
      ...p,
      processo: proc
        ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome }
        : undefined,
    };
  });
}

export function createPrazo(
  data: Omit<Prazo, "id" | "created_at" | "user_id">
): Prazo {
  const items = getPrazos();
  const novo: Prazo = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(PRAZOS_KEY, [...items, novo]);
  return novo;
}

export function updatePrazo(id: string, data: Partial<Prazo>): void {
  setPrazos(getPrazos().map((p) => (p.id === id ? { ...p, ...data } : p)));
}

export function deletePrazo(id: string): void {
  setPrazos(getPrazos().filter((p) => p.id !== id));
}

// --- Audiências ---
const AUDIENCIAS_KEY = "jur_audiencias";

export function getAudiencias(): Audiencia[] {
  return getAll<Audiencia>(AUDIENCIAS_KEY);
}

function setAudiencias(items: Audiencia[]): void {
  setAll(AUDIENCIAS_KEY, items);
}

export function getAudienciasWithProcesso(): (Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[] {
  const processos = getAll<Processo>(PROCESSOS_KEY);
  return getAudiencias().map((a) => {
    const proc = processos.find((pr) => pr.id === a.processo_id);
    return {
      ...a,
      processo: proc
        ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome }
        : undefined,
    };
  });
}

export function createAudiencia(
  data: Omit<Audiencia, "id" | "created_at" | "user_id">
): Audiencia {
  const items = getAudiencias();
  const nova: Audiencia = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(AUDIENCIAS_KEY, [...items, nova]);
  return nova;
}

export function updateAudiencia(id: string, data: Partial<Audiencia>): void {
  setAudiencias(getAudiencias().map((a) => (a.id === id ? { ...a, ...data } : a)));
}

export function deleteAudiencia(id: string): void {
  setAudiencias(getAudiencias().filter((a) => a.id !== id));
}

// --- Movimentações ---
const MOV_KEY = "jur_movimentacoes";

export function getMovimentacoes(): Movimentacao[] {
  return getAll<Movimentacao>(MOV_KEY);
}

function setMovimentacoes(items: Movimentacao[]): void {
  setAll(MOV_KEY, items);
}

export function getMovimentacoesByProcesso(processoId: string): Movimentacao[] {
  return getMovimentacoes()
    .filter((m) => m.processo_id === processoId)
    .sort((a, b) => new Date(b.data_movimentacao).getTime() - new Date(a.data_movimentacao).getTime());
}

export function createMovimentacao(
  data: Omit<Movimentacao, "id" | "created_at" | "user_id">
): Movimentacao {
  const items = getMovimentacoes();
  const nova: Movimentacao = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(MOV_KEY, [...items, nova]);
  return nova;
}

export function marcarMovimentacaoLida(id: string): void {
  setMovimentacoes(getMovimentacoes().map((m) => (m.id === id ? { ...m, lida: true } : m)));
}

export function marcarTodasMovimentacoesLidas(processoId: string): void {
  setMovimentacoes(
    getMovimentacoes().map((m) => (m.processo_id === processoId ? { ...m, lida: true } : m))
  );
}

export function getMovimentacoesNaoLidas(): number {
  return getMovimentacoes().filter((m) => !m.lida).length;
}

export function deleteMovimentacao(id: string): void {
  setMovimentacoes(getMovimentacoes().filter((m) => m.id !== id));
}

// --- Honorários ---
const HON_KEY = "jur_honorarios";

export function getHonorarios(): Honorario[] {
  // Backwards compat: entries without categoria default to "pagamento"
  return getAll<Honorario>(HON_KEY).map((h) => ({
    ...h,
    categoria: h.categoria ?? "pagamento",
  }));
}

function setHonorarios(items: Honorario[]): void {
  setAll(HON_KEY, items);
}

export function getHonorariosWithProcesso(): (Honorario & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[] {
  const processos = getAll<Processo>(PROCESSOS_KEY);
  return getHonorarios().map((h) => {
    const proc = processos.find((pr) => pr.id === h.processo_id);
    return {
      ...h,
      processo: proc
        ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome }
        : undefined,
    };
  });
}

export function createHonorario(
  data: Omit<Honorario, "id" | "created_at" | "user_id">
): Honorario {
  const items = getHonorarios();
  const novo: Honorario = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(HON_KEY, [...items, novo]);
  return novo;
}

export function updateHonorario(id: string, data: Partial<Honorario>): void {
  setHonorarios(getHonorarios().map((h) => (h.id === id ? { ...h, ...data } : h)));
}

export function deleteHonorario(id: string): void {
  setHonorarios(getHonorarios().filter((h) => h.id !== id));
}

// --- Publicações ---
const PUB_KEY = "jur_publicacoes";

export function getPublicacoes(): Publicacao[] {
  return getAll<Publicacao>(PUB_KEY);
}

export function createPublicacao(
  data: Omit<Publicacao, "id" | "created_at" | "user_id">
): Publicacao {
  const items = getPublicacoes();
  const nova: Publicacao = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(PUB_KEY, [...items, nova]);
  return nova;
}

export function marcarPublicacaoLida(id: string): void {
  setAll(
    PUB_KEY,
    getPublicacoes().map((p) => (p.id === id ? { ...p, lida: true } : p))
  );
}

// --- Atendimentos ---
const ATEN_KEY = "jur_atendimentos";

export function getAtendimentos(): Atendimento[] {
  return getAll<Atendimento>(ATEN_KEY);
}

function setAtendimentos(items: Atendimento[]): void {
  setAll(ATEN_KEY, items);
}

export function getAtendimentosWithProcesso(): Atendimento[] {
  const processos = getAll<Processo>(PROCESSOS_KEY);
  return getAtendimentos().map((a) => {
    const proc = processos.find((p) => p.id === a.processo_id);
    return {
      ...a,
      processo: proc
        ? { numero: proc.numero, titulo: proc.titulo, cliente_nome: proc.cliente_nome }
        : undefined,
    };
  });
}

export function getAtendimentosByProcesso(processoId: string): Atendimento[] {
  return getAtendimentos()
    .filter((a) => a.processo_id === processoId)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
}

export function createAtendimento(
  data: Omit<Atendimento, "id" | "created_at" | "user_id" | "processo">
): Atendimento {
  const items = getAtendimentos();
  const novo: Atendimento = {
    ...data,
    id: generateId(),
    created_at: now(),
    user_id: "local",
  };
  setAll(ATEN_KEY, [...items, novo]);
  return novo;
}

export function updateAtendimento(id: string, data: Partial<Atendimento>): void {
  setAtendimentos(getAtendimentos().map((a) => (a.id === id ? { ...a, ...data } : a)));
}

export function deleteAtendimento(id: string): void {
  setAtendimentos(getAtendimentos().filter((a) => a.id !== id));
}

// --- Clientes (cadastro) ---
const CLI_KEY = "jur_clientes";

export function getClientes(): Cliente[] {
  return getAll<Cliente>(CLI_KEY).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function getCliente(id: string): Cliente | undefined {
  return getAll<Cliente>(CLI_KEY).find((c) => c.id === id);
}

export function createCliente(data: Omit<Cliente, "id" | "created_at" | "updated_at" | "user_id">): Cliente {
  const items = getAll<Cliente>(CLI_KEY);
  const novo: Cliente = { ...data, id: generateId(), created_at: now(), updated_at: now(), user_id: "local" };
  setAll(CLI_KEY, [...items, novo]);
  return novo;
}

export function updateCliente(id: string, data: Partial<Cliente>): void {
  setAll(CLI_KEY, getAll<Cliente>(CLI_KEY).map((c) => c.id === id ? { ...c, ...data, updated_at: now() } : c));
}

export function deleteCliente(id: string): void {
  setAll(CLI_KEY, getAll<Cliente>(CLI_KEY).filter((c) => c.id !== id));
}

export function importarClientesExistentes(): number {
  const processos = getAll<Processo>(PROCESSOS_KEY);
  let count = 0;

  // 1. Para clientes JÁ cadastrados: vincula processos que ainda não têm cliente_id
  const clientesExistentes = getClientes();
  clientesExistentes.forEach((cliente) => {
    const semLink = processos.filter(
      (p) => p.cliente_nome === cliente.nome && !p.cliente_id
    );
    semLink.forEach((p) => updateProcesso(p.id, { cliente_id: cliente.id }));
    if (semLink.length > 0) count++;
  });

  // 2. Cria novos clientes para nomes que ainda não estão cadastrados
  const nomesRegistrados = new Set(clientesExistentes.map((c) => c.nome.toLowerCase().trim()));
  const novosNomes = new Map<string, string | undefined>();
  processos.forEach((p) => {
    const key = p.cliente_nome?.trim();
    if (key && !nomesRegistrados.has(key.toLowerCase())) {
      novosNomes.set(key, p.cliente_cpf_cnpj);
    }
  });

  novosNomes.forEach((cpf, nome) => {
    const novo = createCliente({ nome, cpf: cpf || undefined });
    processos
      .filter((p) => p.cliente_nome === nome && !p.cliente_id)
      .forEach((p) => updateProcesso(p.id, { cliente_id: novo.id }));
    count++;
  });

  return count;
}

// --- Clientes (summary) ---

export interface ClienteSummary {
  nome: string;
  totalProcessos: number;
  processosAtivos: number;
  totalCobrado: number;
  totalPago: number;
  saldo: number;
  ultimoContato?: string;
}

export function getClientesSummary(): (ClienteSummary & { id?: string; cadastrado: boolean })[] {
  const clientes = getClientes();
  const processos = getAll<Processo>(PROCESSOS_KEY);
  const honorarios = getHonorarios();
  const atendimentos = getAtendimentos();

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

  // Registered clients
  const registeredNomes = new Set(clientes.map((c) => c.nome));
  const registered = clientes.map((c) => buildSummary(c.id, c.nome, true));

  // Unregistered (in processos/atendimentos but not in Cliente registry)
  const nomesSet = new Set<string>();
  processos.forEach((p) => { if (!registeredNomes.has(p.cliente_nome)) nomesSet.add(p.cliente_nome); });
  atendimentos.forEach((a) => { if (!registeredNomes.has(a.cliente_nome)) nomesSet.add(a.cliente_nome); });
  const unregistered = Array.from(nomesSet).filter(Boolean).map((nome) => buildSummary(undefined, nome, false));

  return [...registered, ...unregistered].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function getProcessosByCliente(idOrNome: string): Processo[] {
  return getAll<Processo>(PROCESSOS_KEY)
    .filter((p) => p.cliente_id === idOrNome || p.cliente_nome === idOrNome)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function getPrazosByCliente(idOrNome: string): (Prazo & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[] {
  const procs = getAll<Processo>(PROCESSOS_KEY).filter((p) => p.cliente_id === idOrNome || p.cliente_nome === idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  return getPrazosWithProcesso()
    .filter((p) => procIds.has(p.processo_id))
    .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime());
}

export function getAudienciasByCliente(idOrNome: string): (Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> })[] {
  const procs = getAll<Processo>(PROCESSOS_KEY).filter((p) => p.cliente_id === idOrNome || p.cliente_nome === idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  return getAudienciasWithProcesso()
    .filter((a) => procIds.has(a.processo_id))
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
}

export function getHonorariosByCliente(idOrNome: string): Honorario[] {
  const procs = getAll<Processo>(PROCESSOS_KEY).filter((p) => p.cliente_id === idOrNome || p.cliente_nome === idOrNome);
  const procIds = new Set(procs.map((p) => p.id));
  return getHonorarios()
    .filter((h) => procIds.has(h.processo_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getAtendimentosByCliente(idOrNome: string): Atendimento[] {
  return getAtendimentos()
    .filter((a) => a.cliente_id === idOrNome || a.cliente_nome === idOrNome)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
}

// --- Dashboard stats ---
export interface DashboardStats {
  totalProcessos: number;
  processosAtivos: number;
  prazosProximos: number;
  prazosVencidos: number;
  audienciasProximas: number;
  atendimentosProximos: number;
  honorariosPendentes: number;
  honorariosRecebidosMes: number;
  publicacoesNaoLidas: number;
  movimentacoesNaoLidas: number;
}

export function getDashboardStats(): DashboardStats {
  const processos = getProcessos();
  const prazos = getPrazos().filter((p) => !p.concluido);
  const audiencias = getAudiencias().filter((a) => !a.realizada);
  const atendimentos = getAtendimentos().filter((a) => a.status === "agendado");
  const honorarios = getHonorarios();
  const publicacoes = getPublicacoes();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em7dias = new Date(hoje);
  em7dias.setDate(em7dias.getDate() + 7);

  const prazosVencidos = prazos.filter((p) => new Date(p.data_prazo) < hoje).length;
  const prazosProximos = prazos.filter((p) => {
    const d = new Date(p.data_prazo);
    return d >= hoje && d <= em7dias;
  }).length;

  const audienciasProximas = audiencias.filter((a) => {
    const d = new Date(a.data_hora);
    return d >= hoje && d <= em7dias;
  }).length;

  const atendimentosProximos = atendimentos.filter((a) => {
    const d = new Date(a.data_hora);
    return d >= hoje && d <= em7dias;
  }).length;

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const honorariosRecebidosMes = honorarios
    .filter((h) => h.categoria === "pagamento" && h.data_recebimento && new Date(h.data_recebimento) >= inicioMes)
    .reduce((sum, h) => sum + h.valor, 0);

  const totalCobrado = honorarios
    .filter((h) => h.categoria === "cobranca")
    .reduce((sum, h) => sum + h.valor, 0);
  const totalPago = honorarios
    .filter((h) => h.categoria === "pagamento")
    .reduce((sum, h) => sum + h.valor, 0);
  const honorariosPendentes = Math.max(0, totalCobrado - totalPago);

  return {
    totalProcessos: processos.length,
    processosAtivos: processos.filter((p) => p.status === "ativo").length,
    prazosProximos,
    prazosVencidos,
    audienciasProximas,
    atendimentosProximos,
    honorariosPendentes,
    honorariosRecebidosMes,
    publicacoesNaoLidas: publicacoes.filter((p) => !p.lida).length,
    movimentacoesNaoLidas: getMovimentacoesNaoLidas(),
  };
}

// --- DataJud sync ---
export interface SyncResult {
  novas: number;
  erro?: string;
}

export async function sincronizarProcesso(processoId: string): Promise<SyncResult> {
  const processo = getProcesso(processoId);
  if (!processo) return { novas: 0, erro: "Processo não encontrado" };

  const { parseCNJ } = await import("./datajud");
  const { tribunal } = parseCNJ(processo.numero);
  if (!tribunal) return { novas: 0, erro: "Número CNJ inválido ou tribunal não reconhecido" };

  const { buscarMovimentosSistema } = await import("./sistemas");

  let movimentos: { data: string; descricao: string; fonte: string }[];
  try {
    movimentos = await buscarMovimentosSistema(tribunal, processo.numero);
  } catch (err) {
    return { novas: 0, erro: err instanceof Error ? err.message : "Erro desconhecido" };
  }

  const existentes = getMovimentacoesByProcesso(processoId);
  const chaves = new Set(existentes.map((m) => `${m.data_movimentacao.slice(0, 10)}|${m.descricao}`));

  let novas = 0;
  for (const mov of movimentos) {
    // Normalise date: dd/mm/yyyy → ISO or keep ISO
    let iso = mov.data;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(mov.data)) {
      const [d, m, y] = mov.data.slice(0, 10).split("/");
      iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`;
    }
    const chave = `${iso.slice(0, 10)}|${mov.descricao}`;
    if (chaves.has(chave)) continue;

    createMovimentacao({
      processo_id: processoId,
      descricao: mov.descricao,
      data_movimentacao: iso,
      fonte: mov.fonte,
      lida: false,
    });
    chaves.add(chave);
    novas++;
  }

  updateProcesso(processoId, { ultimo_sync: new Date().toISOString() });
  return { novas };
}

export async function sincronizarTodos(): Promise<SyncResult> {
  const processos = getProcessos().filter((p) => p.monitorar_datajud && p.status === "ativo");
  let totalNovas = 0;
  for (const p of processos) {
    const r = await sincronizarProcesso(p.id);
    totalNovas += r.novas;
  }
  return { novas: totalNovas };
}
