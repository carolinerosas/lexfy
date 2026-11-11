"use client";
// Dados do novo Justio. Lê e grava nas MESMAS tabelas do Justio antigo (processos, prazos,
// audiências, honorários…), pelo proxy /api/supabase (só com login). O que o antigo não tem
// (equipe, ponto, ficha por área, fase, captação em etapas…) fica na tabela `justio_novo`,
// em um único documento. Nada fica guardado no navegador.
import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { AREAS, areaDe } from "./areas";
import { semAcento } from "./format";
import type { Colaborador, Config, DB, Tabela } from "./types";

type Linha = Record<string, unknown>;
type Conv = (v: unknown, item: Linha) => unknown;

const USER_ID = "lexfy_shared";
const TABELA_EXTRAS = "justio_novo";
const ID_EXTRAS = "estado";

const CONFIG_PADRAO: Config = { escritorio: "Caroline Fraga Advocacia", responsavel: "Caroline Fraga", oab: "", cidade: "", areasAtivas: AREAS.map((a) => a.id), fonte: "copia", perfil: "socio" };
const VAZIO: DB = {
  versao: 0, config: CONFIG_PADRAO,
  clientes: [], casos: [], prazos: [], audiencias: [], andamentos: [], publicacoes: [], honorarios: [], contas: [],
  atendimentos: [], tarefas: [], leads: [], equipe: [], ausencias: [], vagas: [], candidatos: [], avaliacoes: [], horas: [],
  procuracoes: [], correspondentes: [], custas: [], anotacoes: [], treinamentos: [], pontos: [], documentos: [],
};

/** Tabelas que só existem no novo: ficam inteiras no documento de extras. */
const SO_NOVO: Tabela[] = ["equipe", "ausencias", "vagas", "candidatos", "avaliacoes", "horas", "procuracoes", "correspondentes", "custas", "treinamentos", "pontos", "documentos"];

interface Extras { config: Partial<Config>; reg: Record<string, Record<string, Linha>>; col: Record<string, Linha[]> }
let extras: Extras = { config: {}, reg: {}, col: {} };

// ───────────── conversões ─────────────
const dia = (v: unknown) => (v ? String(v).slice(0, 10) : undefined);
const paraLocal = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v) : format(d, "yyyy-MM-dd'T'HH:mm:ss"); };
const paraUTC: Conv = (v) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? v : d.toISOString(); };
const limpo = <T extends Linha>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T;
const agora = () => new Date().toISOString();

const TIPO_PARA_AREA: Record<string, string> = { civel: "civel", familia: "familia", criminal: "criminal", juri: "juri", execucao_penal: "execucao_penal", inquerito_policial: "inquerito", bo_pm: "inquerito", trabalhista: "trabalhista", previdenciario: "previdenciario", tributario: "tributario", federal: "administrativo" };
const AREA_PARA_TIPO: Record<string, string> = { civel: "civel", familia: "familia", criminal: "criminal", juri: "juri", execucao_penal: "execucao_penal", inquerito: "inquerito_policial", trabalhista: "trabalhista", previdenciario: "previdenciario", tributario: "tributario" };
/** Tipo de processo que o Justio antigo entende (usado pelos painéis de peças e autos). */
export const areaParaTipoAntigo = (area: string) => AREA_PARA_TIPO[area] ?? "outro";

const lista = (xs: unknown, fn: (x: Linha) => string) => (Array.isArray(xs) && xs.length ? xs.map((x) => fn(x as Linha)).filter(Boolean).join("\n") : undefined);

