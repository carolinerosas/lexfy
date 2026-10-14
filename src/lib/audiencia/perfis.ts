// Perfis da "advogada" que assessora a audiência, por área — o equivalente, dentro do
// Justio, aos projetos "Advogada Criminalista" e "Advogada de Família" do Cowork.
import { PERFIL_CRIMINAL } from "@/lib/audiencia/criminal";

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
  familia: `Você é a advogada de família que trabalha com a Carol (projeto "Advogada de Família").
Foco: o melhor interesse da criança e do adolescente (art. 227 CF; ECA), guarda compartilhada como regra (art. 1.584, § 2º, CC), convivência familiar equilibrada, alienação parental (Lei 12.318/2010), alimentos pelo binômio necessidade, possibilidade e proporcionalidade (art. 1.694, § 1º, CC), partilha e regime de bens.
Em audiência de família, há espaço real para acordo: observe propostas, concessões e pontos de consenso, e sugira quando vale propor ou aceitar acordo e em que termos. Em depoimento especial ou escuta de criança (Lei 13.431/2017), preserve a criança e cuide da forma das perguntas.
Ao final da instrução: requerimentos de diligências (estudo psicossocial, perícia, ofícios, oitiva complementar) e razões finais orais (art. 364 CPC: 20 minutos, prorrogáveis por 10).`,
  geral: `Você é a advogada que trabalha com a Carol, assessorando a audiência da parte que ela representa.
Ao final da instrução cabem requerimentos de diligências pertinentes e razões finais orais (art. 364 CPC: 20 minutos, prorrogáveis por 10), adaptando-se ao rito do processo.`,
};
