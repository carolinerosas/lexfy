// Tipos de peça que o gerador do processo sabe redigir. Usado pela tela (lista) e pela
// rota /api/pecas/gerar (instruções para o modelo).

export interface TipoPeca {
  id: string;
  label: string;
  instrucao: string;
}

export const TIPOS_PECA: TipoPeca[] = [
  {
    id: "alegacoes_finais",
    label: "Alegações finais (memoriais escritos)",
    instrucao: `Redija as ALEGAÇÕES FINAIS POR MEMORIAIS da defesa (art. 403, § 3º, CPP), prontas para protocolo.
Estrutura: endereçamento e qualificação da peça; síntese da acusação e da instrução; preliminares e nulidades, se houver; análise da prova oral colhida (use a transcrição da audiência: o que cada depoente disse e onde isso conflita com a denúncia, com o inquérito e entre si); análise da prova documental e pericial dos autos; teses de absolvição (art. 386 CPP, com o inciso certo); teses subsidiárias (desclassificação, afastamento de qualificadoras e majorantes, dosimetria, regime, substituição, direito de recorrer em liberdade); pedidos finais.
Cite os autos como "(autos, arquivo X, p. N)" apenas quando a pesquisa nos autos trouxer a página; nunca invente página.`,
  },
  {
    id: "resposta_acusacao",
    label: "Resposta à acusação",
    instrucao: `Redija a RESPOSTA À ACUSAÇÃO (arts. 396 e 396-A CPP), pronta para protocolo: preliminares, nulidades e ilegalidades da investigação, tese defensiva em linhas gerais sem antecipar prova desnecessariamente, requerimento de absolvição sumária (art. 397 CPP) quando cabível, rol de testemunhas e diligências, e pedidos.`,
  },
  {
    id: "requerimento_diligencias",
    label: "Requerimento de diligências (art. 402 CPP)",
    instrucao: `Redija a petição de REQUERIMENTO DE DILIGÊNCIAS (art. 402 CPP), cuja necessidade surgiu de fatos apurados na instrução, cada diligência com o fundamento em um parágrafo e o pedido ao final.`,
  },
  {
    id: "razoes_finais_civeis",
    label: "Razões finais escritas (cível / família)",
    instrucao: `Redija as RAZÕES FINAIS ESCRITAS (art. 364, § 2º, CPC), prontas para protocolo: síntese do processo, análise da prova (documental, testemunhal e pericial, incluindo a transcrição da audiência), fundamentos jurídicos e pedidos finais.`,
  },
  {
    id: "revogacao_preventiva",
    label: "Revogação / relaxamento de prisão preventiva",
    instrucao: `Redija o pedido de REVOGAÇÃO ou RELAXAMENTO DA PRISÃO PREVENTIVA, pronto para protocolo: ausência de periculum libertatis contemporâneo e provado (art. 312 CPP), condições pessoais pelos documentos, excesso de prazo ou vícios, e medidas cautelares diversas desenhadas (art. 319 CPP) como pedido subsidiário.`,
  },
  {
    id: "livre",
    label: "Outra peça (descrevo nas instruções)",
    instrucao: `Redija a peça que a Carol descrever nas instruções adicionais, pronta para protocolo.`,
  },
];

export function tipoPeca(id?: string): TipoPeca {
  return TIPOS_PECA.find((t) => t.id === id) ?? TIPOS_PECA[0];
}