/** Ficha da área montada a partir do que o antigo guarda (dados de família e do fato criminal). */
function fichaDoAntigo(p: Linha, area: string): Linha {
  const f = (p.dados_familia ?? {}) as Linha, c = (p.dados_criminais ?? {}) as Linha;
  const pret = (f.pretensao ?? {}) as Linha, prot = (c.medidas_protetivas ?? {}) as Linha;
  if (area === "familia") return limpo({
    acao: f.acao, relacao: f.relacao === "uniao_estavel" ? "União estável" : f.relacao === "casamento" ? "Casamento" : undefined, inicio: f.data_inicio_relacao, casamento: f.data_casamento,
    regime: f.regime_bens, separacao: f.data_separacao, moradia: f.moradia, filhos: lista(f.filhos, (x) => [x.nome, x.idade && `${x.idade} anos`, x.escola].filter(Boolean).join(", ")),
    guarda: pret.guarda, convivencia: pret.convivencia, alimentos: pret.alimentos, partilha: pret.partilha,
    bens: lista(f.bens, (x) => String(x.descricao ?? "")), dividas: lista(f.dividas, (x) => String(x.descricao ?? "")), renda_cliente: f.cliente_renda, renda_outra: f.outra_parte_renda,
  });
  if (["criminal", "juri", "inquerito", "execucao_penal"].includes(area)) return limpo({
    tipo_penal: Array.isArray(p.tipos_penais) && p.tipos_penais.length ? (p.tipos_penais as string[]).join("\n") : p.tipo_penal, imputacao: p.tipo_penal, fato_data: c.data_fato, fato_local: c.local_fato, ro: c.numero_ro,
    vitimas: lista(c.vitimas, (x) => String(x.nome ?? "")), situacao: c.prisao, unidade: p.unidade_prisional, citacao: c.data_citacao, lmp: c.maria_da_penha ? "Sim" : undefined,
    protetivas: Array.isArray(prot.aplicadas) ? (prot.aplicadas as string[]).join("\n") : undefined, testemunhas: lista(c.testemunhas, (x) => String(x.nome ?? "")),
    numero_ip: p.numero_inquerito, delegacia: p.delegacia, autoridade: p.autoridade_policial, instauracao: p.data_instauracao, pena: p.pena,
  });
  return {};
}

const areaPeloNome = (texto: unknown) => { const t = semAcento(String(texto ?? "")); return AREAS.find((a) => t && (a.id === t || semAcento(a.nome).includes(t) || t.includes(semAcento(a.nome))))?.id ?? "civel"; };
const TIPO_AT: Record<string, string> = { consulta_inicial: "consulta inicial", retorno: "retorno", orientacao: "orientação", audiencia_prep: "preparação de audiência", outro: "retorno" };
const TIPO_AT_INV: Record<string, string> = { "consulta inicial": "consulta_inicial", retorno: "retorno", "orientação": "orientacao", "preparação de audiência": "audiencia_prep", "visita à unidade prisional": "outro" };
const TIPO_HON: Record<string, string> = { exito: "êxito", sucumbencial: "sucumbência", contratual: "contratual", outro: "contratual" };
const TIPO_HON_INV: Record<string, string> = { "êxito": "exito", "sucumbência": "sucumbencial", contratual: "contratual", consulta: "outro", mensalidade: "outro" };

// ───────────── mapa: tabela nova ↔ tabela antiga ─────────────
interface Spec {
  antiga: string; select: string; ordem?: [string, boolean]; limite?: number; filtro?: [string, string];
  /** campo novo → coluna antiga (com conversão opcional) */
  campos: Record<string, string | [string, Conv]>;
  /** campos novos que ficam no documento de extras */
  extras: string[];
  ler: (l: Linha, x: Linha) => Linha;
  /** colunas a mais ao inserir */
  aoInserir?: (item: Linha) => Linha;
  /** colunas derivadas de uma alteração */
  derivar?: (parcial: Linha, completo: Linha) => Linha;
}

