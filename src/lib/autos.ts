import type { PDFPageProxy } from "pdfjs-dist";
import { supabase, urlStorageDireta } from "./supabase";

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

/** Imagem JPEG de uma página (para o OCR das páginas escaneadas). */
async function imagemDaPagina(pagina: PDFPageProxy): Promise<string> {
  const viewport = pagina.getViewport({ scale: 1.6 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.7);
}

async function lerImagem(imagem: string): Promise<string> {
  const res = await fetch("/api/autos/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imagem }),
  });
  if (!res.ok) return "";
  return (((await res.json()) as { texto?: string }).texto ?? "").trim();
}

export type EtapaAutos = "texto" | "ocr";

/**
 * Extrai o texto de cada página e grava no Justio. Páginas escaneadas (sem texto no PDF)
 * passam pelo OCR: a imagem da página vai para /api/autos/ocr e o texto lido é gravado.
 * `progresso` recebe (feitas, total, etapa).
 */
export async function importarAutos(
  processoId: string,
  arquivo: File,
  progresso?: (feitas: number, total: number, etapa: EtapaAutos) => void
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

  const escaneadas: number[] = [];
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
      if (texto.length < 20) escaneadas.push(n);
      lote.push({ arquivo_id: id, processo_id: processoId, pagina: n, texto });
      if (lote.length === LOTE_PAGINAS || n === total) {
        const { error } = await supabase.from("autos_paginas").insert(lote);
        if (error) throw new Error(error.message);
        lote = [];
      }
      progresso?.(n, total, "texto");
    }
  } catch (e) {
    await excluirAutos({ id, caminho });
    throw e;
  }

  // OCR das escaneadas, 4 por vez. Página que falhar continua sem texto (não derruba o envio).
  let lidas = 0;
  let semTexto = 0;
  const fila = [...escaneadas];
  async function trabalhador() {
    for (let n = fila.shift(); n !== undefined; n = fila.shift()) {
      let texto = "";
      try {
        texto = await lerImagem(await imagemDaPagina(await pdf.getPage(n)));
      } catch {
        texto = "";
      }
      if (texto.length >= 20) {
        await supabase.from("autos_paginas").update({ texto }).eq("arquivo_id", id).eq("pagina", n);
      } else {
        semTexto++;
      }
      progresso?.(++lidas, escaneadas.length, "ocr");
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, escaneadas.length) }, trabalhador));

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
  return urlStorageDireta(data.signedUrl);
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
