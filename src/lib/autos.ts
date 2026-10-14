import { supabase } from "./supabase";

// Autos do processo em PDF: o navegador extrai o texto página por página e o Justio guarda
// SÓ o texto (decisão da Carol: gastar o mínimo de espaço). O PDF continua no PC/OneDrive.
// O texto é pesquisável e é o que a audiência ao vivo consulta.

const BUCKET = "documentos";
const USER_ID = "lexfy_shared";
const LOTE_PAGINAS = 50;

export interface AutosArquivo {
  id: string;
  processo_id: string;
  nome: string;
  paginas: number;
  paginas_sem_texto: number;
  caminho?: string | null;
  tamanho?: number | null;
  created_at: string;
}

export interface TrechoAutos {
  arquivo: string;
  pagina: number;
  trecho: string;
}

export async function listarAutos(processoId: string): Promise<AutosArquivo[]> {
  const { data, error } = await supabase
    .from("autos_arquivos")
    .select("*")
    .eq("processo_id", processoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutosArquivo[];
}

async function carregarPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

/** Extrai o texto de cada página e grava no Justio. `progresso` recebe (feitas, total). */
export async function importarAutos(
  processoId: string,
  arquivo: File,
  progresso?: (feitas: number, total: number) => void
): Promise<AutosArquivo> {
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) throw new Error("Selecione um arquivo PDF.");


  const pdfjs = await carregarPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const total = pdf.numPages;

  const id = crypto.randomUUID();
  const caminho: string | null = null;

  const { error: erroArquivo } = await supabase.from("autos_arquivos").insert({
    id,
    processo_id: processoId,
    nome: arquivo.name,
    paginas: total,
    caminho,
    tamanho: arquivo.size,
    user_id: USER_ID,
  });
  if (erroArquivo) throw new Error(erroArquivo.message);

  let semTexto = 0;
  let lote: { arquivo_id: string; processo_id: string; pagina: number; texto: string }[] = [];
  try {
    for (let n = 1; n <= total; n++) {
      const pagina = await pdf.getPage(n);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim();
      if (texto.length < 20) semTexto++;
      lote.push({ arquivo_id: id, processo_id: processoId, pagina: n, texto });
      if (lote.length === LOTE_PAGINAS || n === total) {
        const { error } = await supabase.from("autos_paginas").insert(lote);
        if (error) throw new Error(error.message);
        lote = [];
      }
      progresso?.(n, total);
    }
  } catch (e) {
    await excluirAutos({ id, caminho });
    throw e;
  }

  await supabase.from("autos_arquivos").update({ paginas_sem_texto: semTexto }).eq("id", id);
  return {
    id,
    processo_id: processoId,
    nome: arquivo.name,
    paginas: total,
    paginas_sem_texto: semTexto,
    caminho,
    tamanho: arquivo.size,
    created_at: new Date().toISOString(),
  };
}

export async function excluirAutos(a: Pick<AutosArquivo, "id" | "caminho">): Promise<void> {
  if (a.caminho) await supabase.storage.from(BUCKET).remove([a.caminho]);
  const { error } = await supabase.from("autos_arquivos").delete().eq("id", a.id);
  if (error) throw new Error(error.message);
}

export async function urlAutos(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Busca por palavras nos autos (busca textual em português, ignora acentos/plurais). */
export async function buscarAutos(processoId: string, termos: string, limite = 6): Promise<TrechoAutos[]> {
  const { data, error } = await supabase.rpc("buscar_autos", { p_processo: processoId, p_q: termos, p_limite: limite });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { arquivo: string; pagina: number; trecho: string }[]).map((r) => ({
    arquivo: r.arquivo,
    pagina: r.pagina,
    trecho: r.trecho,
  }));
}
