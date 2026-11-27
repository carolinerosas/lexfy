// Importação de um processo a partir do que o Cowork extraiu do PDF dos autos.
// As instruções para o Cowork são geradas daqui, a partir das próprias fichas (areas.ts):
// assim, toda caixa nova numa ficha passa a ser pedida ao Cowork sem precisar reescrever nada.
import { AREAS, areaDe, type Area, type Campo } from "./areas";
import { semAcento } from "./format";

export const VERSAO_IMPORTACAO = 1;

/** Pedidos da execução penal: mesmos tipos e situações da aba Incidentes. */
export const TIPOS_PEDIDO = ["progressao_regime", "livramento_condicional", "remicao", "saida_temporaria", "trabalho_extramuros", "regressao", "unificacao_penas", "detracao", "indulto", "comutacao", "extincao_pena", "outro"] as const;
export const STATUS_PEDIDO = ["protocolado", "em_andamento", "deferido", "parcialmente_deferido", "indeferido", "cumprido", "arquivado"] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

const TIPO_LEGIVEL: Record<Campo["tipo"], string> = {
  t: "texto", l: "texto longo", m: "lista (array de textos, um item por elemento)", d: "data AAAA-MM-DD",
  v: "valor em reais (número, ex.: 1500.5)", n: "número", s: "\"Sim\" ou \"Não\"", o: "uma das opções",
};

function linhaCampo(c: Campo): string {
  const base = `- \`${c.k}\` (${TIPO_LEGIVEL[c.tipo]}): ${c.rotulo}`;
  return c.tipo === "o" && c.opcoes?.length ? `${base}. Opções: ${c.opcoes.map((o) => `"${o}"`).join(" | ")}` : base;
}

function blocoArea(a: Area): string {
  const partes = [`### \`${a.id}\`: ${a.nome} (${a.grupo === "judicial" ? "judicial" : "extrajudicial"})`, `Fases (use o nome exato em processo.fase): ${a.fases.map((f) => `"${f}"`).join(", ")}`];
  if (a.tipos?.length) partes.push(`Tipos de processo (processo.tipos, pode mais de um): ${a.tipos.map((t) => `"${t}"`).join(", ")}`);
  for (const s of a.secoes) {
    partes.push(`Seção "${s.titulo}"${s.so ? ` (só para os tipos: ${s.so.join(", ")})` : ""}:`);
    partes.push(...s.campos.map(linhaCampo));
  }
  return partes.join("\n");
}

/** Texto completo para colar no Cowork. Sempre em sincronia com as fichas do sistema. */
export function instrucoesCowork(): string {
  return `${corpoInstrucoes()}\n${areasTexto()}`;
}