const SPECS: Partial<Record<Tabela, Spec>> = {
  clientes: {
    antiga: "clientes", select: "id,nome,cpf,email,celular,cidade,uf,profissao,observacoes,created_at", ordem: ["nome", true],
    campos: { nome: "nome", documento: "cpf", email: "email", celular: "celular", cidade: "cidade", uf: "uf", profissao: "profissao", observacoes: "observacoes" },
    extras: ["tipo", "origem"],
    ler: (c, x) => limpo({ id: c.id, nome: c.nome, tipo: x.tipo ?? (String(c.cpf ?? "").replace(/\D/g, "").length > 11 ? "pj" : "pf"), documento: c.cpf, email: c.email, celular: c.celular, cidade: c.cidade, uf: c.uf, profissao: c.profissao, origem: x.origem, observacoes: c.observacoes, criado_em: dia(c.created_at) ?? "" }),
    aoInserir: () => ({ updated_at: agora() }),
  },
  casos: {
    antiga: "processos", select: "*", ordem: ["created_at", false],
    campos: { numero: "numero", titulo: "titulo", status: "status", orgao: "vara", comarca: "comarca", uf: "uf", cliente_id: "cliente_id", cliente_nome: "cliente_nome", parte_contraria: "parte_contraria", valor: "valor_causa", distribuido_em: "data_distribuicao" },
    extras: ["area", "natureza", "fase", "dados", "risco", "responsavel_id", "docs_pendentes", "vinculados"],
    ler: (p, x) => {
      const area = String(x.area ?? TIPO_PARA_AREA[String(p.tipo ?? "")] ?? "civel");
      const a = areaDe(area);
      const fase = typeof x.fase === "number" ? x.fase : Math.max(0, a.fases.findIndex((f) => semAcento(f) === semAcento(String(p.fase ?? ""))));
      return limpo({
        id: p.id, natureza: a.grupo, area: a.id, numero: p.numero ?? "", titulo: p.titulo ?? "", status: p.status ?? "ativo", fase: Math.min(fase, a.fases.length - 1),
        orgao: p.vara, comarca: p.comarca, uf: p.uf, cliente_id: p.cliente_id ?? "", cliente_nome: p.cliente_nome ?? "", parte_contraria: p.parte_contraria, valor: p.valor_causa ?? undefined,
        responsavel_id: x.responsavel_id ?? "e1", distribuido_em: dia(p.data_distribuicao), dados: (x.dados as Linha | undefined) ?? fichaDoAntigo(p, a.id), risco: x.risco, docs_pendentes: x.docs_pendentes, vinculados: x.vinculados, criado_em: dia(p.created_at) ?? "",
      });
    },
    aoInserir: (c) => ({ tipo: areaParaTipoAntigo(String(c.area)), fase: areaDe(String(c.area)).fases[Number(c.fase) || 0], monitorar_datajud: !!c.numero, updated_at: agora() }),
    derivar: (parcial, completo) => ({
      ...("fase" in parcial ? { fase: areaDe(String(completo.area)).fases[Number(completo.fase) || 0] } : {}),
      ...("area" in parcial ? { tipo: areaParaTipoAntigo(String(completo.area)) } : {}),
      updated_at: agora(),
    }),
  },
  prazos: {
    antiga: "prazos", select: "id,processo_id,titulo,descricao,data_prazo,concluido,tipo,prioridade", ordem: ["data_prazo", true],
    campos: { caso_id: "processo_id", titulo: "titulo", data: "data_prazo", concluido: "concluido", prioridade: "prioridade" },
    extras: ["fatal", "base", "responsavel_id"],
    ler: (p, x) => limpo({ id: p.id, caso_id: p.processo_id, titulo: p.titulo, data: dia(p.data_prazo) ?? "", fatal: x.fatal ?? true, concluido: !!p.concluido, prioridade: p.prioridade ?? "media", responsavel_id: x.responsavel_id ?? "e1", base: x.base ?? p.descricao }),
  },
  audiencias: {
    antiga: "audiencias", select: "id,processo_id,titulo,data_hora,local,tipo,observacoes,realizada", ordem: ["data_hora", true],
    campos: { caso_id: "processo_id", titulo: "titulo", data_hora: ["data_hora", paraUTC], local: "local", realizada: "realizada", observacoes: "observacoes" },
    extras: ["modalidade", "responsavel_id"],
    ler: (a, x) => limpo({ id: a.id, caso_id: a.processo_id, titulo: a.titulo, data_hora: paraLocal(a.data_hora), local: a.local, modalidade: x.modalidade ?? "presencial", realizada: !!a.realizada, responsavel_id: x.responsavel_id ?? "e1", observacoes: a.observacoes }),
  },
  andamentos: {
    antiga: "movimentacoes", select: "id,processo_id,descricao,data_movimentacao,fonte,lida,texto_cliente", ordem: ["data_movimentacao", false], limite: 3000,
    campos: { caso_id: "processo_id", descricao: "descricao", data: "data_movimentacao", fonte: "fonte", lido: "lida", texto_cliente: "texto_cliente" },
    extras: [],
    ler: (m) => limpo({ id: m.id, caso_id: m.processo_id, data: dia(m.data_movimentacao) ?? "", descricao: m.descricao ?? "", fonte: m.fonte || "tribunal", lido: !!m.lida, texto_cliente: m.texto_cliente }),
  },
  publicacoes: {
    antiga: "publicacoes", select: "id,processo_id,titulo,conteudo,data_publicacao,diario,lida", ordem: ["data_publicacao", false], limite: 300,
    campos: { caso_id: "processo_id", data: "data_publicacao", diario: "diario", texto: "conteudo", lida: "lida", orgao: "titulo" },
    extras: ["prazo_sugerido"],
    ler: (p, x) => limpo({ id: p.id, caso_id: p.processo_id, data: dia(p.data_publicacao) ?? "", diario: p.diario ?? "DJEN", orgao: p.titulo ?? "", texto: p.conteudo ?? p.titulo ?? "", lida: !!p.lida, prazo_sugerido: x.prazo_sugerido }),
  },
  honorarios: {
    // No antigo, "cobranca" é o que o cliente deve e "pagamento" é o registro do que entrou.
    // Aqui aparecem as cobranças; a baixa cria o pagamento correspondente (ver gravarHonorario).
    antiga: "honorarios", select: "id,processo_id,descricao,valor,data_lancamento,data_recebimento,data_vencimento,status,tipo,categoria,created_at", filtro: ["categoria", "cobranca"],
    campos: { caso_id: "processo_id", descricao: "descricao", valor: "valor", vencimento: "data_vencimento", status: "status", recebido_em: "data_recebimento", tipo: ["tipo", (v) => TIPO_HON_INV[String(v)] ?? "outro"] },
    extras: ["tipo"],
    ler: (h, x) => limpo({ id: h.id, caso_id: h.processo_id, descricao: h.descricao ?? "", valor: Number(h.valor) || 0, vencimento: dia(h.data_vencimento ?? h.data_lancamento ?? h.created_at) ?? "", status: h.status === "recebido" ? "recebido" : h.status === "cancelado" ? "cancelado" : "pendente", recebido_em: dia(h.data_recebimento), tipo: x.tipo ?? TIPO_HON[String(h.tipo ?? "contratual")] ?? "contratual" }),
    aoInserir: () => ({ categoria: "cobranca", data_lancamento: agora().slice(0, 10) }),
  },
  contas: {
    antiga: "contas_escritorio", select: "id,descricao,valor,categoria,status,data_vencimento,recorrente", ordem: ["data_vencimento", true],
    campos: { descricao: "descricao", categoria: "categoria", valor: "valor", vencimento: "data_vencimento", status: "status", recorrente: "recorrente" },
    extras: [],
    ler: (c) => limpo({ id: c.id, descricao: c.descricao ?? "", categoria: c.categoria ?? "outro", valor: Number(c.valor) || 0, vencimento: dia(c.data_vencimento) ?? "", status: c.status === "paga" ? "paga" : "pendente", recorrente: !!c.recorrente }),
    aoInserir: () => ({ updated_at: agora() }),
    derivar: (parcial) => ({ ...(parcial.status === "paga" ? { data_pagamento: agora().slice(0, 10) } : {}), updated_at: agora() }),
  },
  atendimentos: {
    antiga: "atendimentos", select: "id,processo_id,cliente_id,cliente_nome,data_hora,duracao_min,tipo,status,notas,valor_cobrado", ordem: ["data_hora", false],
    campos: { cliente_id: "cliente_id", cliente_nome: "cliente_nome", caso_id: "processo_id", data_hora: ["data_hora", paraUTC], duracao_min: "duracao_min", tipo: ["tipo", (v) => TIPO_AT_INV[String(v)] ?? "outro"], status: "status", notas: "notas", valor: "valor_cobrado" },
    extras: ["responsavel_id", "tipo"],
    ler: (a, x) => limpo({ id: a.id, cliente_id: a.cliente_id, cliente_nome: a.cliente_nome ?? "", caso_id: a.processo_id, data_hora: paraLocal(a.data_hora), duracao_min: a.duracao_min ?? 45, tipo: x.tipo ?? TIPO_AT[String(a.tipo ?? "retorno")] ?? "retorno", status: a.status ?? "agendado", notas: a.notas, responsavel_id: x.responsavel_id ?? "e1", valor: a.valor_cobrado ?? undefined }),
  },
  tarefas: {
    antiga: "tarefas", select: "id,processo_id,titulo,descricao,data_limite,concluida,prioridade", ordem: ["created_at", false],
    campos: { caso_id: "processo_id", titulo: "titulo", limite: "data_limite", prioridade: "prioridade", estado: ["concluida", (v) => v === "feito"] },
    extras: ["estado", "responsavel_id"],
    ler: (t, x) => limpo({ id: t.id, caso_id: t.processo_id, titulo: t.titulo ?? "", estado: t.concluida ? "feito" : x.estado === "fazendo" ? "fazendo" : "a fazer", prioridade: t.prioridade ?? "media", responsavel_id: x.responsavel_id ?? "e1", limite: dia(t.data_limite) }),
    aoInserir: () => ({ updated_at: agora() }),
    derivar: () => ({ updated_at: agora() }),
  },
  anotacoes: {
    antiga: "anotacoes", select: "id,processo_id,titulo,conteudo,created_at", ordem: ["created_at", false], limite: 2000,
    campos: { caso_id: "processo_id", texto: "conteudo" },
    extras: ["autor_id"],
    ler: (n, x) => limpo({ id: n.id, caso_id: n.processo_id ?? "", texto: [n.titulo, n.conteudo].filter(Boolean).join(": "), data: dia(n.created_at) ?? "", autor_id: x.autor_id ?? "e1" }),
    aoInserir: () => ({ updated_at: agora() }),
    derivar: () => ({ updated_at: agora() }),
  },
  leads: {
    antiga: "triagem_leads", select: "id,nome,contato,telefone,area,resumo,urgencia,canal,status,created_at", ordem: ["created_at", false], limite: 500,
    campos: { nome: "nome", contato: "contato", resumo: "resumo", canal: "canal", urgencia: "urgencia", area: ["area", (v) => areaDe(String(v)).nome], etapa: ["status", (v) => (v === "descartado" ? "descartado" : v === "fechado" ? "aprovado" : "novo")] },
    extras: ["etapa", "valor_proposta", "convertido_caso_id", "area"],
    ler: (l, x) => limpo({
      id: l.id, nome: l.nome ?? "Sem nome", contato: l.telefone ?? l.contato ?? "", area: x.area ?? areaPeloNome(l.area), resumo: l.resumo ?? "", canal: l.canal ?? "Triagem",
      etapa: x.etapa ?? (l.status === "descartado" ? "descartado" : l.status === "aprovado" ? "fechado" : "novo"),
      urgencia: /alta|urgent/i.test(String(l.urgencia ?? "")) ? "alta" : /baixa/i.test(String(l.urgencia ?? "")) ? "baixa" : "media", valor_proposta: x.valor_proposta, convertido_caso_id: x.convertido_caso_id, criado_em: dia(l.created_at) ?? "",
    }),
  },
};

