const PERFIL_KEY = "justio_perfil_advogado";
const PERFIL_KEY_OLD = "lexfy_perfil_advogado";
const PERFIL_COOKIE = "justio_perfil_advogado";
const DEFAULT_PERFIL: PerfilAdvogado = { nome: "", oab_numero: "", oab_uf: "RJ" };

export interface PerfilAdvogado {
  nome: string;
  oab_numero: string;
  oab_uf: string;
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
  const perfil = { ...DEFAULT_PERFIL, ...fromCookie, ...stored };

  if (perfil.nome || perfil.oab_numero) {
    setPerfilAdvogado(perfil);
  }

  return perfil;
}

export function setPerfilAdvogado(perfil: PerfilAdvogado): void {
  const normalized: PerfilAdvogado = {
    nome: perfil.nome?.trim() ?? "",
    oab_numero: perfil.oab_numero?.trim() ?? "",
    oab_uf: (perfil.oab_uf?.trim().toUpperCase() || "RJ"),
  };
  const value = JSON.stringify(normalized);

  localStorage.setItem(PERFIL_KEY, value);
  document.cookie = `${PERFIL_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax${cookieDomain()}`;
}
