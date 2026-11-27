// Quadros da ficha que cada fase mostra, por área (na mesma ordem das fases em areas.ts).
// "@execucao": número da execução penal (clicável e copiável) e a guia; "@calculo": cálculo da pena.
import { areaDe, type Area, type Secao } from "./areas";

type Mapa = Record<string, string[][]>;

const PADRAO_JUDICIAL = (inicio: string[], prova: string[], cumprimento: string[]): string[][] => [
  inicio, inicio, inicio, inicio, prova, prova, ["Sentença e resultado"], ["Recurso e trânsito"], cumprimento, ["Sentença e resultado", "Recurso e trânsito"],
];

const MAPA: Mapa = {
  civel: PADRAO_JUDICIAL(["Ação"], ["Prova"], ["Cumprimento e execução", "Recurso e trânsito"]),
  consumidor: PADRAO_JUDICIAL(["Relação de consumo", "Tentativa administrativa", "Pedidos"], ["Pedidos"], ["Sentença e resultado", "Recurso e trânsito"]),
  imobiliario: PADRAO_JUDICIAL(["Imóvel", "Contrato", "Posse e liminar"], ["Imóvel", "Contrato"], ["Sentença e resultado", "Recurso e trânsito"]),
  bancario: PADRAO_JUDICIAL(["Contrato", "Situação"], ["Contrato"], ["Sentença e resultado", "Recurso e trânsito"]),
  familia: [
    ["Relação", "Filhos", "Patrimônio", "Partes"], ["Relação", "Filhos", "Patrimônio"], ["Partes"], ["Partes", "Filhos"], ["Relação", "Filhos", "Patrimônio"],
    ["Filhos", "Partes"], ["Filhos", "Patrimônio", "Partes"], ["Sentença e resultado"], ["Recurso e trânsito"],
    ["Execução de alimentos", "Revisão de alimentos", "Sentença e resultado"], ["Sentença e resultado", "Recurso e trânsito"],
  ],
  sucessoes: [["Sucessão"], ["Sucessão"], ["Sucessão"], ["Herdeiros e bens"], ["Herdeiros e bens"], ["Imposto e encerramento"], ["Herdeiros e bens"], ["Herdeiros e bens"], ["Imposto e encerramento"], ["Imposto e encerramento"]],
  criminal: [
    ["Inquérito policial", "Fato", "Prisão e liberdade"], ["Fato", "Vítima", "Processo"], ["Processo", "Testemunhas"], ["Testemunhas", "Prisão e liberdade"],
    ["Processo", "Testemunhas"], ["Sentença e pena"], ["Recurso e trânsito"], ["Recurso e trânsito", "@execucao"], ["Sentença e pena", "Recurso e trânsito", "@execucao"],
  ],
  juri: [
    ["Inquérito policial", "Fato", "Prisão e liberdade"], ["Imputação", "Fato"], ["Primeira fase: sumário da culpa", "Prisão e liberdade"], ["Pronúncia"], ["Recurso da pronúncia"],
    ["Plenário"], ["Plenário", "Sentença do plenário"], ["Recurso e trânsito"], ["Sentença do plenário", "Recurso e trânsito", "@execucao"],
  ],
  execucao_penal: [
    ["Guia de execução", "@calculo"], ["Datas da execução", "@calculo"], ["Cumprimento", "Benefícios"], ["Cumprimento", "Benefícios", "Saída temporária e acolhida"], ["Cumprimento", "Benefícios", "Saída temporária e acolhida"],
    ["Benefícios", "Cumprimento"], ["Datas da execução", "Benefícios"],
  ],
  inquerito: [["Inquérito"], ["Inquérito"], ["Diligências"], ["Inquérito", "Diligências"], ["Desfecho"], ["Desfecho"]],
  trabalhista: [
    ["Contrato de trabalho", "Pedidos"], ["Contrato de trabalho", "Pedidos"], ["Audiência e prova"], ["Pedidos", "Audiência e prova"], ["Audiência e prova"],
    ["Sentença e resultado"], ["Recurso e trânsito"], ["Recurso e trânsito"], ["Recurso e execução"], ["Recurso e execução"], ["Sentença e resultado", "Recurso e trânsito"],
  ],
  previdenciario: [
    ["Benefício", "Tempo e carência"], ["Benefício"], ["Benefício", "Tempo e carência"], ["Benefício"], ["Benefício"], ["Benefício", "Tempo e carência"],
    ["Incapacidade"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Valores", "Sentença e resultado"], ["Sentença e resultado", "Valores"],
  ],
  tributario: [["Crédito", "Tese"], ["Crédito", "Tese"], ["Crédito", "Tese"], ["Garantia e exigibilidade"], ["Garantia e exigibilidade", "Tese"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Sentença e resultado", "Garantia e exigibilidade"], ["Sentença e resultado", "Recurso e trânsito"]],
  empresarial: [["Procedimento"], ["Procedimento"], ["Procedimento"], ["Crédito do cliente"], ["Procedimento", "Crédito do cliente"], ["Crédito do cliente"], ["Crédito do cliente"], ["Procedimento", "Crédito do cliente"]],
  administrativo: [["Ato e parte"], ["Ato e parte"], ["Ato e parte"], ["Andamento"], ["Andamento"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Andamento", "Sentença e resultado"], ["Sentença e resultado", "Recurso e trânsito"]],
  saude: [["Pedido"], ["Pedido", "Urgência"], ["Urgência"], ["Urgência"], ["Pedido"], ["Pedido"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Sentença e resultado", "Recurso e trânsito"]],
  ambiental: [["Autuação"], ["Autuação"], ["Autuação"], ["Autuação"], ["Autuação", "Regularização"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Regularização"], ["Sentença e resultado", "Recurso e trânsito", "Regularização"]],
  eleitoral: [["Feito"], ["Feito"], ["Feito", "Contas"], ["Feito", "Contas"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Recurso e trânsito"], ["Sentença e resultado", "Recurso e trânsito"]],
  digital: [["Caso"], ["Caso", "Medidas"], ["Caso"], ["Medidas"], ["Medidas"], ["Sentença e resultado"], ["Recurso e trânsito"], ["Sentença e resultado", "Recurso e trânsito"]],
  inventario_cartorio: [["Documentos"], ["Documentos"], ["Bens e imposto"], ["Bens e imposto"], ["Sucessão", "Documentos"], ["Documentos"], ["Documentos"], ["Sucessão", "Bens e imposto", "Documentos"]],
  divorcio_cartorio: [["Acordo"], ["Acordo", "Partilha"], ["Acordo", "Partilha"], ["Acordo", "Partilha"], ["Partilha"], ["Partilha"], ["Acordo", "Partilha"]],
  usucapiao_cartorio: [["Posse"], ["Documentos técnicos"], ["Documentos técnicos"], ["Registro"], ["Registro"], ["Registro"], ["Registro"], ["Registro"], ["Posse", "Registro"]],
  contratos: [["Contrato"], ["Contrato", "Cláusulas de atenção"], ["Cláusulas de atenção"], ["Contrato", "Cláusulas de atenção"], ["Contrato"], ["Vigência"], ["Vigência"]],
  consultivo: [["Consulta"], ["Consulta", "Entrega e horas"], ["Consulta"], ["Consulta"], ["Entrega e horas"], ["Entrega e horas"], ["Entrega e horas"]],
  societario: [["Sociedade"], ["Ato"], ["Ato"], ["Ato"], ["Ato"], ["Ato"], ["Sociedade"], ["Sociedade", "Ato"]],
  compliance: [["Programa"], ["Programa"], ["Programa"], ["Programa"], ["Rotina"], ["Rotina"]],
  mediacao: [["Procedimento"], ["Procedimento"], ["Sessões"], ["Sessões"], ["Sessões"], ["Sessões"], ["Procedimento", "Sessões"]],
  notificacoes: [["Notificação"], ["Notificação"], ["Notificação"], ["Notificação"], ["Cobrança"], ["Cobrança"], ["Cobrança"], ["Notificação", "Cobrança"]],
  regularizacao: [["Imóvel"], ["Andamento"], ["Andamento"], ["Andamento"], ["Andamento"], ["Andamento"], ["Imóvel", "Andamento"]],
  planejamento: [["Família e patrimônio"], ["Família e patrimônio"], ["Estrutura"], ["Estrutura"], ["Estrutura"], ["Estrutura"]],
  marcas: [["Marca"], ["Marca", "Andamento"], ["Andamento"], ["Andamento"], ["Andamento"], ["Andamento"], ["Andamento"], ["Andamento"]],
};

export interface Etapa { secoes: Secao[]; execucao: boolean; calculo: boolean }

/** Quadros que a fase `i` mostra. Fase sem mapa mostra a ficha inteira, para nada ficar escondido. */
export function etapaDe(areaOuId: Area | string, i: number): Etapa {
  const area = typeof areaOuId === "string" ? areaDe(areaOuId) : areaOuId;
  const nomes = MAPA[area.id]?.[i];
  if (!nomes) return { secoes: area.secoes, execucao: false, calculo: false };
  const secoes = nomes.map((n) => area.secoes.find((s) => s.titulo === n)).filter((s): s is Secao => !!s);
  return { secoes, execucao: nomes.includes("@execucao"), calculo: nomes.includes("@calculo") };
}

/** Para conferir o mapa: fases e nomes de quadro que não batem com as áreas. */
export function conferirMapa(): string[] {
  const erros: string[] = [];
  for (const [id, fases] of Object.entries(MAPA)) {
    const a = areaDe(id);
    if (a.id !== id) { erros.push(`área ${id} não existe`); continue; }
    if (fases.length !== a.fases.length) erros.push(`${id}: ${fases.length} etapas para ${a.fases.length} fases`);
    fases.flat().filter((n) => !n.startsWith("@") && !a.secoes.some((s) => s.titulo === n)).forEach((n) => erros.push(`${id}: quadro "${n}" não existe`));
  }
  return erros;
}