// ───────────── estado ─────────────
let db: DB = VAZIO;
let carga: Promise<void> | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export interface Situacao { erro: string; semExtras: boolean; gravando: number }
let situacao: Situacao = { erro: "", semExtras: false, gravando: 0 };
const mudarSituacao = (m: Partial<Situacao>) => { situacao = { ...situacao, ...m }; avisar(); };

const tabelaAusente = (e: unknown) => { const c = (e as { code?: string } | null)?.code; return c === "PGRST205" || c === "42P01"; };

async function lerTabela(spec: Spec): Promise<Linha[]> {
  let q = supabase.from(spec.antiga).select(spec.select);
  if (spec.filtro) q = q.eq(spec.filtro[0], spec.filtro[1]);
  if (spec.ordem) q = q.order(spec.ordem[0], { ascending: spec.ordem[1] });
  if (spec.limite) q = q.limit(spec.limite);
  const { data, error } = await q;
  if (error) {
    if (tabelaAusente(error)) return [];
    throw new Error(`${spec.antiga}: ${error.message}`);
  }
  return (data ?? []) as unknown as Linha[];
}

async function carregar() {
  try {
    const nomes = Object.keys(SPECS) as Tabela[];
    const [ext, perfil, ...tabelas] = await Promise.all([
      supabase.from(TABELA_EXTRAS).select("dados").eq("id", ID_EXTRAS).maybeSingle(),
      supabase.from("perfil_advogado").select("*").limit(1).maybeSingle(),
      ...nomes.map((n) => lerTabela(SPECS[n]!)),
    ]);
    let semExtras = false;
    if (ext.error) {
      if (tabelaAusente(ext.error)) semExtras = true;
      else throw new Error(`${TABELA_EXTRAS}: ${ext.error.message}`);
    }
    const bruto = (ext.data?.dados ?? {}) as Partial<Extras>;
    extras = { config: bruto.config ?? {}, reg: bruto.reg ?? {}, col: bruto.col ?? {} };

    const novo: DB = { ...VAZIO, versao: 1 };
    nomes.forEach((n, i) => {
      const reg = extras.reg[n] ?? {};
      (novo as unknown as Record<string, unknown>)[n] = tabelas[i].map((l) => SPECS[n]!.ler(l, reg[String(l.id)] ?? {}));
    });
    SO_NOVO.forEach((n) => { (novo as unknown as Record<string, unknown>)[n] = extras.col[n] ?? []; });
    // tarefas sem caso vivem só no documento de extras
    novo.tarefas = [...((extras.col.tarefas ?? []) as unknown as DB["tarefas"]), ...novo.tarefas];

    const p = (perfil.data ?? {}) as Linha;
    const oab = p.oab_numero ? `OAB/${p.oab_uf ?? "RJ"} ${p.oab_numero}` : "";
    novo.config = { ...CONFIG_PADRAO, ...(p.nome ? { responsavel: String(p.nome) } : {}), ...(oab ? { oab } : {}), ...extras.config, fonte: "copia" };
    if (novo.equipe.length === 0) {
      const socia: Colaborador = { id: "e1", nome: novo.config.responsavel, cargo: "Sócia fundadora", vinculo: "sócia", oab: novo.config.oab || undefined, email: "", celular: "", admissao: "", nascimento: "", remuneracao: 0, areas: ["criminal", "juri", "execucao_penal", "inquerito", "familia", "civel"], carga_semanal: 44, meta_horas: 120, ativo: true, cor: "#0a0a0a" };
      novo.equipe = [socia];
    }
    db = novo;
    mudarSituacao({ erro: "", semExtras });
  } catch (err) {
    db = { ...VAZIO, versao: 1 };
    mudarSituacao({ erro: `Não consegui carregar os dados: ${err instanceof Error ? err.message : "erro desconhecido"}. Se a sessão expirou, entre de novo.` });
  }
}

