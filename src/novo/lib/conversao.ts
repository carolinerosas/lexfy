// Da ação penal (Criminal ou Júri) para a execução penal: leva a dosimetria da sentença
// para a ficha da execução e para o crime da aba de cálculo.
import { NATUREZAS, CONDICOES } from "./execucao";
import type { Caso, CrimeExec } from "./types";

/** "5 anos, 10 meses e 3 dias" → { anos: 5, meses: 10, dias: 3 }. Null quando não há número reconhecível. */
export function lerPena(texto?: unknown): { anos: number; meses: number; dias: number } | null {
  const t = String(texto ?? "").toLowerCase();
  const pega = (re: RegExp) => Number(re.exec(t)?.[1] ?? 0);
  const anos = pega(/(\d+)\s*(?:anos?|a\b)/), meses = pega(/(\d+)\s*(?:m[eê]s|meses|m\b)/), dias = pega(/(\d+)\s*(?:dias?|d\b)/);
  return anos || meses || dias ? { anos, meses, dias } : null;
}

/** Detração em dias a partir de "9 meses e 20 dias" (ano de 365 e mês de 30 dias, como no cálculo da execução). */
export function diasDe(texto?: unknown): number | undefined {
  const n = Number(String(texto ?? "").trim());
  if (Number.isFinite(n) && String(texto ?? "").trim() !== "") return n;
  const p = lerPena(texto);
  return p ? p.anos * 365 + p.meses * 30 + p.dias : undefined;
}

const sim = (v: unknown) => String(v ?? "") === "Sim";
const nao = (v: unknown) => String(v ?? "") === "Não";
const linhas = (v: unknown) => String(v ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** O caso de execução (sem id) que nasce da sentença condenatória, e o que não deu para levar. */
export function execucaoDaSentenca(c: Caso): { caso: Omit<Caso, "id">; avisos: string[] } {
  const d = c.dados;
  const avisos: string[] = [];
  const pena = lerPena(d.pena);
  if (!pena) avisos.push("A pena definitiva não está preenchida em anos, meses e dias: complete o crime na aba de cálculo.");
  const natureza = sim(d.hediondo) ? NATUREZAS[2] : sim(d.violencia) ? NATUREZAS[1] : nao(d.violencia) ? NATUREZAS[0] : undefined;
  if (!natureza) avisos.push("Natureza do crime (hediondo, com ou sem violência) não informada na sentença: escolha no crime para o sistema sugerir as frações.");
  const reinc = String(d.reincidencia ?? "");
  const condicao = (CONDICOES as readonly string[]).includes(reinc) ? reinc
    : linhas(d.agravantes).some((a) => /reincid/i.test(a)) ? "Reincidente" : undefined;
  if (!condicao) avisos.push("Reincidência não informada: confira no crime.");
  const detracao = diasDe(d.detracao);
  const crimeNome = linhas(d.tipo_penal).join("; ") || String(d.imputacao ?? "") || c.titulo;
  const dosimetria = [
    d.pena_base && `Pena-base: ${d.pena_base}`, d.circunstancias_judiciais && `Circunstâncias judiciais: ${d.circunstancias_judiciais}`,
    d.agravantes && `Agravantes: ${linhas(d.agravantes).join("; ")}`, d.atenuantes && `Atenuantes: ${linhas(d.atenuantes).join("; ")}`,
    d.pena_intermediaria && `Pena intermediária: ${d.pena_intermediaria}`, d.causas_aumento && `Causas de aumento: ${linhas(d.causas_aumento).join("; ")}`,
    d.causas_diminuicao && `Causas de diminuição: ${linhas(d.causas_diminuicao).join("; ")}`, d.concurso && d.concurso !== "Não houve" && `Concurso: ${d.concurso}`,
    d.multa && `Multa: ${d.multa}`, d.restritivas && `Restritivas: ${linhas(d.restritivas).join("; ")}`, d.regime && `Regime inicial: ${d.regime}`,
  ].filter(Boolean).join("\n");

  const crime: CrimeExec = {
    id: crypto.randomUUID(), crime: crimeNome, processo: c.numero || undefined, vara: c.orgao, anos: pena?.anos ?? 0, meses: pena?.meses ?? 0, dias: pena?.dias ?? 0,
    natureza, condicao, data_fato: d.fato_data ? String(d.fato_data) : undefined, transito: d.transito ? String(d.transito) : undefined,
    obs: dosimetria ? `Dosimetria da sentença${d.sentenca_data ? ` de ${String(d.sentenca_data).split("-").reverse().join("/")}` : ""}:\n${dosimetria}` : undefined,
  };
  if (!d.transito) avisos.push("Sem data de trânsito em julgado: a execução fica provisória até ela ser lançada.");

  const preso = /pris|preso|domicil|monitor/i.test(String(d.situacao ?? ""));
  const regime = ["Fechado", "Semiaberto", "Aberto"].includes(String(d.regime ?? "")) ? String(d.regime) : undefined;
  const dados: Caso["dados"] = Object.fromEntries(Object.entries({
    pena: d.pena, regime, unidade: d.unidade, detracao, inicio_cumprimento: preso ? d.prisao_data : undefined,
  }).filter(([, v]) => v !== undefined && v !== "")) as Caso["dados"];

  return {
    avisos,
    caso: {
      natureza: "judicial", area: "execucao_penal", numero: "", titulo: `Execução penal: ${crimeNome}`, status: "ativo", fase: 0,
      comarca: c.comarca, uf: c.uf, cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, parte_contraria: c.parte_contraria,
      responsavel_id: c.responsavel_id, dados: { ...dados, origem_caso_id: c.id },
      vinculados: c.numero ? [{ id: crypto.randomUUID(), tipo: "Processo de origem", numero: c.numero, situacao: d.resultado ? String(d.resultado) : undefined }] : undefined,
      execucao: { crimes: [crime], remicoes: [], interrupcoes: [] }, criado_em: new Date().toISOString().slice(0, 10),
    },
  };
}
