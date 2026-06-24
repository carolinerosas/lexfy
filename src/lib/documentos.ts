import { supabase } from "./supabase";

const BUCKET = "documentos";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const USER_ID = "lexfy_shared";

export type DocumentoContexto = "clientes" | "processos";

export interface DocumentoArquivo {
  id: string;
  nome: string;
  referencia: string;
  nomeOriginal: string;
  caminho: string;
  tamanho: number;
  criadoEm?: string;
}

interface DocumentoRow {
  id: string;
  nome: string;
  referencia: string;
  arquivo_nome: string;
  caminho: string;
  tamanho: number;
  created_at?: string | null;
}

function pasta(contexto: DocumentoContexto, registroId: string): string {
  return `${USER_ID}/${contexto}/${registroId}`;
}

function nomeSeguro(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base || "documento.pdf";
}

function documentoError(message: string): Error {
  if (/bucket.*not found|relation.*documentos|schema cache|PGRST205|not found/i.test(message)) {
    return new Error("O armazenamento de documentos ainda não foi habilitado no Supabase.");
  }
  return new Error(message);
}

export async function listarDocumentos(contexto: DocumentoContexto, registroId: string): Promise<DocumentoArquivo[]> {
  const { data, error } = await supabase
    .from("documentos")
    .select("id, nome, referencia, arquivo_nome, caminho, tamanho, created_at")
    .eq("contexto", contexto)
    .eq("registro_id", registroId)
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) throw documentoError(error.message);

  return ((data ?? []) as DocumentoRow[]).map((row) => ({
    id: row.id,
    nome: row.nome,
    referencia: row.referencia,
    nomeOriginal: row.arquivo_nome,
    caminho: row.caminho,
    tamanho: Number(row.tamanho ?? 0),
    criadoEm: row.created_at ?? undefined,
  }));
}

export async function anexarDocumento(input: {
  contexto: DocumentoContexto;
  registroId: string;
  arquivo: File;
  nome: string;
  referencia: string;
}): Promise<void> {
  const { contexto, registroId, arquivo } = input;
  const nome = input.nome.trim();
  const referencia = input.referencia.trim();
  const pdfValido = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  if (!nome) throw new Error("Informe o nome do documento.");
  if (!referencia) throw new Error("Informe uma referência para o documento.");
  if (!pdfValido) throw new Error("Selecione um arquivo PDF.");
  if (arquivo.size > MAX_FILE_SIZE) throw new Error("O PDF deve ter no máximo 20 MB.");

  const id = crypto.randomUUID();
  const caminho = `${pasta(contexto, registroId)}/${Date.now()}_${id}_${nomeSeguro(arquivo.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw documentoError(uploadError.message);

  const { error: insertError } = await supabase.from("documentos").insert({
    id,
    contexto,
    registro_id: registroId,
    nome,
    referencia,
    arquivo_nome: arquivo.name,
    caminho,
    tamanho: arquivo.size,
    user_id: USER_ID,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw documentoError(insertError.message);
  }
}

export async function urlDocumento(caminho: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(
    caminho,
    60 * 10,
    download ? { download: true } : undefined
  );
  if (error) throw documentoError(error.message);
  return data.signedUrl;
}

export async function excluirDocumento(documento: Pick<DocumentoArquivo, "id" | "caminho">): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([documento.caminho]);
  if (storageError) throw documentoError(storageError.message);
  const { error } = await supabase.from("documentos").delete().eq("id", documento.id).eq("user_id", USER_ID);
  if (error) throw documentoError(error.message);
}