function iniciar() {
  if (typeof window === "undefined" || carga) return;
  carga = carregar();
}
const assinar = (f: () => void) => { ouvintes.add(f); iniciar(); return () => { ouvintes.delete(f); }; };

/** Banco inteiro em memória. Antes de carregar (e no servidor) vem vazio, com `versao: 0`. */
export function useDB(): DB {
  return useSyncExternalStore(assinar, () => db, () => VAZIO);
}
export function useSituacao(): Situacao {
  return useSyncExternalStore(assinar, () => situacao, () => situacao);
}
export function recarregar() { carga = carregar(); }
/** Estado atual (para quem precisa ler depois de um incluir, fora do ciclo de render). */
export const lerDB = (): DB => db;
/** Espera as gravações pendentes (inclusive o documento de extras) chegarem ao banco. */
export async function aguardarGravacoes(): Promise<void> {
  if (timerExtras) { clearTimeout(timerExtras); timerExtras = null; const copia = JSON.parse(JSON.stringify(extras)); enfileirar(async () => { const { error } = await supabase.from(TABELA_EXTRAS).upsert({ id: ID_EXTRAS, dados: copia, updated_at: agora() }, { onConflict: "id" }); if (error && !tabelaAusente(error)) throw new Error(error.message); }); }
  await fila.then(() => undefined, () => undefined);
}

