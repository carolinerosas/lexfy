const SYNC_LOCAL_URL_KEY = "justio_sync_local_url";
const SYNC_LOCAL_KEY_KEY = "justio_sync_local_key";
const DEFAULT_SYNC_LOCAL_URL = "http://127.0.0.1:4477";

export interface SyncLocalMovimento {
  data: string;
  descricao: string;
  fonte?: string;
}

export interface SyncLocalProcessoResponse {
  status?: "ok" | "needs_interaction" | "unsupported";
  movimentos?: SyncLocalMovimento[];
  message?: string;
  url?: string;
  sistema?: string;
}

export interface SyncLocalProcessoEncontrado {
  numero: string;
  tribunal?: string;
  sistema?: string;
  classe?: string;
  orgao?: string;
  ultima_publicacao?: string;
  total_publicacoes?: number;
}

export interface SyncLocalTribunalProcesso {
  numero: string;
  titulo?: string;
  cliente_nome?: string;
  parte_contraria?: string;
  tribunal?: string;
  uf?: string;
  sistema?: string;
  classe?: string;
  orgao?: string;
  vara?: string;
  comarca?: string;
  fase?: string;
  tipo?: string;
  data_distribuicao?: string;
  url?: string;
  origem?: string;
  personagens?: { tipo?: string; nome?: string }[];
}

export function getSyncLocalUrl(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_SYNC_LOCAL_URL || DEFAULT_SYNC_LOCAL_URL;
  return localStorage.getItem(SYNC_LOCAL_URL_KEY) || process.env.NEXT_PUBLIC_SYNC_LOCAL_URL || DEFAULT_SYNC_LOCAL_URL;
}

export function setSyncLocalUrl(url: string): void {
  localStorage.setItem(SYNC_LOCAL_URL_KEY, url.trim() || DEFAULT_SYNC_LOCAL_URL);
}

export function getSyncLocalKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SYNC_LOCAL_KEY_KEY) || "";
}

export function setSyncLocalKey(key: string): void {
  localStorage.setItem(SYNC_LOCAL_KEY_KEY, key.trim());
}

function headers(): Record<string, string> {
  const key = getSyncLocalKey();
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-justio-sync-key": key } : {}),
  };
}

export async function testarSyncLocal(url = getSyncLocalUrl()): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: Boolean(data.ok), message: data.service || "justio-sync-local" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Agente local indisponivel" };
  }
}

export async function buscarMovimentosSyncLocal(input: {
  numero: string;
  tribunal?: string;
  sistema?: string;
}): Promise<SyncLocalProcessoResponse | null> {
  const url = getSyncLocalUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${url}/sync/processo`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SyncLocalProcessoResponse;
  } catch {
    return null;
  }
}

export async function descobrirProcessosDjenSyncLocal(input: {
  nome?: string;
  oabNumero?: string;
  oabUF?: string;
  dias?: number;
}): Promise<SyncLocalProcessoEncontrado[]> {
  const url = getSyncLocalUrl().replace(/\/$/, "");
  const res = await fetch(`${url}/djen/processos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) {
    throw new Error(`Sync Local HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.processos) ? data.processos : [];
}

export async function descobrirProcessosTribunaisSyncLocal(input: {
  nome?: string;
  oabNumero?: string;
  oabUF?: string;
  tribunal?: "tjrj" | string;
  anoInicial?: number;
  anoFinal?: number;
}): Promise<SyncLocalTribunalProcesso[]> {
  const url = getSyncLocalUrl().replace(/\/$/, "");
  const tribunal = input.tribunal || "tjrj";
  const res = await fetch(`${url}/tribunais/${tribunal}/processos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Sync Local HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.processos) ? data.processos : [];
}