function corpoInstrucoes(): string {
  return `# Extração de processo para o JUSTIO (versão ${VERSAO_IMPORTACAO})

Você vai ler o PDF dos autos de um processo, ou as informações dadas na conversa, e devolver UM ÚNICO bloco \`\`\`json, sem texto antes ou depois, no formato descrito abaixo. A advogada cola esse bloco no JUSTIO (menu Triagem com IA, aba Do Cowork), revisa campo a campo e só então o sistema grava.

## Regras
1. Extraia só o que está escrito nos autos. Não deduza, não complete e não invente. Se não achou, omita a chave (não escreva "não informado", null ou "").
   Se a fonte for a conversa, use só o que a advogada disse ou mostrou; o que faltar para a ficha vai em "pendencias".
2. Datas: sempre AAAA-MM-DD. Data e hora: AAAA-MM-DDTHH:MM (horário de Brasília).
3. Valores em dinheiro: número com ponto decimal, sem "R$" (ex.: 12500.75).
4. Campos de lista: array de textos, um item por elemento.
5. Campos de opção: copie exatamente uma das opções listadas. Se nenhuma servir, omita o campo e explique em "pendencias".
6. Nomes de pessoas: como estão nos autos, com acentos (LUÍS, não LUíS).
7. O cliente é a pessoa que a advogada defende ou representa. No penal, é o réu, acusado, investigado, paciente ou apenado, nunca o Ministério Público nem a vítima.
8. Escolha UMA área em processo.area (use o identificador entre crases da lista de áreas) e preencha "ficha" só com as chaves dessa área.
9. Em "fonte" de cada prazo e andamento, diga onde está no PDF (página, folha ou evento), para a advogada conferir.
10. Em "pendencias", liste o que precisa ser conferido ou providenciado: dúvidas de leitura, prazos em curso, documentos faltando, contradições nos autos.

## Formato
\`\`\`json
{
  "justio": ${VERSAO_IMPORTACAO},
  "cliente": {
    "nome": "", "tipo": "pf ou pj", "cpf_cnpj": "", "rg": "", "nascimento": "AAAA-MM-DD",
    "nacionalidade": "", "estado_civil": "", "profissao": "", "filiacao": "",
    "celular": "", "email": "", "endereco": "", "cidade": "", "uf": "RJ"
  },
  "processo": {
    "area": "identificador da área", "titulo": "classe ou assunto principal", "numero": "0000000-00.0000.0.00.0000",
    "classe": "", "orgao": "vara, juízo ou câmara", "comarca": "", "uf": "RJ",
    "parte_contraria": "", "valor_causa": 0, "distribuido_em": "AAAA-MM-DD",
    "fase": "nome exato de uma fase da área", "tipos": ["tipo de processo da área"]
  },
  "ficha": { "chave_do_campo": "valor" },
  "partes": [{ "nome": "", "papel": "réu, vítima, testemunha, autor...", "polo": "ativo ou passivo" }],
  "vinculados": [{ "tipo": "Habeas corpus, Recurso, Apenso...", "numero": "", "situacao": "" }],
  "prazos": [{ "titulo": "", "data": "AAAA-MM-DD", "fatal": true, "fonte": "fls. 120" }],
  "audiencias": [{ "titulo": "", "data_hora": "AAAA-MM-DDTHH:MM", "local": "", "modalidade": "presencial, virtual ou híbrida" }],
  "andamentos": [{ "data": "AAAA-MM-DD", "descricao": "", "fonte": "evento 35" }],
  "pedidos_execucao": [{
    "tipo": "${TIPOS_PEDIDO.join(" | ")}",
    "titulo": "", "data_pedido": "AAAA-MM-DD",
    "status": "${STATUS_PEDIDO.join(" | ")}",
    "data_decisao": "AAAA-MM-DD", "resultado": "o que a decisão concedeu ou negou, e por quê",
    "recurso": { "interposto": "Agravo em execução da defesa | Agravo em execução do MP | Habeas corpus", "resultado": "Provido | Parcialmente provido | Desprovido | Não conhecido | Ordem concedida | Ordem denegada", "data": "AAAA-MM-DD", "efeito": "o que o acórdão mudou" }
  }],
  "pendencias": ["o que a advogada precisa conferir ou fazer"]
}
\`\`\`

Pedidos da execução (só na área execucao_penal): um item por pedido feito ao juízo da execução (progressão, livramento, remição, saída temporária, indulto, comutação etc.), com a decisão de cada um e, se houve, o recurso contra ela e o resultado. Recursos de sentença e acórdão nas demais áreas vão nos campos da ficha (apelação, resultado da apelação, recurso aos tribunais superiores).

Prazos: só os que ainda estão correndo ou por vir, com a data final já contada. Andamentos: os atos relevantes (recebimento da denúncia, citação, decisões, sentença, recursos, prisões e solturas), do mais antigo para o mais recente.

`;
}

/** Campos das fichas de todas as áreas. */
export function areasTexto(): string {
  return `## Áreas e campos da ficha\n\n${AREAS.map(blocoArea).join("\n\n")}\n`;
}

/** Skill para o Claude ou o Cowork: as mesmas instruções, com o cabeçalho que ativa a skill. */
export function skillJustio(): string {
  return `---
name: justio-extracao
description: Extrai de um PDF de processo (autos, denúncia, sentença, petição) ou das informações da conversa todos os dados das fichas do JUSTIO (cliente, processo e ficha da área: criminal, júri, cível, família, trabalhista, previdenciário e as demais) e devolve um bloco JSON para colar no JUSTIO, no menu Triagem com IA, aba Do Cowork, onde a advogada revisa e confirma. Use sempre que a advogada pedir para cadastrar, importar, alimentar ou atualizar no JUSTIO um processo ou cliente, ou para extrair dados de autos para o sistema.
---

## Como usar esta skill

1. Leia a fonte inteira: o PDF dos autos (veja como imagem as páginas com fotos, laudos e prints) ou o que a advogada escreveu na conversa. Com vários documentos do mesmo processo, junte tudo num único resultado.
2. Identifique a área pela classe, pelo assunto e pelo juízo, e use só os campos da ficha dessa área.
3. Abra o arquivo \`areas.md\` desta skill e leia só a seção da área escolhida: ali estão as chaves, os tipos e as opções exatas da ficha.
4. Devolva só o bloco JSON no formato abaixo. Com mais de um processo, entregue um processo por resposta e diga que há outro. Não grave arquivos e não tente acessar o JUSTIO: a advogada cola o bloco no menu Triagem com IA, aba Do Cowork, revisa campo a campo e confirma.
5. Se a advogada pedir para atualizar um processo que já existe, extraia tudo do mesmo jeito: o JUSTIO reconhece o caso pelo número e só preenche o que está vazio; valor diferente só é substituído se ela marcar.

${corpoInstrucoes()}
## Áreas e campos da ficha\n\nEstão em \`areas.md\`, nesta mesma pasta. Use só as chaves da área do processo, com as opções escritas exatamente como lá.\n`;
}