// ───────────── gravação ─────────────
let fila: Promise<unknown> = Promise.resolve();
function enfileirar(fn: () => Promise<void>) {
  mudarSituacao({ gravando: situacao.gravando + 1 });
  fila = fila.then(fn).catch((err) => {
    mudarSituacao({ erro: `Uma alteração não foi gravada: ${err instanceof Error ? err.message : "erro desconhecido"}. Recarregue a página para ver o que está salvo.` });
  }).finally(() => mudarSituacao({ gravando: Math.max(0, situacao.gravando - 1) }));
}
async function conferir(r: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await r;
  if (error) throw new Error(error.message);
}

let timerExtras: ReturnType<typeof setTimeout> | null = null;
function salvarExtras() {
  if (timerExtras) clearTimeout(timerExtras);
  timerExtras = setTimeout(() => {
    timerExtras = null;
    const copia = JSON.parse(JSON.stringify(extras));
    enfileirar(async () => {
      const { error } = await supabase.from(TABELA_EXTRAS).upsert({ id: ID_EXTRAS, dados: copia, updated_at: agora() }, { onConflict: "id" });
      if (error) {
        if (tabelaAusente(error)) { mudarSituacao({ semExtras: true }); return; }
        throw new Error(error.message);
      }
      if (situacao.semExtras) mudarSituacao({ semExtras: false });
    });
  }, 700);
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => { if (timerExtras || situacao.gravando > 0) { e.preventDefault(); } });
}

