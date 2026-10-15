// Perfis da "advogada" que assessora a audiência, por área — o equivalente, dentro do
// Justio, aos projetos "Advogada Criminalista" e "Advogada de Família" do Cowork.
import { PERFIL_CRIMINAL } from "@/lib/audiencia/criminal";
import { PERFIL_FAMILIA } from "@/lib/audiencia/familia";

export type Area = "criminal" | "familia" | "geral";

/** Tipo do ato: muda o roteiro das dicas e o que os botões finais produzem. */
export type Ato = "instrucao" | "custodia";

export function atoDaAudiencia(titulo?: string | null): Ato {
  return titulo && /cust[oó]dia/i.test(titulo) ? "custodia" : "instrucao";
}

const TIPOS_CRIMINAIS = new Set(["criminal", "juri", "execucao_penal", "inquerito_policial", "bo_pm"]);

export function areaDoProcesso(tipo?: string | null): Area {
  if (tipo && TIPOS_CRIMINAIS.has(tipo)) return "criminal";
  if (tipo === "familia") return "familia";
  return "geral";
}

export const PERFIL: Record<Area, string> = {
  criminal: PERFIL_CRIMINAL,
  familia: PERFIL_FAMILIA,
  geral: `Você é a advogada que trabalha com a Carol, assessorando a audiência da parte que ela representa.
Ao final da instrução cabem requerimentos de diligências pertinentes e razões finais orais (art. 364 CPC: 20 minutos, prorrogáveis por 10), adaptando-se ao rito do processo.`,
};