// ───────────── leitura do que o Cowork devolveu ─────────────

export interface ClienteImportado {
  nome: string; tipo: "pf" | "pj"; documento?: string; email?: string; celular?: string; cidade?: string; uf?: string; profissao?: string;
  /** rg, nascimento, nacionalidade, estado civil, filiação e endereço: vão para as observações do cliente. */
  qualificacao: string[];
}
export interface ProcessoImportado {
  area: string; titulo: string; numero: string; orgao?: string; comarca?: string; uf?: string;
  parte_contraria?: string; valor?: number; distribuido_em?: string; fase: number; tipos: string[];
}
export interface Importacao {
  cliente: ClienteImportado;
  processo: ProcessoImportado;
  ficha: Record<string, string | number>;
  vinculados: { tipo: string; numero: string; situacao?: string }[];
  prazos: { titulo: string; data: string; fatal: boolean; fonte?: string }[];
  audiencias: { titulo: string; data_hora: string; local?: string; modalidade: "presencial" | "virtual" | "híbrida" }[];
  andamentos: { data: string; descricao: string; fonte?: string }[];
  pedidos: { tipo: TipoPedido; titulo: string; data_pedido?: string; status: StatusPedido; data_decisao?: string; resultado?: string;
    recurso?: { interposto?: string; resultado?: string; data?: string; efeito?: string } }[];
  pendencias: string[];
  partes: { nome: string; papel?: string; polo?: string }[];
  /** O que não pôde ser aproveitado como veio (campo desconhecido, opção fora da lista, data inválida). */
  avisos: string[];
}