const soExtras = (tabela: Tabela, item: Linha) => SO_NOVO.includes(tabela) || (tabela === "tarefas" && !item.caso_id);
function guardarColecao(tabela: Tabela) {
  const todos = db[tabela] as unknown as Linha[];
  extras.col[tabela] = tabela === "tarefas" ? todos.filter((t) => !t.caso_id) : todos;
  salvarExtras();
}
function colunas(spec: Spec, parcial: Linha, completo: Linha): Linha {
  const out: Linha = {};
  for (const k of Object.keys(parcial)) {
    const m = spec.campos[k];
    if (!m) continue;
    if (typeof m === "string") out[m] = parcial[k] ?? null;
    else out[m[0]] = m[1](parcial[k], completo) ?? null;
  }
  return out;
}
function guardarExtrasDoRegistro(tabela: Tabela, spec: Spec, id: string, parcial: Linha) {
  const chaves = spec.extras.filter((k) => k in parcial);
  if (chaves.length === 0) return;
  const reg = (extras.reg[tabela] ??= {});
  reg[id] = { ...reg[id], ...Object.fromEntries(chaves.map((k) => [k, parcial[k]])) };
  salvarExtras();
}
/** Registro de pagamento do antigo, criado quando uma cobrança é dada como recebida. */
const pagamentoDe = (h: Linha, ref?: string) => ({ id: crypto.randomUUID(), processo_id: h.caso_id, descricao: `Recebimento — ${h.descricao}${ref ? ` (${ref})` : ""}`, valor: h.valor, categoria: "pagamento", status: "recebido", data_recebimento: h.recebido_em ?? agora().slice(0, 10), created_at: agora(), user_id: USER_ID });

type Item<T extends Tabela> = DB[T][number];
const publicar = (novo: DB) => { db = novo; avisar(); };

export function incluir<T extends Tabela>(tabela: T, item: Omit<Item<T>, "id"> & { id?: string }): string {
  const id = item.id ?? crypto.randomUUID();
  const completo = { ...item, id } as unknown as Linha;
  publicar({ ...db, [tabela]: [completo, ...(db[tabela] as unknown[])] } as DB);

  if (soExtras(tabela, completo)) { guardarColecao(tabela); return id; }
  const spec = SPECS[tabela]!;
  guardarExtrasDoRegistro(tabela, spec, id, completo);
  const linha = { ...colunas(spec, completo, completo), ...(spec.aoInserir?.(completo) ?? {}), id, created_at: agora(), user_id: USER_ID };
  enfileirar(async () => {
    await conferir(supabase.from(spec.antiga).insert(linha));
    if (tabela === "honorarios" && completo.status === "recebido") await conferir(supabase.from("honorarios").insert(pagamentoDe(completo)));
  });
  return id;
}

