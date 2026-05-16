const PERFIL_KEY = "justio_perfil_advogado";
const PERFIL_KEY_OLD = "lexfy_perfil_advogado";

export interface PerfilAdvogado {
  nome: string;
  oab_numero: string;
  oab_uf: string;
}

export function getPerfilAdvogado(): PerfilAdvogado {
  if (typeof window === "undefined") return { nome: "", oab_numero: "", oab_uf: "RJ" };
  // Migrate old key
  const old = localStorage.getItem(PERFIL_KEY_OLD);
  if (old && !localStorage.getItem(PERFIL_KEY)) {
    localStorage.setItem(PERFIL_KEY, old);
    localStorage.removeItem(PERFIL_KEY_OLD);
  }
  try {
    return JSON.parse(localStorage.getItem(PERFIL_KEY) ?? "{}") as PerfilAdvogado;
  } catch {
    return { nome: "", oab_numero: "", oab_uf: "RJ" };
  }
}

export function setPerfilAdvogado(perfil: PerfilAdvogado): void {
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}
