import { supabase } from "./supabase";

const PERFIL_KEY = "justio_perfil_advogado";
const PERFIL_KEY_OLD = "lexfy_perfil_advogado";
const PERFIL_COOKIE = "justio_perfil_advogado";
const USER_ID = "lexfy_shared";
const DEFAULT_PERFIL: PerfilAdvogado = {
  nome: "",
  oab_numero: "",
  oab_uf: "RJ",
  cpf: "",
  nacionalidade: "",
  estado_civil: "",
  endereco_escritorio: "",
};

export interface PerfilAdvogado {
  nome: string;
  oab_numero: string;
  oab_uf: string;
  cpf?: string;
  nacionalidade?: string;
  estado_civil?: string;
  endereco_escritorio?: string;
}

export interface PerfilSaveResult {
  perfil: PerfilAdvogado;
  synced: boolean;
  error?: string;
}

function normalizePerfil(perfil: Partial<PerfilAdvogado> | null | undefined): PerfilAdvogado {
  return {
    nome: perfil?.nome?.trim() ?? "",
    oab_numero: perfil?.oab_numero?.trim() ?? "",
    oab_uf: (perfil?.oab_uf?.trim().toUpperCase() || "RJ"),
    cpf: perfil?.cpf?.trim() ?? "",
    nacionalidade: perfil?.nacionalidade?.trim() ?? "",
    estado_civil: perfil?.estado_civil?.trim() ?? "",
    endereco_escritorio: perfil?.endereco_escritorio?.trim() ?? "",
  };
}

function hasPerfil(perfil: Partial<PerfilAdvogado> | null | undefined): boolean {
  return !!(perfil?.nome?.trim() || perfil?.oab_numero?.trim());
}

function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (
    (error as { code?: string }).code === "PGRST205" ||
    (error as { code?: string }).code === "42P01"
  );
}

function getCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
}

function cookieDomain(): string {
  const host = window.location.hostname;
  return host === "justio.com.br" || host.endsWith(".justio.com.br") ? "; domain=.justio.com.br" : "";
}

function parsePerfil(raw: string | null | undefined): Partial<PerfilAdvogado> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<PerfilAdvogado>;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw)) as Partial<PerfilAdvogado>;
    } catch {
      return {};
    }
  }
}

export function getPerfilAdvogado(): PerfilAdvogado {
  if (typeof window === "undefined") return DEFAULT_PERFIL;

  // Migrate old key
  const old = localStorage.getItem(PERFIL_KEY_OLD);
  if (old && !localStorage.getItem(PERFIL_KEY)) {
    localStorage.setItem(PERFIL_KEY, old);
    localStorage.removeItem(PERFIL_KEY_OLD);
  }

  const stored = parsePerfil(localStorage.getItem(PERFIL_KEY));
  const fromCookie = parsePerfil(getCookie(PERFIL_COOKIE));
  const perfil = normalizePerfil({ ...DEFAULT_PERFIL, ...fromCookie, ...stored });

  if (hasPerfil(perfil)) {
    setPerfilAdvogado(perfil);
  }

  return perfil;
}

export function setPerfilAdvogado(perfil: PerfilAdvogado): void {
  if (typeof window === "undefined") return;
  const normalized = normalizePerfil(perfil);
  const value = JSON.stringify(normalized);

  localStorage.setItem(PERFIL_KEY, value);
  document.cookie = `${PERFIL_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax${cookieDomain()}`;
}

export async function getPerfilAdvogadoCloud(): Promise<PerfilAdvogado | undefined> {
  const { data, error } = await supabase
    .from("perfil_advogado")
    .select("nome,oab_numero,oab_uf,cpf,nacionalidade,estado_civil,endereco_escritorio")
    .eq("user_id", USER_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return undefined;
    throw error;
  }

  const perfil = normalizePerfil(data);
  if (hasPerfil(perfil)) {
    setPerfilAdvogado(perfil);
    return perfil;
  }

  return undefined;
}

export async function savePerfilAdvogadoCloud(perfil: PerfilAdvogado): Promise<PerfilSaveResult> {
  const normalized = normalizePerfil(perfil);
  setPerfilAdvogado(normalized);

  const { error } = await supabase
    .from("perfil_advogado")
    .upsert({
      id: USER_ID,
      user_id: USER_ID,
      ...normalized,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) {
    return {
      perfil: normalized,
      synced: false,
      error: isMissingTable(error)
        ? "A tabela perfil_advogado ainda nao existe no Supabase."
        : error.message,
    };
  }

  return { perfil: normalized, synced: true };
}

export async function loadPerfilAdvogado(): Promise<PerfilAdvogado> {
  const local = getPerfilAdvogado();

  try {
    const cloud = await getPerfilAdvogadoCloud();
    if (cloud) return cloud;

    if (hasPerfil(local)) {
      await savePerfilAdvogadoCloud(local);
    }
  } catch {
    // O perfil local continua funcionando mesmo se a nuvem estiver indisponivel.
  }

  return local;
}