export function alterar<T extends Tabela>(tabela: T, id: string, mudanca: Partial<Item<T>>, opcoes?: { referencia?: string }) {
  const antes = (db[tabela] as unknown as Linha[]).find((x) => x.id === id);
  if (!antes) return;
  const completo = { ...antes, ...(mudanca as Linha) };
  publicar({ ...db, [tabela]: (db[tabela] as unknown as Linha[]).map((x) => (x.id === id ? completo : x)) } as DB);

  if (soExtras(tabela, antes)) { guardarColecao(tabela); return; }
  const spec = SPECS[tabela]!;
  const parcial = mudanca as Linha;
  guardarExtrasDoRegistro(tabela, spec, id, parcial);
  const cols = { ...colunas(spec, parcial, completo), ...(spec.derivar?.(parcial, completo) ?? {}) };
  if (Object.keys(cols).length === 0) return;
  enfileirar(async () => {
    await conferir(supabase.from(spec.antiga).update(cols).eq("id", id));
    // baixa de honorário: registra também o pagamento, como o Justio antigo faz
    if (tabela === "honorarios" && parcial.status === "recebido" && antes.status !== "recebido") await conferir(supabase.from("honorarios").insert(pagamentoDe(completo, opcoes?.referencia)));
  });
}

export function excluir(tabela: Tabela, id: string) {
  const antes = (db[tabela] as unknown as Linha[]).find((x) => x.id === id);
  if (!antes) return;
  publicar({ ...db, [tabela]: (db[tabela] as unknown as Linha[]).filter((x) => x.id !== id) } as DB);
  if (soExtras(tabela, antes)) { guardarColecao(tabela); return; }
  const spec = SPECS[tabela]!;
  if (extras.reg[tabela]?.[id]) { delete extras.reg[tabela][id]; salvarExtras(); }
  enfileirar(() => conferir(supabase.from(spec.antiga).delete().eq("id", id)));
}

/** Pagamento avulso no formato do antigo (categoria "pagamento"). */
function lancarPagamento(casoId: string, descricao: string, valor: number, quando: string) {
  enfileirar(() => conferir(supabase.from("honorarios").insert({ id: crypto.randomUUID(), processo_id: casoId, descricao, valor, categoria: "pagamento", status: "recebido", data_recebimento: quando, created_at: agora(), user_id: USER_ID })));
}

/**
 * Recebimento de um honorário, como no Justio antigo:
 * - igual ao valor: quita;
 * - menor: quita o que entrou e gera nova cobrança com a diferença;
 * - maior: quita e abate o excedente das últimas parcelas em aberto do mesmo caso; a sobra fica como adiantamento.
 */
export function registrarRecebimento(id: string, opts: { data: string; valor: number; vencimentoDiferenca?: string; referencia?: string }) {
  const ref = opts.referencia?.trim() || undefined;
  const h = db.honorarios.find((x) => x.id === id);
  if (!h) return;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const recebido = r2(Math.max(0, opts.valor));
  if (recebido <= 0) return;
  if (recebido <= h.valor + 0.005) {
    const diferenca = r2(h.valor - recebido);
    alterar("honorarios", h.id, { valor: recebido, status: "recebido", recebido_em: opts.data }, { referencia: ref });
    if (diferenca > 0.005) {
      const base = h.descricao.replace(/ — diferença$/, "");
      incluir("honorarios", { caso_id: h.caso_id, descricao: `${base} — diferença`, valor: diferenca, vencimento: opts.vencimentoDiferenca || h.vencimento, status: "pendente", tipo: h.tipo });
    }
    return;
  }
  alterar("honorarios", h.id, { status: "recebido", recebido_em: opts.data }, { referencia: ref });
  let excedente = r2(recebido - h.valor);
  const outras = db.honorarios.filter((p) => p.caso_id === h.caso_id && p.id !== h.id && p.status === "pendente").sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  for (const p of outras) {
    if (excedente <= 0.005) break;
    if (excedente >= p.valor - 0.005) {
      alterar("honorarios", p.id, { status: "recebido", recebido_em: opts.data });
      excedente = r2(excedente - p.valor);
    } else {
      alterar("honorarios", p.id, { valor: r2(p.valor - excedente) });
      lancarPagamento(p.caso_id, `Recebimento — ${p.descricao}`, excedente, opts.data);
      excedente = 0;
    }
  }
  if (excedente > 0.005) lancarPagamento(h.caso_id, `Recebimento — ${h.descricao} (${ref ? `${ref}, ` : ""}adiantamento)`, excedente, opts.data);
}

export function alterarConfig(mudanca: Partial<Config>) {
  publicar({ ...db, config: { ...db.config, ...mudanca } });
  extras.config = { ...extras.config, ...mudanca };
  salvarExtras();
}

export function exportarBanco(): string { return JSON.stringify(db, null, 2); }
