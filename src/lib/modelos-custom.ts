import { supabase } from "./supabase";
import { TOKENS_AUTO } from "./tokens-documento";

const BUCKET = "documentos";
const USER_ID = "lexfy_shared";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ModeloCustom {
  id: string;
  nome: string;
  arquivoNome: string;
  caminho: string;
  criadoEm?: string;
}

interface ModeloRow {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  caminho: string;
  created_at?: string | null;
}

function modeloError(message: string): Error {
  if (/bucket.*not found|relation.*modelos|schema cache|PGRST205|not found/i.test(message)) {
    return new Error("Os modelos ainda não foram habilitados no Supabase.");
  }
  return new Error(message);
}

function nomeSeguro(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || "modelo.docx";
}

export async function listarModelos(): Promise<ModeloCustom[]> {
  const { data, error } = await supabase
    .from("modelos_documentos")
    .select("id, nome, arquivo_nome, caminho, created_at")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) throw modeloError(error.message);

  return ((data ?? []) as ModeloRow[]).map((row) => ({
    id: row.id,
    nome: row.nome,
    arquivoNome: row.arquivo_nome ?? "",
    caminho: row.caminho,
    criadoEm: row.created_at ?? undefined,
  }));
}

export async function anexarModelo(input: { arquivo: File; nome: string }): Promise<void> {
  const nome = input.nome.trim();
  const arquivo = input.arquivo;
  const docxValido =
    arquivo.type === DOCX_MIME || arquivo.name.toLowerCase().endsWith(".docx");
  if (!nome) throw new Error("Dê um nome ao modelo.");
  if (!docxValido) throw new Error("Selecione um arquivo .docx (Word).");
  if (arquivo.size > MAX_FILE_SIZE) throw new Error("O modelo deve ter no máximo 10 MB.");

  const id = crypto.randomUUID();
  const caminho = `${USER_ID}/modelos/${Date.now()}_${id}_${nomeSeguro(arquivo.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: DOCX_MIME,
    upsert: false,
  });
  if (uploadError) throw modeloError(uploadError.message);

  const { error: insertError } = await supabase.from("modelos_documentos").insert({
    id,
    user_id: USER_ID,
    nome,
    arquivo_nome: arquivo.name,
    caminho,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw modeloError(insertError.message);
  }
}

export async function excluirModelo(modelo: Pick<ModeloCustom, "id" | "caminho">): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([modelo.caminho]);
  if (storageError) throw modeloError(storageError.message);
  const { error } = await supabase
    .from("modelos_documentos")
    .delete()
    .eq("id", modelo.id)
    .eq("user_id", USER_ID);
  if (error) throw modeloError(error.message);
}

/**
 * Lê o modelo e retorna os marcadores que o Justio NÃO preenche sozinho
 * (ex.: {{processo}}, {{acao}}, {{valor}}) — esses serão perguntados na hora de gerar.
 */
export async function inspecionarModelo(caminho: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) throw modeloError(error?.message ?? "Não consegui ler o modelo.");
  const buffer = await data.arrayBuffer();

  const PizZip = (await import("pizzip")).default;
  let texto: string;
  try {
    const zip = new PizZip(buffer);
    // Remove as tags XML para juntar marcadores que o Word possa ter quebrado entre runs.
    texto = zip.file("word/document.xml")!.asText().replace(/<[^>]+>/g, "");
  } catch {
    throw new Error("Arquivo de modelo inválido — verifique se é um .docx do Word.");
  }

  const conhecidos = new Set(TOKENS_AUTO);
  const encontrados = new Set<string>();
  const re = /\{\{\s*([\w]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const nome = m[1];
    if (!conhecidos.has(nome)) encontrados.add(nome);
  }
  return Array.from(encontrados);
}

/**
 * Preenche o modelo e devolve o conteúdo como HTML editável (para o editor na tela).
 * Marcadores não reconhecidos viram [marcador] para a Carol completar na tela.
 */
export async function preencherModeloHtml(
  caminho: string,
  dados: Record<string, string>
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) throw modeloError(error?.message ?? "Não consegui baixar o modelo.");
  const buffer = await data.arrayBuffer();

  const PizZip = (await import("pizzip")).default;
  const Docxtemplater = (await import("docxtemplater")).default;

  let zip: InstanceType<typeof PizZip>;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new Error("Arquivo de modelo inválido — verifique se é um .docx do Word.");
  }

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part) => {
      const value = (part as { value?: string }).value;
      return value ? `[${value}]` : "";
    },
  });
  doc.render(dados);
  const arrayBuffer = doc.getZip().generate({ type: "arraybuffer" });

  const mammothMod = (await import("mammoth")) as unknown as {
    default?: { convertToHtml: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
    convertToHtml?: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const mammoth = mammothMod.default ?? mammothMod;
  const result = await mammoth.convertToHtml!({ arrayBuffer });
  return result.value;
}

/**
 * Baixa o modelo .docx, substitui os {{marcadores}} pelos dados e devolve o documento pronto.
 * Marcadores não reconhecidos são mantidos no texto, para a Carol completar manualmente.
 */
export async function preencherModelo(
  caminho: string,
  dados: Record<string, string>
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) throw modeloError(error?.message ?? "Não consegui baixar o modelo.");
  const buffer = await data.arrayBuffer();

  const PizZip = (await import("pizzip")).default;
  const Docxtemplater = (await import("docxtemplater")).default;

  let zip: InstanceType<typeof PizZip>;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new Error("Arquivo de modelo inválido — verifique se é um .docx do Word.");
  }

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part) => {
      const value = (part as { value?: string }).value;
      return value ? `{{${value}}}` : "";
    },
  });

  doc.render(dados);

  return doc.getZip().generate({ type: "blob", mimeType: DOCX_MIME }) as Blob;
}