type Bruto = Record<string, unknown>;
const txt = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "");
const obj = (v: unknown): Bruto => (v && typeof v === "object" && !Array.isArray(v) ? (v as Bruto) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const igual = (a: string, b: string) => semAcento(a).replace(/\s+/g, " ").trim() === semAcento(b).replace(/\s+/g, " ").trim();

/** AAAA-MM-DD a partir de AAAA-MM-DD ou DD/MM/AAAA. */
export function dataISO(v: unknown): string | undefined {
  const s = txt(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}
function dataHoraISO(v: unknown): string | undefined {
  const s = txt(v);
  const d = dataISO(s);
  if (!d) return undefined;
  const h = /[T\s](\d{1,2}):(\d{2})/.exec(s) ?? /(\d{1,2})h(\d{2})?/.exec(s);
  return `${d}T${h ? `${h[1].padStart(2, "0")}:${h[2] ?? "00"}` : "09:00"}:00`;
}
/** 1500.5, "1.500,50", "R$ 1.500,50" → 1500.5 */
export function numero(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = txt(v).replace(/[^\d,.-]/g, "");
  if (!s) return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Um campo da ficha no formato que o sistema guarda, ou um aviso. */
function valorDoCampo(c: Campo, v: unknown): { valor?: string | number; aviso?: string } {
  if (c.tipo === "m") {
    const itens = (Array.isArray(v) ? v.map(txt) : txt(v).split(/\n|;\s*/)).map((x) => x.trim()).filter(Boolean);
    return itens.length ? { valor: itens.join("\n") } : {};
  }
  if (c.tipo === "d") {
    const d = dataISO(v);
    return d ? { valor: d } : txt(v) ? { aviso: `“${c.rotulo}”: data não reconhecida (“${txt(v)}”).` } : {};
  }
  if (c.tipo === "v" || c.tipo === "n") {
    const n = numero(v);
    return n !== undefined ? { valor: n } : txt(v) ? { aviso: `“${c.rotulo}”: número não reconhecido (“${txt(v)}”).` } : {};
  }
  if (c.tipo === "s") {
    const s = typeof v === "boolean" ? (v ? "Sim" : "Não") : semAcento(txt(v));
    if (s === "Sim" || s === "sim" || s === "s" || s === "true") return { valor: "Sim" };
    if (s === "Não" || s === "nao" || s === "n" || s === "false") return { valor: "Não" };
    return txt(v) ? { aviso: `“${c.rotulo}”: esperado Sim ou Não (“${txt(v)}”).` } : {};
  }
  if (c.tipo === "o") {
    const s = txt(v);
    if (!s) return {};
    const op = c.opcoes?.find((o) => igual(o, s));
    // fora da lista: fica o texto do Cowork (a caixa aceita opção própria), com aviso para conferir
    return op ? { valor: op } : { valor: s, aviso: `“${c.rotulo}”: “${s}” não está entre as opções; confira.` };
  }
  const s = Array.isArray(v) ? v.map(txt).filter(Boolean).join("\n") : txt(v);
  return s ? { valor: s } : {};
}

/** Acha o JSON no texto colado (com ou sem ```json) e devolve o objeto. */
export function acharJSON(texto: string): Bruto {
  const bloco = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto)?.[1] ?? texto;
  const ini = bloco.indexOf("{"), fim = bloco.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("Não achei o bloco de dados. Cole a resposta inteira do Cowork, com as chaves { }.");
  try {
    return JSON.parse(bloco.slice(ini, fim + 1)) as Bruto;
  } catch {
    throw new Error("O bloco de dados está com erro de formato. Peça ao Cowork para devolver só o JSON, sem comentários.");
  }
}

/** `areaForcada`: quando a advogada troca a área na revisão, a ficha é relida para a área escolhida. */
export function lerImportacao(texto: string, areaForcada?: string): Importacao {
  const j = acharJSON(texto);
  const avisos: string[] = [];
  const c = obj(j.cliente), p = obj(j.processo);

  // área: identificador, nome ou parte do nome
  const areaTxt = areaForcada ?? txt(p.area);
  const area = AREAS.find((a) => a.id === areaTxt) ?? AREAS.find((a) => areaTxt && (igual(a.nome, areaTxt) || semAcento(a.nome).includes(semAcento(areaTxt))));
  if (!area && !areaForcada) avisos.push(areaTxt ? `Área “${areaTxt}” não reconhecida: escolha a área abaixo.` : "O Cowork não indicou a área: escolha abaixo.");
  const a = area ?? areaDe("civel");

  const faseTxt = txt(p.fase);
  let fase = faseTxt ? a.fases.findIndex((f) => igual(f, faseTxt)) : 0;
  if (fase < 0) { if (!areaForcada) avisos.push(`Fase “${faseTxt}” não existe em ${a.nome}: confira abaixo.`); fase = 0; }

  const tipos = arr(p.tipos).map(txt).filter(Boolean).map((t) => a.tipos?.find((x) => igual(x, t)) ?? t);

  // ficha: só as chaves da área; o resto vira aviso
  const campos = new Map(a.secoes.flatMap((s) => s.campos).map((x) => [x.k, x]));
  const ficha: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj(j.ficha))) {
    const campo = campos.get(k);
    if (!campo) { if (txt(v) || Array.isArray(v)) avisos.push(`Campo “${k}” não existe na ficha de ${a.nome} e foi ignorado.`); continue; }
    const r = valorDoCampo(campo, v);
    if (r.valor !== undefined && r.valor !== "") ficha[k] = r.valor;
    if (r.aviso) avisos.push(r.aviso);
  }
  if (tipos.length) ficha.tipo_caso = tipos.join("\n");

  const doc = txt(c.cpf_cnpj ?? c.documento ?? c.cpf ?? c.cnpj);
  const digitos = doc.replace(/\D/g, "");
  const qualificacao = [
    ["RG", c.rg], ["Nascimento", dataISO(c.nascimento) ? dataISO(c.nascimento)!.split("-").reverse().join("/") : c.nascimento],
    ["Nacionalidade", c.nacionalidade], ["Estado civil", c.estado_civil], ["Filiação", c.filiacao], ["Endereço", c.endereco],
  ].filter(([, v]) => txt(v)).map(([k, v]) => `${k}: ${txt(v)}`);

  const cliente: ClienteImportado = {
    nome: txt(c.nome), tipo: txt(c.tipo) === "pj" || digitos.length === 14 ? "pj" : "pf",
    documento: doc || undefined, email: txt(c.email) || undefined, celular: txt(c.celular ?? c.telefone) || undefined,
    cidade: txt(c.cidade) || undefined, uf: txt(c.uf).toUpperCase().slice(0, 2) || undefined, profissao: txt(c.profissao) || undefined, qualificacao,
  };
  if (!cliente.nome) avisos.push("O Cowork não trouxe o nome do cliente: preencha abaixo.");

  const processo: ProcessoImportado = {
    area: a.id, titulo: txt(p.titulo) || txt(p.classe), numero: txt(p.numero), orgao: txt(p.orgao) || undefined, comarca: txt(p.comarca) || undefined,
    uf: txt(p.uf).toUpperCase().slice(0, 2) || undefined, parte_contraria: txt(p.parte_contraria) || undefined,
    valor: numero(p.valor_causa ?? p.valor), distribuido_em: dataISO(p.distribuido_em), fase, tipos,
  };

  const prazos = arr(j.prazos).map(obj).flatMap((x) => {
    const data = dataISO(x.data);
    if (!txt(x.titulo)) return [];
    if (!data) { avisos.push(`Prazo “${txt(x.titulo)}” sem data válida: não entra.`); return []; }
    return [{ titulo: txt(x.titulo), data, fatal: x.fatal !== false, fonte: txt(x.fonte) || undefined }];
  });
  const audiencias = arr(j.audiencias).map(obj).flatMap((x) => {
    const dh = dataHoraISO(x.data_hora ?? x.data);
    if (!dh) { if (txt(x.titulo)) avisos.push(`Audiência “${txt(x.titulo)}” sem data válida: não entra.`); return []; }
    const mod = semAcento(txt(x.modalidade));
    return [{ titulo: txt(x.titulo) || "Audiência", data_hora: dh, local: txt(x.local) || undefined, modalidade: (mod.startsWith("virt") ? "virtual" : mod.startsWith("hib") ? "híbrida" : "presencial") as "presencial" | "virtual" | "híbrida" }];
  });
  const andamentos = arr(j.andamentos).map(obj).flatMap((x) => {
    const data = dataISO(x.data);
    return data && txt(x.descricao) ? [{ data, descricao: txt(x.descricao), fonte: txt(x.fonte) || undefined }] : [];
  });
  const vinculados = arr(j.vinculados).map(obj).flatMap((x) => (txt(x.numero) ? [{ tipo: txt(x.tipo) || "Outro", numero: txt(x.numero), situacao: txt(x.situacao) || undefined }] : []));
  const partes = arr(j.partes).map(obj).flatMap((x) => (txt(x.nome) ? [{ nome: txt(x.nome), papel: txt(x.papel) || undefined, polo: txt(x.polo) || undefined }] : []));
  const pendencias = arr(j.pendencias).map(txt).filter(Boolean);
  const chave = (v: unknown) => semAcento(txt(v)).replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  const pedidos = arr(j.pedidos_execucao).map(obj).flatMap((x) => {
    const tipoTxt = chave(x.tipo);
    const tipo = (TIPOS_PEDIDO.find((t) => t === tipoTxt || tipoTxt.startsWith(t.split("_")[0])) ?? "outro") as TipoPedido;
    const stTxt = chave(x.status);
    const status = (STATUS_PEDIDO.find((t) => t === stTxt) ?? (stTxt.startsWith("parcial") ? "parcialmente_deferido" : stTxt.startsWith("defer") ? "deferido" : stTxt.startsWith("indefer") ? "indeferido" : "em_andamento")) as StatusPedido;
    const titulo = txt(x.titulo) || txt(x.tipo);
    if (!titulo) return [];
    const r = obj(x.recurso);
    const recurso = txt(r.interposto) ? { interposto: txt(r.interposto), resultado: txt(r.resultado) || undefined, data: dataISO(r.data), efeito: txt(r.efeito) || undefined } : undefined;
    return [{ tipo, titulo, data_pedido: dataISO(x.data_pedido), status, data_decisao: dataISO(x.data_decisao), resultado: txt(x.resultado) || undefined, recurso }];
  });
  if (pedidos.length && a.id !== "execucao_penal") avisos.push("Vieram pedidos de execução, mas a área escolhida não é Execução penal: eles só entram se a área for Execução penal.");

  if (Number(j.justio) && Number(j.justio) !== VERSAO_IMPORTACAO) avisos.push(`As instruções do Cowork são de outra versão (${txt(j.justio)}). Copie as instruções de novo.`);
  return { cliente, processo, ficha, vinculados, prazos, audiencias, andamentos, pedidos, pendencias, partes, avisos };
}
