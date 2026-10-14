import { createClient } from "@supabase/supabase-js";

// O banco só aceita a chave secreta (RLS sem policies públicas).
// - No servidor (rotas /api, bot do Telegram): fala direto com o Supabase usando SUPABASE_SECRET_KEY.
// - No navegador: fala com /api/supabase, que confere o login (cookie) e repassa com a chave secreta.
//   Nenhuma chave do Supabase vai para o navegador.

export const SUPABASE_URL = "https://upwckimpkpxfzejrupkg.supabase.co";
export const SUPABASE_PROXY_PATH = "/api/supabase";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const noNavegador = typeof window !== "undefined";

function criarCliente() {
  if (noNavegador) {
    // A chave aqui é só um marcador: o proxy descarta e usa a secreta.
    return createClient(`${window.location.origin}${SUPABASE_PROXY_PATH}`, "via-proxy", NO_SESSION);
  }
  // No build/SSR a variável pode não existir; o erro aparece na primeira consulta, não no import.
  return createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? "sem-chave-configurada", NO_SESSION);
}

export const supabase = criarCliente();

/** Links assinados do Storage apontam direto para o Supabase (o token do link basta; não passa pela Vercel). */
export function urlStorageDireta(signedUrl: string): string {
  if (!noNavegador) return signedUrl;
  const viaProxy = `${window.location.origin}${SUPABASE_PROXY_PATH}`;
  return signedUrl.startsWith(viaProxy) ? SUPABASE_URL + signedUrl.slice(viaProxy.length) : signedUrl;
}

/** Baixa um arquivo do Storage por link assinado (evita o limite de tamanho das funções da Vercel). */
export async function baixarStorage(bucket: string, caminho: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, 60);
  if (error || !data) throw new Error(error?.message ?? "Não consegui gerar o link do arquivo.");
  const res = await fetch(urlStorageDireta(data.signedUrl));
  if (!res.ok) throw new Error(`Falha ao baixar o arquivo (${res.status}).`);
  return res.blob();
}

/**
 * Envia um arquivo ao Storage: o servidor gera um link de upload assinado e o navegador
 * manda o arquivo direto ao Supabase (PDFs de até 20 MB não cabem numa função da Vercel).
 */
export async function enviarStorage(
  bucket: string,
  caminho: string,
  arquivo: Blob,
  contentType: string
): Promise<{ error: { message: string } | null }> {
  if (!noNavegador) {
    const { error } = await supabase.storage.from(bucket).upload(caminho, arquivo, { contentType, upsert: false });
    return { error };
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(caminho);
  if (error || !data) return { error: error ?? { message: "Não consegui preparar o envio do arquivo." } };
  const res = await fetch(urlStorageDireta(data.signedUrl), {
    method: "PUT",
    headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "max-age=3600" },
    body: arquivo,
  });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null) as { message?: string; error?: string } | null;
    return { error: { message: corpo?.message ?? corpo?.error ?? `Falha no envio (${res.status}).` } };
  }
  return { error: null };
}
