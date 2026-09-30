// Extração "leitura básica" da Triagem > Importar dados.
// Regra central: o texto é dividido em blocos por entidade (cliente, parte contrária,
// terceiros) e os dados de contato do cliente só podem vir do bloco do cliente.
// Módulo puro (sem fetch), para poder ser testado com `node scripts/test-triagem-extracao.ts`.
import type { TriagemImportDraft } from "@/types";

type ClienteDraft = NonNullable<TriagemImportDraft["cliente"]>;

export type EntidadeTipo = "cliente" | "parte_contraria" | "terceiros" | "outro";

export interface Bloco {
  tipo: EntidadeTipo;
  titulo?: string;
  texto: string;
}

export interface EntidadesExtraidas {
  cliente: ClienteDraft;
  parte_contraria?: string;
  /** Blocos por entidade, usados para validar dados vindos da IA. */
  blocos: Bloco[];
  /** true quando o texto tem um bloco explícito de cliente. */
  clienteEscopado: boolean;
}

// ---------- utilitários ----------

export function cleanLine(value?: string): string | undefined {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

export function onlyDigits(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits || undefined;
}

function ascii(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCep(value?: string): string | undefined {
  const digits = onlyDigits(value);
  if (!digits || digits.length !== 8) return cleanLine(value);
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

const ESTADOS: Record<string, string> = {
  "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM", "BAHIA": "BA", "CEARA": "CE",
  "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", "GOIAS": "GO", "MARANHAO": "MA",
  "MATO GROSSO DO SUL": "MS", "MATO GROSSO": "MT", "MINAS GERAIS": "MG", "PARAIBA": "PB",
  "PARANA": "PR", "PARA": "PA", "PERNAMBUCO": "PE", "PIAUI": "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", "RONDONIA": "RO", "RORAIMA": "RR",
  "SANTA CATARINA": "SC", "SAO PAULO": "SP", "SERGIPE": "SE", "TOCANTINS": "TO",
};
const SIGLAS_UF = new Set(Object.values(ESTADOS));

export function normalizeUf(value?: string): string | undefined {
  const raw = cleanLine(value);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return SIGLAS_UF.has(upper) ? upper : undefined;
  const nome = ascii(raw).toUpperCase();
  return Object.entries(ESTADOS).find(([estado]) => nome.includes(estado))?.[1];
}

/** Valida CPF pelos dígitos verificadores. */
export function cpfValido(value?: string): boolean {
  const d = onlyDigits(value);
  if (!d || d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatCpf(value?: string): string | undefined {
  const d = onlyDigits(value);
  if (!d || d.length !== 11) return cleanLine(value);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "não informado", "não consta", "sem e-mail"... — asserção negativa explícita. */
export function isNegativa(value?: string): boolean {
  if (!value) return false;
  const v = ascii(value).trim();
  return /^(-+|—|–|n\/?a|nao (informad[oa]|consta|possui|tem|ha|sabe)|sem\b|inexistente|nenhum|ignorad[oa]|desconhecid[oa])/.test(v);
}

// ---------- divisão em blocos ----------

function classificarTitulo(titulo: string): EntidadeTipo {
  const t = ascii(titulo);
  if (/(parte contraria|\bre[ue]s?\b|\brequerid[oa]s?\b|polo passivo|\bexecutad[oa]s?\b|\breclamad[oa]s?\b|adversa)/.test(t)) return "parte_contraria";
  if (/(terceir|testemunh|declarante|informante)/.test(t)) return "terceiros";
  if (/(\bcliente\b|\brequerente\b|\bautor(a|es)?\b|\bassistid[oa]\b|\bconstituinte\b|\boutorgante\b|polo ativo|qualificacao)/.test(t)) return "cliente";
  return "outro";
}

function isTitulo(linha: string): boolean {
  const l = linha.trim().replace(/:$/, "");
  if (!l || l.length > 60 || l.includes(":")) return false;
  const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length < 3) return false;
  return l === l.toLocaleUpperCase("pt-BR");
}

export function dividirEmBlocos(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco = { tipo: "outro", texto: "" };
  for (const linha of texto.split(/\r?\n/)) {
    if (isTitulo(linha)) {
      if (atual.texto.trim() || atual.titulo) blocos.push(atual);
      const titulo = linha.trim().replace(/:$/, "");
      atual = { tipo: classificarTitulo(titulo), titulo, texto: "" };
      continue;
    }
    atual.texto += `${linha}\n`;
  }
  if (atual.texto.trim() || atual.titulo) blocos.push(atual);
  return blocos;
}

// ---------- extração rotulada ----------

/**
 * Valor de "Rótulo: valor". Retorna `null` quando o rótulo existe mas traz
 * asserção negativa ("não informado") — diferente de `undefined` (rótulo ausente).
 */
export function extractLabeled(texto: string, labels: string[]): string | null | undefined {
  // Rótulos mais longos primeiro, para "nome completo" vencer "nome".
  const joined = [...labels].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  const re = new RegExp(`(?:^|\\n)[ \\t]*(?:${joined})[ \\t]*[:\\-–—][ \\t]*([^\\n]+)`, "i");
  const value = cleanLine(texto.match(re)?.[1]);
  if (value === undefined) return undefined;
  return isNegativa(value) ? null : value;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const FONE_RE = /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
/** Linhas com dados de pessoa jurídica: não servem para contato/RG do cliente. */
const LINHA_PJ_RE = /(cnpj|inscri[cç][aã]o estadual|\bltda\b|\bs\/a\b|\bs\.a\.|\beireli\b|concession[aá]ria)/i;

function linhasSemPJ(texto: string): string {
  return texto.split("\n").filter((l) => !LINHA_PJ_RE.test(l)).join("\n");
}

function extrairContato(texto: string, labels: string[], re: RegExp): string | undefined {
  const rotulado = extractLabeled(texto, labels);
  if (rotulado === null) return undefined; // "não informado" é resposta, não lacuna
  if (rotulado) return cleanLine(rotulado.match(re)?.[0] ?? rotulado);
  return cleanLine(linhasSemPJ(texto).match(re)?.[0]);
}

function extrairRg(texto: string): string | undefined {
  const rotulado = extractLabeled(texto, [
    "rg", "r.g.", "identidade", "documento de identidade", "cédula de identidade",
    "cedula de identidade", "carteira de identidade", "ci",
  ]);
  if (!rotulado) return undefined;
  // Rejeita se o "RG" na verdade é inscrição estadual ou CNPJ.
  if (LINHA_PJ_RE.test(rotulado)) return undefined;
  const numero = rotulado.match(/[\d.\-]*\d[\d.\-]*[Xx]?/)?.[0];
  const d = onlyDigits(numero);
  if (!d || d.length === 14) return undefined;
  return cleanLine(numero);
}

// ---------- endereço ----------

export interface EnderecoParseado {
  logradouro?: string;
  numero_end?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

const TIPO_LOGRADOURO = /^(rua|r\.|avenida|av\.?|travessa|tv\.?|estrada|estr\.?|rodovia|rod\.?|alameda|al\.?|pra[cç]a|p[cç]a\.?|largo|beco|servid[aã]o|vila|ladeira|viela|caminho|quadra|qd\.?)\b/i;

/** Decompõe "Rua X, 588, apto 2, Bairro Y, Cidade — UF, CEP 00000-000". */
export function parseEndereco(linha: string): EnderecoParseado {
  const out: EnderecoParseado = {};
  // Parênteses são comentário, não endereço.
  let resto = linha.replace(/\([^)]*\)/g, " ");
  const cep = resto.match(/\b\d{5}-?\d{3}\b/)?.[0];
  if (cep) {
    out.cep = normalizeCep(cep);
    resto = resto.replace(/\bCEP\b[:\s]*/i, " ").replace(cep, " ");
  }
  const partes = resto.split(/[,;]/).map((p) => cleanLine(p)).filter((p): p is string => Boolean(p));

  for (const parte of partes) {
    const cidadeUf = parte.match(/^(.+?)\s*[—–\-/]\s*([A-Za-z]{2})\.?$/);
    if (cidadeUf && normalizeUf(cidadeUf[2]) && !out.cidade) {
      out.cidade = cleanLine(cidadeUf[1]);
      out.uf = normalizeUf(cidadeUf[2]);
      continue;
    }
    if (/^bairro\b/i.test(parte)) {
      out.bairro = cleanLine(parte.replace(/^bairro\s*[:\-]?\s*/i, ""));
      continue;
    }
    if (!out.logradouro) {
      // Número pode vir colado: "Rua X 588" ou "Rua X nº 588".
      const colado = parte.match(/^(.*?\D)\s*(?:n[º°o]\.?\s*)?(\d+[A-Za-z]?)$/i);
      if (colado && TIPO_LOGRADOURO.test(parte) && colado[1].trim().split(/\s+/).length >= 2) {
        out.logradouro = cleanLine(colado[1].replace(/\s*n[º°o]\.?$/i, ""));
        out.numero_end = colado[2];
      } else {
        out.logradouro = parte;
      }
      continue;
    }
    if (!out.numero_end) {
      const semN = parte.replace(/^(?:n[º°o]\.?|n[uú]mero)\s*/i, "");
      const num = semN.match(/^(?:(.*?)\s+)?(?:n[º°o]\.?\s*)?(\d+[A-Za-z]?)$/i) ?? semN.match(/^(s\/?n)$/i);
      if (num) {
        out.numero_end = num[2] ?? num[1];
        // "Residencial 588": o prefixo vira complemento.
        if (num[2] && num[1]) out.complemento = cleanLine(num[1]);
        continue;
      }
    }
    if (/^(apto?\.?|apartamento|bloco|bl\.?|casa|sala|lote|lt\.?|fundos|loja|cobertura)\b/i.test(parte)) {
      out.complemento = out.complemento ? `${out.complemento}, ${parte}` : parte;
      continue;
    }
    if (!out.bairro && out.logradouro && out.numero_end) {
      out.bairro = parte;
      continue;
    }
    if (!out.cidade && out.bairro) {
      out.cidade = parte;
    }
  }
  return out;
}

// ---------- extração do cliente ----------

const NOME_LABELS = [
  "nome", "nome completo", "nome do cliente", "cliente", "requerente", "autor", "autora",
  "assistido", "assistida", "constituinte", "outorgante", "parte ativa",
];

function extrairCliente(escopo: string, blocoEscopado: boolean): ClienteDraft {
  const nomeRotulado = extractLabeled(escopo, NOME_LABELS);
  let nome = nomeRotulado || undefined;
  if (!nome && blocoEscopado) {
    // Bloco "CLIENTE" com o nome na primeira linha, sem rótulo.
    const primeira = escopo.split("\n").map((l) => l.trim()).find(Boolean);
    if (primeira && !primeira.includes(":") && primeira.split(/\s+/).length <= 8 && !/\d/.test(primeira)) {
      nome = cleanLine(primeira.replace(/[,;.]$/, ""));
    }
  }

  const cpfRotulado = extractLabeled(escopo, ["cpf", "cpf/mf", "c.p.f."]);
  const cpfs = [...(cpfRotulado ?? "").matchAll(CPF_RE), ...linhasSemPJ(escopo).matchAll(CPF_RE)].map((m) => m[0]);
  const cpf = formatCpf(cpfs.find(cpfValido));

  const enderecoLinha = extractLabeled(escopo, ["endereço", "endereco", "endereço residencial", "residência", "residencia", "domicílio", "domicilio"]);
  const endereco: EnderecoParseado = enderecoLinha ? parseEndereco(enderecoLinha) : {};
  const pick = (labels: string[], fallback?: string) => {
    const v = extractLabeled(escopo, labels);
    return v === null ? undefined : v ?? fallback;
  };

  return {
    nome,
    cpf,
    rg: extrairRg(escopo),
    email: extrairContato(escopo, ["e-mail", "email", "correio eletrônico", "correio eletronico"], EMAIL_RE),
    celular: extrairContato(escopo, ["celular", "telefone", "tel", "fone", "whatsapp", "contato"], FONE_RE),
    cep: normalizeCep(pick(["cep"], endereco.cep)),
    logradouro: pick(["logradouro", "rua", "avenida"], endereco.logradouro),
    numero_end: pick(["número", "numero", "nº", "n°"], endereco.numero_end),
    complemento: pick(["complemento"], endereco.complemento),
    bairro: pick(["bairro"], endereco.bairro),
    cidade: pick(["cidade", "município", "municipio"], endereco.cidade),
    uf: normalizeUf(pick(["uf", "estado"], endereco.uf)),
  };
}

function primeiraLinhaUtil(texto: string): string | undefined {
  return cleanLine(texto.split("\n").map((l) => l.trim()).find(Boolean));
}

export function extrairEntidades(texto: string): EntidadesExtraidas {
  const blocos = dividirEmBlocos(texto);
  const blocoCliente = blocos.find((b) => b.tipo === "cliente");
  // Sem bloco do cliente: usa tudo que NÃO é parte contrária nem terceiros.
  const escopo = blocoCliente
    ? blocoCliente.texto
    : blocos.filter((b) => b.tipo === "outro").map((b) => b.texto).join("\n");

  const blocoContraria = blocos.find((b) => b.tipo === "parte_contraria");
  const parteContraria = blocoContraria
    ? extractLabeled(blocoContraria.texto, ["nome", "razão social", "razao social"]) || primeiraLinhaUtil(blocoContraria.texto)
    : extractLabeled(escopo, ["parte contrária", "parte contraria", "réu", "reu", "ré", "requerido", "requerida", "polo passivo"]) || undefined;

  return {
    cliente: extrairCliente(escopo, Boolean(blocoCliente)),
    parte_contraria: parteContraria?.replace(/\s*\([^)]*\)\s*$/, "").trim() || undefined,
    blocos,
    clienteEscopado: Boolean(blocoCliente),
  };
}

// ---------- validação de dados vindos da IA ----------

/**
 * Remove do cliente dados que só aparecem no texto de outra entidade
 * (parte contrária, terceiros) ou que foram negados no bloco do cliente.
 * Devolve avisos do que foi descartado.
 */
export function sanearCliente(cliente: ClienteDraft, entidades: EntidadesExtraidas): { cliente: ClienteDraft; avisos: string[] } {
  const avisos: string[] = [];
  const out: ClienteDraft = { ...cliente };
  const outros = entidades.blocos.filter((b) => b.tipo === "parte_contraria" || b.tipo === "terceiros").map((b) => b.texto).join("\n");
  const doCliente = entidades.clienteEscopado
    ? entidades.blocos.filter((b) => b.tipo === "cliente").map((b) => b.texto).join("\n")
    : entidades.blocos.filter((b) => b.tipo === "outro").map((b) => b.texto).join("\n");
  const rotulos: Record<string, string> = { rg: "RG", email: "e-mail", celular: "telefone", cpf: "CPF" };

  for (const campo of ["rg", "email", "celular", "cpf"] as const) {
    const valor = cleanLine(out[campo]);
    if (!valor) continue;
    const chave = campo === "email" ? valor.toLowerCase() : onlyDigits(valor) ?? valor;
    const norm = (t: string) => (campo === "email" ? t.toLowerCase() : t.replace(/\D/g, ""));
    if (outros && norm(outros).includes(chave) && !norm(doCliente).includes(chave)) {
      delete out[campo];
      avisos.push(`Descartei o ${rotulos[campo]} "${valor}": ele pertence a outra parte do texto, não ao cliente.`);
    }
  }

  if (out.cpf && !cpfValido(out.cpf)) {
    avisos.push(`CPF "${out.cpf}" com dígito verificador inválido — confira.`);
  } else if (out.cpf) {
    out.cpf = formatCpf(out.cpf);
  }

  // Asserções negativas do bloco do cliente sempre vencem.
  if (extractLabeled(doCliente, ["e-mail", "email"]) === null) delete out.email;
  if (extractLabeled(doCliente, ["celular", "telefone", "tel", "fone", "whatsapp"]) === null) delete out.celular;
  if (extractLabeled(doCliente, ["rg", "identidade", "cédula de identidade", "cedula de identidade"]) === null) delete out.rg;

  if (out.rg && LINHA_PJ_RE.test(out.rg)) delete out.rg;
  if (out.rg && onlyDigits(out.rg)?.length === 14) delete out.rg; // CNPJ

  return { cliente: out, avisos };
}

// ---------- CEP ----------

export interface EnderecoCepLookup {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

function comparavel(value?: string): string {
  return ascii(value ?? "")
    .replace(/^(rua|r\.|avenida|av\.?|travessa|tv\.?|estrada|rodovia|alameda|praca)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * O CEP é a fonte de logradouro/bairro/cidade/UF; o texto fica só com número e complemento.
 * Sinaliza quando a rua ou o bairro do texto não batem com os do CEP.
 */
export function aplicarCep(cliente: ClienteDraft, end: EnderecoCepLookup): { cliente: ClienteDraft; avisos: string[] } {
  const avisos: string[] = [];
  const out: ClienteDraft = { ...cliente };
  const campos: Array<[keyof EnderecoCepLookup, "logradouro" | "bairro" | "cidade" | "uf", string]> = [
    ["logradouro", "logradouro", "Rua"],
    ["bairro", "bairro", "Bairro"],
    ["cidade", "cidade", "Cidade"],
    ["uf", "uf", "UF"],
  ];
  for (const [origem, destino, rotulo] of campos) {
    const doCep = cleanLine(end[origem]);
    if (!doCep) continue; // CEP geral de cidade não traz rua/bairro: mantém o texto
    const doTexto = cleanLine(out[destino]);
    if (doTexto && comparavel(doTexto) !== comparavel(doCep) && !comparavel(doCep).includes(comparavel(doTexto)) && !comparavel(doTexto).includes(comparavel(doCep))) {
      avisos.push(`${rotulo}: o texto diz "${doTexto}", mas o CEP ${out.cep} indica "${doCep}". Usei o do CEP — confira.`);
    }
    out[destino] = doCep;
  }
  return { cliente: out, avisos };
}

// ---------- processos ----------

export const CNJ_RE = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;
export const INFO_SEM_CNJ = "Nenhum número CNJ no texto: a importação vai salvar só o cadastro do cliente. Se houver processo, adicione-o abaixo.";
