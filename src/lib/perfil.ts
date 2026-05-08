const PERFIL_KEY = "lexfy_perfil_advogado";

export interface PerfilAdvogado {
  nome: string;
  oab_numero: string;
  oab_uf: string;
}

export function getPerfilAdvogado(): PerfilAdvogado {
  if (typeof window === "undefined") return { nome: "", oab_numero: "", oab_uf: "RJ" };
  try {
    return JSON.parse(localStorage.getItem(PERFIL_KEY) ?? "{}") as PerfilAdvogado;
  } catch {
    return { nome: "", oab_numero: "", oab_uf: "RJ" };
  }
}

export function setPerfilAdvogado(perfil: PerfilAdvogado): void {
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}
