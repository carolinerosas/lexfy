// Cadastro das áreas de atuação. Cada área define a ficha própria do caso
// (campos específicos), as fases típicas e os prazos de referência.
//
// Campos usam uma notação curta: "chave:Rótulo|tipo|opção 1;opção 2"
// tipos: t texto · l texto longo · d data · v valor (R$) · n número · s sim/não · o opções

export type TipoCampo = "t" | "l" | "d" | "v" | "n" | "s" | "o";
export interface Campo { k: string; rotulo: string; tipo: TipoCampo; opcoes?: string[] }
export interface Secao { titulo: string; campos: Campo[] }
export interface PrazoRef { nome: string; prazo: string; base: string }
export interface Exemplo {
  titulo: string; cliente: string; contraria?: string; fase: number;
  orgao?: string; comarca?: string; valor?: number; dados: Record<string, string | number>;
}
export type Tinta = "cobalto" | "garrafa" | "ocre" | "vinho" | "turquesa" | "grafite" | "tijolo" | "violeta";
export interface Area {
  id: string; nome: string; grupo: "judicial" | "extrajudicial"; tinta: Tinta; padrao: number;
  resumo: string; fases: string[]; secoes: Secao[]; prazos: PrazoRef[]; exemplos: Exemplo[];
  /** Segmento do número CNJ usado nos dados de demonstração (J.TR). */
  cnj?: string;
  /** Chaves dos campos que aparecem na listagem de casos da área. */
  destaque: string[];
}

export const TINTAS: Record<Tinta, { cor: string; fundo: string; nome: string }> = {
  cobalto: { cor: "#1f4fa3", fundo: "#e6edfa", nome: "Cobalto" },
  garrafa: { cor: "#1d6b4f", fundo: "#e2f1ea", nome: "Verde-garrafa" },
  ocre: { cor: "#8f6200", fundo: "#f8eed3", nome: "Ocre" },
  vinho: { cor: "#8c2f4b", fundo: "#f7e6ec", nome: "Vinho" },
  turquesa: { cor: "#0e6f7c", fundo: "#dff2f4", nome: "Turquesa" },
  grafite: { cor: "#3c4658", fundo: "#e9ecf1", nome: "Grafite" },
  tijolo: { cor: "#9c4424", fundo: "#f8e9e2", nome: "Tijolo" },
  violeta: { cor: "#55429a", fundo: "#ece8f8", nome: "Violeta" },
};

function campo(def: string): Campo {
  const [cabeca, tipo = "t", ops] = def.split("|");
  const i = cabeca.indexOf(":");
  return { k: cabeca.slice(0, i), rotulo: cabeca.slice(i + 1), tipo: tipo as TipoCampo, opcoes: ops ? ops.split(";") : undefined };
}
const sec = (titulo: string, ...campos: string[]): Secao => ({ titulo, campos: campos.map(campo) });
const pz = (nome: string, prazo: string, base: string): PrazoRef => ({ nome, prazo, base });

const FASES_CIVEL = ["A ajuizar", "Inicial distribuída", "Citação", "Contestação e réplica", "Saneamento", "Instrução", "Sentença", "Recurso", "Cumprimento de sentença", "Encerrado"];

export const AREAS: Area[] = [
  // ───────────────────────────── JUDICIAL ─────────────────────────────
  {
    id: "civel", nome: "Cível", grupo: "judicial", tinta: "cobalto", padrao: 1, cnj: "8.19",
    resumo: "Obrigações, responsabilidade civil, cobranças, execuções e juizados especiais.",
    fases: FASES_CIVEL, destaque: ["acao", "polo", "tutela"],
    secoes: [
      sec("Ação", "acao:Tipo de ação", "rito:Rito|o|Comum;Juizado Especial Cível;Procedimento especial;Execução de título;Monitória", "polo:Polo do cliente|o|Autor;Réu;Terceiro interessado", "tutela:Tutela de urgência|o|Não pedida;Pedida;Deferida;Indeferida;Revogada", "gratuidade:Justiça gratuita|s", "condenacao:Valor da condenação|v"),
      sec("Prova", "pericia:Perícia|s", "perito:Perito nomeado", "assistente:Assistente técnico", "testemunhas:Testemunhas|l"),
      sec("Cumprimento e execução", "executado:Valor em execução|v", "sisbajud:Sisbajud|o|Não pedido;Pedido;Positivo;Negativo", "penhora:Bens penhorados|l"),
    ],
    prazos: [
      pz("Contestação", "15 dias úteis", "CPC, art. 335"),
      pz("Réplica", "15 dias úteis", "CPC, arts. 350 e 351"),
      pz("Apelação e contrarrazões", "15 dias úteis", "CPC, art. 1.003, § 5º"),
      pz("Agravo de instrumento", "15 dias úteis", "CPC, art. 1.003, § 5º"),
      pz("Embargos de declaração", "5 dias úteis", "CPC, art. 1.023"),
      pz("Impugnação ao cumprimento de sentença", "15 dias úteis após o prazo de pagamento", "CPC, art. 525"),
      pz("Recurso inominado (juizado)", "10 dias", "Lei 9.099/95, art. 42"),
    ],
    exemplos: [
      { titulo: "Indenização por acidente de trânsito", cliente: "Marcos Vinícius Teixeira", contraria: "Transportadora Vale do Aço Ltda.", fase: 5, orgao: "2ª Vara Cível", comarca: "Volta Redonda", valor: 84000, dados: { acao: "Indenização por danos materiais e morais", rito: "Comum", polo: "Autor", tutela: "Não pedida", gratuidade: "Sim", pericia: "Sim", perito: "Eng. Paulo Sarmento", testemunhas: "Condutor do veículo de trás; frentista do posto" } },
      { titulo: "Cobrança de contrato de prestação de serviços", cliente: "Ateliê Flor de Lis ME", contraria: "Construtora Serra Azul S.A.", fase: 8, orgao: "1ª Vara Cível", comarca: "Barra Mansa", valor: 37250, dados: { acao: "Ação de cobrança", rito: "Comum", polo: "Autor", tutela: "Não pedida", condenacao: 41800, executado: 46320, sisbajud: "Pedido" } },
    ],
  },
  {
    id: "consumidor", nome: "Consumidor", grupo: "judicial", tinta: "turquesa", padrao: 2, cnj: "8.19",
    resumo: "Vício e defeito de produto, recall, negativação, cobrança indevida, cancelamentos.",
    fases: FASES_CIVEL, destaque: ["problema", "fornecedor", "dano_moral"],
    secoes: [
      sec("Relação de consumo", "fornecedor:Fornecedor", "produto:Produto ou serviço", "problema:Tipo de problema|o|Vício do produto;Acidente de consumo;Cobrança indevida;Negativação indevida;Atraso ou cancelamento;Recall;Assinatura não contratada", "compra:Data da compra|d", "reclamacao:Data da primeira reclamação|d", "protocolo:Protocolos de atendimento|l"),
      sec("Tentativa administrativa", "procon:Reclamação no Procon ou consumidor.gov|s", "resposta:Resposta do fornecedor|l"),
      sec("Pedidos", "negativacao:Há negativação|s", "orgao_neg:Órgão negativador", "dano_material:Dano material|v", "dano_moral:Dano moral pedido|v", "inversao:Inversão do ônus da prova|o|Não pedida;Pedida;Deferida;Indeferida"),
    ],
    prazos: [
      pz("Reclamar de vício aparente (não durável)", "30 dias da entrega", "CDC, art. 26, I"),
      pz("Reclamar de vício aparente (durável)", "90 dias da entrega", "CDC, art. 26, II"),
      pz("Reparação por acidente de consumo", "5 anos do conhecimento do dano e da autoria", "CDC, art. 27"),
      pz("Conserto pelo fornecedor", "30 dias", "CDC, art. 18, § 1º"),
      pz("Recurso inominado", "10 dias", "Lei 9.099/95, art. 42"),
    ],
    exemplos: [
      { titulo: "Notebook com defeito recorrente na garantia", cliente: "Cleber Antunes Rocha", contraria: "Kaze Eletrônicos do Brasil Ltda.", fase: 3, orgao: "3ª Vara Cível", comarca: "Resende", valor: 19500, dados: { fornecedor: "Kaze Eletrônicos do Brasil", produto: "Notebook 15 polegadas", problema: "Vício do produto", compra: "@-300", reclamacao: "@-160", procon: "Sim", dano_material: 7500, dano_moral: 12000, inversao: "Deferida", protocolo: "SAC 2291-774; consumidor.gov 2026.05/000881", resposta: "Três ordens de serviço na assistência autorizada, sem solução" } },
      { titulo: "Negativação por dívida já quitada", cliente: "Jussara Lima Peçanha", contraria: "Banco Meridional S.A.", fase: 6, orgao: "Juizado Especial Cível", comarca: "Barra Mansa", valor: 15000, dados: { fornecedor: "Banco Meridional", produto: "Cartão de crédito", problema: "Negativação indevida", negativacao: "Sim", orgao_neg: "Serasa", dano_moral: 15000, inversao: "Deferida", procon: "Não" } },
    ],
  },
  {
    id: "familia", nome: "Família", grupo: "judicial", tinta: "vinho", padrao: 3, cnj: "8.19",
    resumo: "Divórcio, união estável, guarda, convivência, alimentos e partilha.",
    fases: ["A ajuizar", "Inicial distribuída", "Citação", "Mediação ou conciliação", "Contestação", "Estudo psicossocial", "Instrução", "Sentença", "Recurso", "Cumprimento", "Encerrado"],
    destaque: ["acao", "guarda", "alimentos_prov"],
    secoes: [
      sec("Relação", "acao:Ação", "relacao:Relação|o|Casamento;União estável", "inicio:Início da convivência|d", "casamento:Data do casamento|d", "regime:Regime de bens|o|Comunhão parcial;Comunhão universal;Separação convencional;Separação obrigatória;Participação final nos aquestos", "separacao:Separação de fato|d", "moradia:Quem ficou no imóvel"),
      sec("Filhos", "filhos:Filhos (nome, nascimento, escola)|l", "guarda:Guarda pretendida|o|Compartilhada;Unilateral materna;Unilateral paterna;Não há filhos menores", "convivencia:Convivência pretendida|l", "alimentos:Alimentos pedidos", "alimentos_prov:Alimentos provisórios fixados|v", "despesas:Despesas mensais dos filhos|v"),
      sec("Patrimônio", "bens:Bens a partilhar|l", "dividas:Dívidas|l", "partilha:Partilha pretendida|l"),
      sec("Partes", "renda_cliente:Renda do cliente", "renda_outra:Renda da outra parte", "protetiva:Medida protetiva em vigor|s", "acordo:Possibilidade de acordo|o|Provável;Possível;Improvável"),
    ],
    prazos: [
      pz("Contestação", "15 dias úteis da audiência de mediação", "CPC, arts. 335 e 697"),
      pz("Pagamento na execução de alimentos (rito da prisão)", "3 dias", "CPC, art. 528"),
      pz("Pagamento na execução de alimentos (rito da penhora)", "15 dias", "CPC, art. 523"),
      pz("Apelação", "15 dias úteis", "CPC, art. 1.003, § 5º"),
      pz("Agravo contra decisão sobre alimentos provisórios ou guarda", "15 dias úteis", "CPC, art. 1.015"),
    ],
    exemplos: [
      { titulo: "Divórcio litigioso com guarda e alimentos", cliente: "Luciana Barreto Maia", contraria: "Rodrigo Maia Ferraz", fase: 5, orgao: "Vara de Família", comarca: "Volta Redonda", dados: { acao: "Divórcio litigioso com partilha, guarda e alimentos", relacao: "Casamento", casamento: "@-4300", regime: "Comunhão parcial", separacao: "@-210", moradia: "A cliente, com os filhos", filhos: "Heitor, 9 anos, Colégio Santo Inácio\nAlice, 5 anos, Escola Pequeno Mundo", guarda: "Compartilhada", convivencia: "Fins de semana alternados e quartas-feiras", alimentos: "30% dos rendimentos líquidos", alimentos_prov: 2100, despesas: 3480, bens: "Apartamento financiado (Aterrado)\nAutomóvel 2021", renda_cliente: "R$ 3.200 (professora)", renda_outra: "R$ 9.500 (engenheiro)", protetiva: "Não", acordo: "Possível" } },
      { titulo: "Reconhecimento e dissolução de união estável", cliente: "Denise Aparecida Coutinho", contraria: "Espólio de Valter Nunes", fase: 6, orgao: "Vara de Família", comarca: "Barra Mansa", dados: { acao: "Reconhecimento de união estável post mortem", relacao: "União estável", inicio: "@-5200", regime: "Comunhão parcial", guarda: "Não há filhos menores", bens: "Casa no bairro Ano Bom\nSaldo de FGTS", acordo: "Improvável" } },
    ],
  },
  {
    id: "sucessoes", nome: "Sucessões", grupo: "judicial", tinta: "grafite", padrao: 4, cnj: "8.19",
    resumo: "Inventário e arrolamento judicial, alvarás, testamentos e ações de herança.",
    fases: ["A ajuizar", "Abertura", "Nomeação do inventariante", "Primeiras declarações", "Citações", "Avaliação e cálculo do imposto", "Últimas declarações", "Partilha", "Formal expedido", "Encerrado"],
    destaque: ["falecido", "rito", "itcmd"],
    secoes: [
      sec("Sucessão", "falecido:Autor da herança", "obito:Data do óbito|d", "rito:Rito|o|Inventário;Arrolamento sumário;Arrolamento comum;Alvará judicial", "inventariante:Inventariante", "testamento:Há testamento|s", "conjuge:Cônjuge ou companheiro e regime"),
      sec("Herdeiros e bens", "herdeiros:Herdeiros|l", "incapaz:Herdeiro menor ou incapaz|s", "bens:Bens|l", "dividas:Dívidas do espólio|l", "monte:Valor do monte|v"),
      sec("Imposto e encerramento", "itcmd:ITCMD|o|Não declarado;Declarado;Guia emitida;Pago;Isento", "itcmd_valor:Valor do ITCMD|v", "formal:Formal de partilha|o|Não expedido;Expedido;Registrado"),
    ],
    prazos: [
      pz("Abertura do inventário", "2 meses do óbito", "CPC, art. 611"),
      pz("Primeiras declarações", "20 dias do compromisso do inventariante", "CPC, art. 620"),
      pz("Manifestação sobre as primeiras declarações", "15 dias", "CPC, art. 627"),
      pz("Declaração e pagamento do ITCMD", "Conforme a lei estadual (multa por atraso)", "Lei do estado do bem"),
    ],
    exemplos: [
      { titulo: "Inventário de Sebastião Honorato", cliente: "Marta Honorato Vieira", fase: 5, orgao: "1ª Vara Cível", comarca: "Resende", valor: 640000, dados: { falecido: "Sebastião Honorato", obito: "@-400", rito: "Inventário", inventariante: "Marta Honorato Vieira", testamento: "Não", herdeiros: "Marta (filha)\nJoel (filho)\nNetos por representação: Caio e Lívia", incapaz: "Sim", bens: "Sítio em Penedo\nCasa em Resende\nAplicações", monte: 640000, itcmd: "Declarado", itcmd_valor: 28800 } },
      { titulo: "Alvará para levantamento de saldo", cliente: "Ivone Pacheco Dias", fase: 2, orgao: "2ª Vara Cível", comarca: "Barra Mansa", valor: 18400, dados: { falecido: "Antônio Dias", obito: "@-95", rito: "Alvará judicial", testamento: "Não", herdeiros: "Ivone (viúva) e dois filhos maiores", incapaz: "Não", itcmd: "Isento" } },
    ],
  },
  {
    id: "criminal", nome: "Criminal", grupo: "judicial", tinta: "tijolo", padrao: 5, cnj: "8.19",
    resumo: "Ação penal, prisão e liberdade, habeas corpus, violência doméstica.",
    fases: ["Flagrante e custódia", "Denúncia", "Resposta à acusação", "Instrução", "Alegações finais", "Sentença", "Recurso", "Trânsito em julgado", "Encerrado"],
    destaque: ["tipo_penal", "situacao", "revisao"],
    secoes: [
      sec("Fato", "tipo_penal:Tipo penal", "fato_data:Data do fato|d", "fato_local:Local do fato", "ro:Nº do registro de ocorrência", "vitimas:Vítimas|l"),
      sec("Prisão e liberdade", "situacao:Situação|o|Solto;Preso em flagrante;Prisão preventiva;Prisão temporária;Prisão domiciliar;Monitoração eletrônica;Liberdade provisória com cautelares", "unidade:Unidade prisional", "prisao_data:Data da prisão|d", "revisao:Última revisão da preventiva|d", "fianca:Fiança arbitrada|v", "hc:Habeas corpus|o|Não impetrado;Impetrado no TJ;Impetrado no STJ;Impetrado no STF;Concedido;Denegado"),
      sec("Processo", "representacao:Representação da vítima|o|Não se aplica;Oferecida;Não oferecida;Retratada", "recebimento:Recebimento da denúncia|d", "citacao:Citação|d", "anpp:Acordo de não persecução penal|o|Não cabe;Proposto;Aceito;Recusado;Homologado;Descumprido", "sursis:Suspensão condicional do processo|o|Não cabe;Proposta;Aceita;Em cumprimento;Revogada", "tese:Tese de defesa|l", "testemunhas:Testemunhas de defesa|l"),
      sec("Violência doméstica", "lmp:Lei Maria da Penha|s", "protetivas:Medidas protetivas|l", "fonar:Risco no formulário nacional|o|Não preenchido;Baixo;Médio;Elevado"),
    ],
    prazos: [
      pz("Resposta à acusação", "10 dias da citação", "CPP, art. 396"),
      pz("Alegações finais por memoriais", "5 dias", "CPP, art. 403, § 3º"),
      pz("Apelação (interposição)", "5 dias", "CPP, art. 593"),
      pz("Razões de apelação", "8 dias", "CPP, art. 600"),
      pz("Recurso em sentido estrito", "5 dias (razões em 2 dias)", "CPP, arts. 586 e 588"),
      pz("Embargos de declaração", "2 dias", "CPP, arts. 382 e 619"),
      pz("Revisão da prisão preventiva", "A cada 90 dias", "CPP, art. 316, parágrafo único"),
      pz("Audiência de custódia", "24 horas da prisão", "CPP, art. 310"),
    ],
    exemplos: [
      { titulo: "Furto qualificado: preventiva decretada na custódia", cliente: "Diego Rafael Sampaio", contraria: "Ministério Público do Estado do Rio de Janeiro", fase: 2, orgao: "2ª Vara Criminal", comarca: "Resende", dados: { tipo_penal: "Furto qualificado (art. 155, § 4º, IV, CP)", fato_data: "@-48", fato_local: "Rua do Rosário, Centro", ro: "089-04127/2026", situacao: "Prisão preventiva", unidade: "Cadeia Pública de Resende", prisao_data: "@-47", revisao: "@-47", hc: "Impetrado no TJ", recebimento: "@-30", citacao: "@-12", anpp: "Não cabe", tese: "Reconhecimento fotográfico irregular (art. 226 do CPP); ausência de fundamentação concreta da preventiva", lmp: "Não" } },
      { titulo: "Tráfico: busca domiciliar sem mandado", cliente: "Maurício Teles Barcelos", contraria: "Ministério Público do Estado do Rio de Janeiro", fase: 3, orgao: "1ª Vara Criminal", comarca: "Barra do Piraí", dados: { tipo_penal: "Tráfico de drogas (art. 33, Lei 11.343/06)", fato_data: "@-230", situacao: "Prisão preventiva", unidade: "Cadeia Pública José Frederico Marques", prisao_data: "@-228", revisao: "@-82", hc: "Denegado", recebimento: "@-190", citacao: "@-180", anpp: "Não cabe", tese: "Ingresso em domicílio sem fundadas razões (Tema 280 do STF); nulidade da apreensão", testemunhas: "Vizinha do acusado; empregador" } },
      { titulo: "Ameaça em contexto doméstico", cliente: "Everton Sales Domingues", contraria: "Ministério Público do Estado do Rio de Janeiro", fase: 3, orgao: "Juizado de Violência Doméstica", comarca: "Barra Mansa", dados: { tipo_penal: "Ameaça (art. 147, CP)", fato_data: "@-150", situacao: "Liberdade provisória com cautelares", representacao: "Oferecida", lmp: "Sim", protetivas: "Afastamento do lar; proibição de aproximação (300 m) e de contato", fonar: "Médio", sursis: "Não cabe", anpp: "Não cabe" } },
    ],
  },
  {
    id: "juri", nome: "Tribunal do Júri", grupo: "judicial", tinta: "tijolo", padrao: 6, cnj: "8.19",
    resumo: "Crimes dolosos contra a vida: sumário da culpa, pronúncia e plenário.",
    fases: ["Inquérito", "Denúncia", "Sumário da culpa", "Pronúncia", "Recurso da pronúncia", "Preparação do plenário", "Plenário", "Apelação", "Encerrado"],
    destaque: ["imputacao", "plenario", "tese"],
    secoes: [
      sec("Imputação", "imputacao:Imputação", "qualificadoras:Qualificadoras|l", "situacao:Situação do acusado|o|Solto;Prisão preventiva;Prisão domiciliar;Monitoração eletrônica", "unidade:Unidade prisional"),
      sec("Primeira fase", "pronuncia:Data da pronúncia|d", "decisao:Decisão|o|Pendente;Pronúncia;Impronúncia;Desclassificação;Absolvição sumária", "rese:Recurso em sentido estrito|o|Não interposto;Interposto;Provido;Desprovido"),
      sec("Plenário", "plenario:Data do plenário|d", "rol:Rol de testemunhas (art. 422)|l", "tese:Tese principal", "subsidiarias:Teses subsidiárias|l", "quesitos:Quesitos e pontos de atenção|l", "resultado:Resultado", "pena:Pena aplicada"),
    ],
    prazos: [
      pz("Recurso em sentido estrito contra a pronúncia", "5 dias", "CPP, art. 581, IV, e art. 586"),
      pz("Rol de testemunhas e diligências para o plenário", "5 dias", "CPP, art. 422"),
      pz("Juntada de documento para leitura em plenário", "3 dias úteis de antecedência", "CPP, art. 479"),
      pz("Apelação da decisão do júri", "5 dias", "CPP, art. 593, III"),
    ],
    exemplos: [
      { titulo: "Homicídio qualificado: plenário designado", cliente: "Wesley Nascimento Prado", contraria: "Ministério Público do Estado do Rio de Janeiro", fase: 5, orgao: "Vara Criminal e Tribunal do Júri", comarca: "Barra Mansa", dados: { imputacao: "Homicídio qualificado (art. 121, § 2º, II e IV, CP)", qualificadoras: "Motivo fútil\nRecurso que dificultou a defesa", situacao: "Prisão preventiva", unidade: "Cadeia Pública de Barra Mansa", pronuncia: "@-200", decisao: "Pronúncia", rese: "Desprovido", plenario: "@+34", rol: "1. Mãe do acusado\n2. Dono do bar\n3. Perito particular", tese: "Legítima defesa", subsidiarias: "Homicídio privilegiado; afastamento das qualificadoras" } },
      { titulo: "Tentativa de homicídio: sumário da culpa", cliente: "Jonas Ferreira Lopes", contraria: "Ministério Público do Estado do Rio de Janeiro", fase: 2, orgao: "Vara Criminal e Tribunal do Júri", comarca: "Volta Redonda", dados: { imputacao: "Homicídio tentado (art. 121, c/c art. 14, II, CP)", situacao: "Solto", decisao: "Pendente", tese: "Desclassificação para lesão corporal" } },
    ],
  },
  {
    id: "execucao_penal", nome: "Execução penal", grupo: "judicial", tinta: "tijolo", padrao: 7, cnj: "8.19",
    resumo: "Progressão de regime, livramento, remição, saídas, indulto e incidentes.",
    fases: ["Guia expedida", "Cálculo homologado", "Cumprimento em regime fechado", "Semiaberto", "Aberto ou domiciliar", "Livramento condicional", "Pena extinta"],
    destaque: ["regime", "progressao", "unidade"],
    secoes: [
      sec("Pena", "pena:Pena total", "natureza:Natureza do crime|o|Comum sem violência;Comum com violência ou grave ameaça;Hediondo ou equiparado;Hediondo com resultado morte", "reincidencia:Condição|o|Primário;Reincidente;Reincidente específico", "data_base:Data-base|d", "termino:Término da pena|d"),
      sec("Cumprimento", "regime:Regime atual|o|Fechado;Semiaberto;Aberto;Prisão domiciliar;Livramento condicional", "unidade:Unidade prisional", "fracao:Fração para progressão", "remicao:Dias remidos|n", "detracao:Detração (dias)|n", "trabalho:Trabalho ou estudo"),
      sec("Benefícios", "progressao:Previsão de progressão|d", "livramento:Previsão de livramento|d", "saida:Saída temporária|o|Não cabe;Não requerida;Requerida;Deferida;Indeferida", "faltas:Faltas graves|l", "indulto:Indulto ou comutação (decreto)"),
    ],
    prazos: [
      pz("Agravo em execução", "5 dias", "LEP, art. 197, e Súmula 700 do STF"),
      pz("Progressão de regime", "16% a 70% da pena, conforme o caso", "LEP, art. 112"),
      pz("Remição pelo trabalho", "1 dia de pena a cada 3 de trabalho", "LEP, art. 126, § 1º, II"),
      pz("Remição pelo estudo", "1 dia de pena a cada 12 horas de estudo", "LEP, art. 126, § 1º, I"),
      pz("Livramento condicional", "1/3 (primário), 1/2 (reincidente), 2/3 (hediondo)", "CP, art. 83"),
    ],
    exemplos: [
      { titulo: "Execução: progressão ao semiaberto", cliente: "Adriano Costa Ventura", fase: 2, orgao: "Vara de Execuções Penais", comarca: "Rio de Janeiro", dados: { pena: "8 anos e 2 meses", natureza: "Comum com violência ou grave ameaça", reincidencia: "Primário", data_base: "@-720", termino: "@+2260", regime: "Fechado", unidade: "Penitenciária Industrial Esmeraldino Bandeira", fracao: "25%", remicao: 96, detracao: 41, trabalho: "Oficina de costura", progressao: "@+12", livramento: "@+270", saida: "Não cabe" } },
      { titulo: "Execução: livramento condicional", cliente: "Fábio Júnior Medeiros", fase: 3, orgao: "Vara de Execuções Penais", comarca: "Rio de Janeiro", dados: { pena: "5 anos e 4 meses", natureza: "Comum sem violência", reincidencia: "Reincidente", data_base: "@-900", termino: "@+1040", regime: "Semiaberto", unidade: "Instituto Penal Plácido de Sá Carvalho", fracao: "20%", remicao: 140, progressao: "@-30", livramento: "@+58", saida: "Deferida", trabalho: "Trabalho extramuros" } },
    ],
  },
  {
    id: "inquerito", nome: "Inquérito e investigação", grupo: "judicial", tinta: "grafite", padrao: 8, cnj: "8.19",
    resumo: "Acompanhamento em delegacia, oitivas, cautelares e restituição de bens.",
    fases: ["Registro de ocorrência", "Inquérito instaurado", "Oitivas e diligências", "Relatório final", "Com o Ministério Público", "Denúncia ou arquivamento"],
    destaque: ["delegacia", "situacao", "oitiva"],
    secoes: [
      sec("Inquérito", "numero_ip:Nº do inquérito", "delegacia:Delegacia", "autoridade:Autoridade policial", "instauracao:Data de instauração|d", "situacao:Situação|o|Em andamento;Relatado;Denunciado;Arquivado;Baixado para diligências", "posicao:Posição do cliente|o|Investigado;Vítima;Testemunha"),
      sec("Diligências", "preso:Investigado preso|s", "oitiva:Oitiva marcada|d", "cautelares:Medidas cautelares|l", "apreendidos:Bens apreendidos|l", "restituicao:Pedido de restituição|o|Não se aplica;Não requerido;Requerido;Deferido;Indeferido"),
    ],
    prazos: [
      pz("Conclusão do inquérito (investigado preso)", "10 dias", "CPP, art. 10"),
      pz("Conclusão do inquérito (investigado solto)", "30 dias, prorrogáveis", "CPP, art. 10"),
      pz("Inquérito na Lei de Drogas", "30 dias (preso) ou 90 dias (solto)", "Lei 11.343/06, art. 51"),
      pz("Denúncia", "5 dias (preso) ou 15 dias (solto)", "CPP, art. 46"),
      pz("Queixa-crime ou representação", "6 meses do conhecimento da autoria", "CPP, art. 38"),
    ],
    exemplos: [
      { titulo: "Estelionato: investigado intimado a depor", cliente: "Renan Queiroz Assis", fase: 2, orgao: "90ª DP", comarca: "Barra Mansa", dados: { numero_ip: "090-01882/2026", delegacia: "90ª DP (Barra Mansa)", instauracao: "@-75", situacao: "Em andamento", posicao: "Investigado", preso: "Não", oitiva: "@+6", apreendidos: "Notebook e dois celulares", restituicao: "Requerido" } },
      { titulo: "Lesão corporal: cliente é a vítima", cliente: "Tatiane Moura Reis", fase: 3, orgao: "93ª DP", comarca: "Volta Redonda", dados: { numero_ip: "093-03310/2026", delegacia: "93ª DP (Volta Redonda)", instauracao: "@-120", situacao: "Relatado", posicao: "Vítima", preso: "Não", restituicao: "Não se aplica" } },
    ],
  },
  {
    id: "trabalhista", nome: "Trabalhista", grupo: "judicial", tinta: "garrafa", padrao: 9, cnj: "5.01",
    resumo: "Reclamações trabalhistas, verbas rescisórias, vínculo, acordos e execução.",
    fases: ["A ajuizar", "Inicial distribuída", "Audiência inicial", "Perícia", "Instrução", "Sentença", "Recurso ordinário", "Recurso de revista", "Liquidação", "Execução", "Encerrado"],
    destaque: ["polo", "desligamento", "valor_pedidos"],
    secoes: [
      sec("Contrato de trabalho", "polo:Polo do cliente|o|Reclamante;Reclamada", "empregador:Empregador", "funcao:Função", "admissao:Admissão|d", "demissao:Desligamento|d", "desligamento:Tipo de desligamento|o|Sem justa causa;Justa causa;Pedido de demissão;Rescisão indireta;Acordo (art. 484-A);Término de contrato", "salario:Último salário|v", "ctps:CTPS anotada|s", "jornada:Jornada cumprida"),
      sec("Pedidos", "pedidos:Pedidos|l", "valor_pedidos:Valor dos pedidos|v", "rito:Rito|o|Sumaríssimo;Ordinário;Sumário", "pericia:Perícia|o|Não;Insalubridade;Periculosidade;Médica;Contábil"),
      sec("Audiência e prova", "preposto:Preposto", "testemunhas:Testemunhas|l"),
      sec("Recurso e execução", "deposito:Depósito recursal|v", "acordo:Acordo homologado|v", "liquidacao:Valor liquidado|v"),
    ],
    prazos: [
      pz("Ajuizar após o fim do contrato", "2 anos (alcança os últimos 5 anos)", "CF, art. 7º, XXIX"),
      pz("Recurso ordinário", "8 dias úteis", "CLT, art. 895"),
      pz("Recurso de revista", "8 dias úteis", "CLT, art. 896"),
      pz("Embargos de declaração", "5 dias úteis", "CLT, art. 897-A"),
      pz("Agravo de petição", "8 dias úteis", "CLT, art. 897, a"),
      pz("Embargos à execução", "5 dias da garantia do juízo", "CLT, art. 884"),
      pz("Pagamento das verbas rescisórias", "10 dias do término do contrato", "CLT, art. 477, § 6º"),
    ],
    exemplos: [
      { titulo: "Horas extras e verbas rescisórias", cliente: "Gilmar Duarte Sobrinho", contraria: "Metalúrgica Paraíba do Sul Ltda.", fase: 4, orgao: "2ª Vara do Trabalho", comarca: "Volta Redonda", valor: 96400, dados: { polo: "Reclamante", empregador: "Metalúrgica Paraíba do Sul", funcao: "Operador de ponte rolante", admissao: "@-2600", demissao: "@-240", desligamento: "Sem justa causa", salario: 3840, ctps: "Sim", jornada: "6h às 18h, com 30 min de intervalo", pedidos: "Horas extras e reflexos\nIntervalo intrajornada\nAdicional de insalubridade\nDiferenças de FGTS", valor_pedidos: 96400, rito: "Ordinário", pericia: "Insalubridade", testemunhas: "Dois colegas de turno" } },
      { titulo: "Defesa em reclamação de vendedora", cliente: "Boutique Maré Alta Ltda.", contraria: "Priscila Andrade Torres", fase: 2, orgao: "1ª Vara do Trabalho", comarca: "Barra Mansa", valor: 42000, dados: { polo: "Reclamada", empregador: "Boutique Maré Alta", funcao: "Vendedora", admissao: "@-900", demissao: "@-130", desligamento: "Pedido de demissão", salario: 2100, ctps: "Sim", pedidos: "Reversão do pedido de demissão\nComissões não pagas", valor_pedidos: 42000, rito: "Sumaríssimo", pericia: "Não", preposto: "Gerente Sandra Lobo" } },
    ],
  },
  {
    id: "previdenciario", nome: "Previdenciário", grupo: "judicial", tinta: "ocre", padrao: 10, cnj: "4.02",
    resumo: "Aposentadorias, benefícios por incapacidade, pensão, BPC e revisões.",
    fases: ["Análise de documentos", "Requerimento administrativo", "Exigência do INSS", "Indeferido", "Recurso administrativo", "Ação ajuizada", "Perícia judicial", "Sentença", "Recurso", "Implantação e atrasados", "Encerrado"],
    destaque: ["beneficio", "der", "via"],
    secoes: [
      sec("Benefício", "beneficio:Benefício|o|Aposentadoria por idade;Aposentadoria por tempo de contribuição;Aposentadoria especial;Aposentadoria por incapacidade permanente;Auxílio por incapacidade temporária;Auxílio-acidente;Pensão por morte;BPC/LOAS;Salário-maternidade;Revisão de benefício", "nb:Número do benefício (NB)", "der:Data de entrada do requerimento (DER)|d", "dib:Início do benefício (DIB)|d", "dcb:Cessação do benefício (DCB)|d", "via:Via|o|Administrativa;Juizado Especial Federal;Vara Federal;Justiça Estadual (competência delegada)"),
      sec("Tempo e carência", "tempo:Tempo de contribuição reconhecido", "carencia:Carência (contribuições)|n", "especiais:Períodos especiais|l", "ppp:PPP e LTCAT juntados|s", "cnis:CNIS conferido|s", "segurado:Qualidade de segurado|o|Mantida;Período de graça;Perdida;A comprovar"),
      sec("Incapacidade", "pericia:Perícia médica|d", "cid:CID", "laudo:Conclusão do laudo|l"),
      sec("Valores", "rmi:Renda mensal inicial estimada|v", "atrasados:Atrasados estimados|v"),
    ],
    prazos: [
      pz("Recurso ao Conselho de Recursos da Previdência", "30 dias da ciência", "Regimento do CRPS"),
      pz("Revisão do ato de concessão", "10 anos", "Lei 8.213/91, art. 103"),
      pz("Parcelas vencidas", "Prescrevem em 5 anos", "Lei 8.213/91, art. 103, parágrafo único"),
      pz("Recurso inominado no juizado federal", "10 dias", "Lei 10.259/01 e Lei 9.099/95, art. 42"),
      pz("Limite do juizado federal", "60 salários mínimos", "Lei 10.259/01, art. 3º"),
    ],
    exemplos: [
      { titulo: "Aposentadoria especial: metalúrgico", cliente: "José Carlos Bittencourt", contraria: "INSS", fase: 6, orgao: "1ª Vara Federal", comarca: "Volta Redonda", valor: 142000, dados: { beneficio: "Aposentadoria especial", nb: "46/204.118.337-9", der: "@-520", via: "Vara Federal", tempo: "26 anos, 4 meses", carencia: 316, especiais: "1994 a 2019: ruído acima de 90 dB (aciaria)", ppp: "Sim", cnis: "Sim", segurado: "Mantida", rmi: 4980, atrasados: 86400 } },
      { titulo: "Auxílio por incapacidade cessado", cliente: "Rosângela Mendes Fialho", contraria: "INSS", fase: 6, orgao: "Juizado Especial Federal", comarca: "Resende", valor: 31000, dados: { beneficio: "Auxílio por incapacidade temporária", nb: "31/633.902.114-0", der: "@-300", dcb: "@-140", via: "Juizado Especial Federal", segurado: "Mantida", pericia: "@+9", cid: "M51.1", cnis: "Sim", rmi: 2140, atrasados: 10700 } },
    ],
  },
  {
    id: "tributario", nome: "Tributário", grupo: "judicial", tinta: "violeta", padrao: 11, cnj: "4.02",
    resumo: "Execução fiscal, anulatórias, mandado de segurança, repetição e transação.",
    fases: ["Análise", "Defesa administrativa", "Ação ajuizada", "Garantia do juízo", "Embargos", "Sentença", "Recurso", "Cumprimento ou baixa", "Encerrado"],
    destaque: ["tributo", "tipo", "valor_atual"],
    secoes: [
      sec("Crédito", "tributo:Tributo", "ente:Ente|o|União;Estado;Município", "tipo:Medida|o|Execução fiscal;Ação anulatória;Mandado de segurança;Repetição de indébito;Defesa administrativa;Transação ou parcelamento;Exceção de pré-executividade", "cda:Certidão de dívida ativa", "periodo:Período de apuração", "constituicao:Constituição do crédito|d", "valor_atual:Valor atualizado|v"),
      sec("Garantia e exigibilidade", "garantia:Garantia do juízo|o|Não há;Penhora;Depósito integral;Seguro-garantia;Fiança bancária", "suspensa:Exigibilidade suspensa|s", "certidao:Certidão de regularidade|o|Negativa;Positiva com efeitos de negativa;Positiva", "parcelamento:Parcelamento ou transação|l"),
      sec("Tese", "tese:Tese|l", "prescricao:Prescrição prevista|d"),
    ],
    prazos: [
      pz("Pagar ou garantir a execução fiscal", "5 dias da citação", "Lei 6.830/80, art. 8º"),
      pz("Embargos à execução fiscal", "30 dias da garantia", "Lei 6.830/80, art. 16"),
      pz("Impugnação no processo administrativo federal", "30 dias", "Decreto 70.235/72, art. 15"),
      pz("Mandado de segurança", "120 dias da ciência do ato", "Lei 12.016/09, art. 23"),
      pz("Cobrança do crédito tributário", "Prescreve em 5 anos", "CTN, art. 174"),
      pz("Repetição de indébito", "5 anos do pagamento", "CTN, art. 168"),
    ],
    exemplos: [
      { titulo: "Execução fiscal de ISS: prescrição intercorrente", cliente: "Clínica Vida Plena Ltda.", contraria: "Município de Volta Redonda", fase: 4, orgao: "Central de Dívida Ativa", comarca: "Volta Redonda", valor: 213000, dados: { tributo: "ISS", ente: "Município", tipo: "Exceção de pré-executividade", cda: "2017/004.551", periodo: "2012 a 2014", valor_atual: 213000, garantia: "Não há", suspensa: "Não", certidao: "Positiva", tese: "Prescrição intercorrente (art. 40 da LEF e Tema 566 do STJ)" } },
      { titulo: "Exclusão do ICMS da base do PIS e da Cofins", cliente: "Distribuidora Três Rios Ltda.", contraria: "União (Fazenda Nacional)", fase: 6, orgao: "2ª Vara Federal", comarca: "Volta Redonda", valor: 480000, dados: { tributo: "PIS e Cofins", ente: "União", tipo: "Mandado de segurança", periodo: "Últimos 5 anos", valor_atual: 480000, suspensa: "Sim", certidao: "Positiva com efeitos de negativa", tese: "Tema 69 do STF: compensação do indébito" } },
    ],
  },
  {
    id: "empresarial", nome: "Empresarial e recuperação", grupo: "judicial", tinta: "cobalto", padrao: 12, cnj: "8.19",
    resumo: "Recuperação judicial, falência, disputas societárias e títulos de crédito.",
    fases: ["Análise", "Pedido ajuizado", "Processamento deferido", "Verificação de créditos", "Assembleia de credores", "Plano homologado", "Cumprimento", "Encerrado"],
    destaque: ["tipo", "classe", "credito"],
    secoes: [
      sec("Procedimento", "tipo:Tipo|o|Recuperação judicial;Recuperação extrajudicial;Falência;Dissolução de sociedade;Apuração de haveres;Execução de título;Habilitação de crédito;Responsabilidade de administrador", "empresa:Empresa", "cnpj:CNPJ", "aj:Administrador judicial", "stay:Suspensão das execuções até|d", "agc:Assembleia de credores|d"),
      sec("Crédito do cliente", "classe:Classe do crédito|o|Trabalhista;Garantia real;Quirografário;Microempresa e pequeno porte;Extraconcursal", "credito:Valor do crédito|v", "habilitacao:Habilitação|o|Não apresentada;Apresentada;Incluída no quadro;Impugnada", "plano:Condições do plano|l"),
    ],
    prazos: [
      pz("Habilitação ou divergência de crédito", "15 dias do edital", "Lei 11.101/05, art. 7º, § 1º"),
      pz("Impugnação à relação de credores", "10 dias", "Lei 11.101/05, art. 8º"),
      pz("Apresentação do plano de recuperação", "60 dias do deferimento", "Lei 11.101/05, art. 53"),
      pz("Suspensão das execuções", "180 dias, prorrogáveis uma vez", "Lei 11.101/05, art. 6º, § 4º"),
      pz("Contestação ao pedido de falência", "10 dias", "Lei 11.101/05, art. 98"),
    ],
    exemplos: [
      { titulo: "Habilitação de crédito em recuperação judicial", cliente: "Ferragens Santa Rita Ltda.", contraria: "Siderúrgica Montanhesa S.A. (em recuperação)", fase: 3, orgao: "3ª Vara Empresarial", comarca: "Rio de Janeiro", valor: 318000, dados: { tipo: "Habilitação de crédito", empresa: "Siderúrgica Montanhesa S.A.", aj: "Prado & Leal Administração Judicial", stay: "@+62", agc: "@+41", classe: "Quirografário", credito: 318000, habilitacao: "Apresentada" } },
      { titulo: "Dissolução parcial de sociedade", cliente: "Olívia Camargo Reis", contraria: "Camargo & Tavares Engenharia Ltda.", fase: 1, orgao: "1ª Vara Empresarial", comarca: "Rio de Janeiro", valor: 900000, dados: { tipo: "Apuração de haveres", empresa: "Camargo & Tavares Engenharia", classe: "Quirografário", plano: "Balanço de determinação com data-base na notificação de retirada" } },
    ],
  },
  {
    id: "imobiliario", nome: "Imobiliário", grupo: "judicial", tinta: "garrafa", padrao: 13, cnj: "8.19",
    resumo: "Locação, despejo, posse, usucapião judicial, compra e venda e condomínio.",
    fases: FASES_CIVEL, destaque: ["tipo", "imovel", "debito"],
    secoes: [
      sec("Imóvel", "tipo:Ação|o|Despejo por falta de pagamento;Despejo por denúncia vazia;Renovatória;Revisional de aluguel;Usucapião;Reintegração ou manutenção de posse;Adjudicação compulsória;Rescisão de compra e venda;Cobrança de condomínio", "imovel:Imóvel", "matricula:Matrícula", "cartorio:Registro de imóveis"),
      sec("Contrato", "inicio:Início do contrato|d", "fim:Fim do contrato|d", "aluguel:Aluguel|v", "garantia:Garantia|o|Sem garantia;Caução;Fiador;Seguro-fiança;Título de capitalização", "debito:Débito|v"),
      sec("Posse e liminar", "posse:Posse desde|d", "liminar:Liminar|o|Não pedida;Pedida;Deferida;Indeferida;Cumprida"),
    ],
    prazos: [
      pz("Ação renovatória", "De 1 ano a 6 meses antes do fim do contrato", "Lei 8.245/91, art. 51, § 5º"),
      pz("Purgação da mora no despejo", "15 dias da citação", "Lei 8.245/91, art. 62, II"),
      pz("Desocupação por liminar", "15 dias", "Lei 8.245/91, art. 59, § 1º"),
      pz("Liminar possessória (posse nova)", "Ação proposta em até ano e dia", "CPC, art. 558"),
    ],
    exemplos: [
      { titulo: "Despejo por falta de pagamento: sala comercial", cliente: "Imobiliária Novo Horizonte Ltda.", contraria: "Sabor da Serra Restaurante ME", fase: 3, orgao: "4ª Vara Cível", comarca: "Volta Redonda", valor: 28800, dados: { tipo: "Despejo por falta de pagamento", imovel: "Rua 33, nº 120, loja B, Vila Santa Cecília", inicio: "@-1100", aluguel: 4800, garantia: "Sem garantia", debito: 28800, liminar: "Deferida" } },
      { titulo: "Usucapião extraordinária de lote urbano", cliente: "Geraldo Pires de Almeida", fase: 4, orgao: "1ª Vara Cível", comarca: "Pinheiral", valor: 150000, dados: { tipo: "Usucapião", imovel: "Lote 14, quadra C, Parque Maíra", matricula: "Transcrição 8.812", posse: "@-7600", liminar: "Não pedida" } },
    ],
  },
  {
    id: "administrativo", nome: "Administrativo e direito público", grupo: "judicial", tinta: "grafite", padrao: 14, cnj: "8.19",
    resumo: "Mandado de segurança, servidores, concursos, licitações, improbidade.",
    fases: ["Análise", "Via administrativa", "Ação ajuizada", "Liminar", "Informações ou contestação", "Sentença", "Remessa ou recurso", "Precatório ou requisição", "Encerrado"],
    destaque: ["tipo", "ente", "liminar"],
    secoes: [
      sec("Ato e parte", "tipo:Tipo|o|Mandado de segurança;Ação contra ente público;Improbidade administrativa;Licitação e contrato;Concurso público;Servidor público;Processo disciplinar;Desapropriação;Responsabilidade civil do Estado", "ente:Ente ou órgão", "autoridade:Autoridade coatora", "ato:Ato impugnado|l", "ciencia:Ciência do ato|d"),
      sec("Andamento", "liminar:Liminar|o|Não pedida;Pedida;Deferida;Indeferida;Suspensa", "pagamento:Forma de pagamento|o|Não se aplica;Requisição de pequeno valor;Precatório", "valor:Valor|v"),
    ],
    prazos: [
      pz("Mandado de segurança", "120 dias da ciência do ato", "Lei 12.016/09, art. 23"),
      pz("Ação contra a Fazenda Pública", "5 anos", "Decreto 20.910/32, art. 1º"),
      pz("Prazos da Fazenda em juízo", "Contados em dobro", "CPC, art. 183"),
      pz("Contestação na ação de improbidade", "30 dias", "Lei 8.429/92, art. 17, § 7º"),
      pz("Defesa em processo disciplinar federal", "10 dias", "Lei 8.112/90, art. 161, § 1º"),
    ],
    exemplos: [
      { titulo: "Nomeação em concurso dentro das vagas", cliente: "Camila Rezende Portela", contraria: "Município de Barra Mansa", fase: 4, orgao: "Vara de Fazenda Pública", comarca: "Barra Mansa", dados: { tipo: "Mandado de segurança", ente: "Município de Barra Mansa", autoridade: "Secretário de Administração", ato: "Omissão em nomear candidata aprovada dentro do número de vagas", ciencia: "@-70", liminar: "Indeferida", pagamento: "Não se aplica" } },
      { titulo: "Queda em via pública sem sinalização", cliente: "Nair Gonçalves Brito", contraria: "Município de Volta Redonda", fase: 5, orgao: "Vara de Fazenda Pública", comarca: "Volta Redonda", valor: 45000, dados: { tipo: "Responsabilidade civil do Estado", ente: "Município de Volta Redonda", liminar: "Não pedida", pagamento: "Requisição de pequeno valor", valor: 45000 } },
    ],
  },
  {
    id: "saude", nome: "Saúde", grupo: "judicial", tinta: "turquesa", padrao: 15, cnj: "8.19",
    resumo: "Negativa de plano de saúde, medicamentos, cirurgias e leitos pelo SUS.",
    fases: ["Documentação médica", "Ação ajuizada", "Liminar", "Cumprimento da liminar", "Contestação", "Perícia", "Sentença", "Recurso", "Encerrado"],
    destaque: ["pedido", "liminar", "cumprimento"],
    secoes: [
      sec("Pedido", "reu:Réu|o|Operadora de plano de saúde;União;Estado;Município;Estado e Município", "operadora:Operadora ou ente", "pedido:Procedimento ou medicamento", "anvisa:Registro na Anvisa|s", "rol:Previsto no rol da ANS|s", "negativa:Data da negativa|d", "protocolo:Protocolo da negativa"),
      sec("Urgência", "laudo:Laudo médico (médico e CRM)", "urgencia:Urgência ou emergência|s", "liminar:Liminar|o|Não pedida;Pedida;Deferida;Indeferida", "multa:Multa diária|v", "cumprimento:Cumprimento|o|Não se aplica;Pendente;Cumprida;Descumprida;Bloqueio de valores"),
    ],
    prazos: [
      pz("Autorização de urgência e emergência", "Imediata", "Resolução ANS 566/2022"),
      pz("Autorização de internação eletiva", "21 dias úteis", "Resolução ANS 566/2022"),
      pz("Agravo contra decisão sobre a liminar", "15 dias úteis", "CPC, art. 1.015, I"),
    ],
    exemplos: [
      { titulo: "Medicamento oncológico negado pelo plano", cliente: "Helena Vasconcelos Dutra", contraria: "Unisaúde Vale Operadora S.A.", fase: 3, orgao: "5ª Vara Cível", comarca: "Volta Redonda", valor: 260000, dados: { reu: "Operadora de plano de saúde", operadora: "Unisaúde Vale", pedido: "Pembrolizumabe, 6 ciclos", anvisa: "Sim", rol: "Não", negativa: "@-21", laudo: "Dr. André Salles, CRM-RJ 52.88104", urgencia: "Sim", liminar: "Deferida", multa: 2000, cumprimento: "Cumprida" } },
      { titulo: "Cirurgia ortopédica pelo SUS", cliente: "Valdir Soares Amaral", contraria: "Estado do Rio de Janeiro e Município de Resende", fase: 3, orgao: "Vara de Fazenda Pública", comarca: "Resende", dados: { reu: "Estado e Município", pedido: "Artroplastia total de quadril", urgencia: "Não", liminar: "Deferida", multa: 1000, cumprimento: "Descumprida" } },
    ],
  },
  {
    id: "bancario", nome: "Bancário", grupo: "judicial", tinta: "violeta", padrao: 16, cnj: "8.19",
    resumo: "Revisão de contratos, superendividamento, fraudes, consignado e busca e apreensão.",
    fases: FASES_CIVEL, destaque: ["tipo", "instituicao", "financiado"],
    secoes: [
      sec("Contrato", "instituicao:Instituição financeira", "contrato:Nº do contrato", "tipo:Tipo|o|Revisional;Superendividamento;Fraude ou golpe;Consignado não contratado;Busca e apreensão;Execução de cédula", "financiado:Valor financiado|v", "taxa:Taxa contratada", "taxa_media:Taxa média do Banco Central", "parcelas:Parcelas pagas e totais"),
      sec("Situação", "negativacao:Há negativação|s", "bem:Bem dado em garantia", "apreendido:Bem apreendido|s", "plano:Plano de pagamento proposto|l"),
    ],
    prazos: [
      pz("Pagar a dívida na busca e apreensão", "5 dias da execução da liminar", "Decreto-Lei 911/69, art. 3º, § 2º"),
      pz("Resposta na busca e apreensão", "15 dias da execução da liminar", "Decreto-Lei 911/69, art. 3º, § 3º"),
      pz("Reparação por fraude bancária", "5 anos", "CDC, art. 27"),
    ],
    exemplos: [
      { titulo: "Empréstimo consignado não contratado", cliente: "Dalva Ribeiro Sant'Anna", contraria: "Banco Cruzeiro Financeira S.A.", fase: 4, orgao: "Juizado Especial Cível", comarca: "Barra Mansa", valor: 22000, dados: { instituicao: "Banco Cruzeiro Financeira", contrato: "0098.4471.220", tipo: "Consignado não contratado", financiado: 11800, parcelas: "14 de 84", negativacao: "Não" } },
      { titulo: "Repactuação de dívidas por superendividamento", cliente: "Sérgio Paulo Mattos", contraria: "Cinco instituições credoras", fase: 2, orgao: "3ª Vara Cível", comarca: "Volta Redonda", valor: 187000, dados: { tipo: "Superendividamento", financiado: 187000, negativacao: "Sim", plano: "Pagamento em 60 meses, preservado o mínimo existencial" } },
    ],
  },
  {
    id: "ambiental", nome: "Ambiental", grupo: "judicial", tinta: "garrafa", padrao: 17, cnj: "4.02",
    resumo: "Autos de infração, licenciamento, ações civis públicas e termos de ajuste.",
    fases: ["Auto lavrado", "Defesa administrativa", "Julgamento", "Recurso administrativo", "Ação judicial", "Sentença", "Recurso", "Cumprimento ou ajuste", "Encerrado"],
    destaque: ["tipo", "orgao", "multa"],
    secoes: [
      sec("Autuação", "tipo:Tipo|o|Auto de infração;Ação civil pública;Crime ambiental;Licenciamento;Termo de ajustamento de conduta", "orgao:Órgão|o|Ibama;ICMBio;INEA;Secretaria municipal;Ministério Público", "auto:Nº do auto ou processo", "lavratura:Data da lavratura|d", "multa:Multa|v", "embargo:Área ou atividade embargada|s"),
      sec("Regularização", "licenca:Licença (tipo e validade)", "tac:Obrigações do termo de ajuste|l", "reparacao:Projeto de recuperação da área|o|Não exigido;Exigido;Protocolado;Em execução;Concluído"),
    ],
    prazos: [
      pz("Defesa contra auto de infração federal", "20 dias da ciência", "Decreto 6.514/08, art. 113"),
      pz("Recurso da decisão administrativa", "20 dias", "Decreto 6.514/08, art. 127"),
      pz("Renovação de licença ambiental", "120 dias antes do vencimento", "LC 140/11, art. 14, § 4º"),
    ],
    exemplos: [
      { titulo: "Auto de infração por supressão de vegetação", cliente: "Agropecuária Ribeirão Claro Ltda.", contraria: "Ibama", fase: 1, orgao: "Superintendência do Ibama", comarca: "Rio de Janeiro", valor: 74000, dados: { tipo: "Auto de infração", orgao: "Ibama", auto: "9.224.118-E", lavratura: "@-14", multa: 74000, embargo: "Sim", reparacao: "Exigido" } },
      { titulo: "Renovação de licença de operação", cliente: "Cerâmica Bom Jardim Ltda.", contraria: "INEA", fase: 1, orgao: "INEA", comarca: "Barra Mansa", dados: { tipo: "Licenciamento", orgao: "INEA", licenca: "Licença de operação, válida até 03/2027", embargo: "Não", reparacao: "Não exigido" } },
    ],
  },
  {
    id: "eleitoral", nome: "Eleitoral", grupo: "judicial", tinta: "ocre", padrao: 18, cnj: "6.19",
    resumo: "Registro de candidatura, propaganda, prestação de contas e ações eleitorais.",
    fases: ["Consulta", "Pedido ou representação", "Defesa", "Instrução", "Sentença", "Recurso ao TRE", "Recurso ao TSE", "Encerrado"],
    destaque: ["tipo", "cargo", "eleicao"],
    secoes: [
      sec("Feito", "tipo:Tipo|o|Registro de candidatura;Investigação judicial eleitoral;Impugnação de mandato eletivo;Representação por propaganda;Prestação de contas;Recurso contra expedição de diploma", "candidato:Candidato ou partido", "cargo:Cargo", "eleicao:Eleição (ano)", "zona:Zona eleitoral"),
      sec("Contas", "contas:Situação das contas|o|Não se aplica;A prestar;Prestadas;Aprovadas;Aprovadas com ressalvas;Desaprovadas;Não prestadas", "diligencias:Diligências|l"),
    ],
    prazos: [
      pz("Recurso eleitoral", "3 dias", "Código Eleitoral, art. 258"),
      pz("Impugnação ao registro de candidatura", "5 dias da publicação do pedido", "LC 64/90, art. 3º"),
      pz("Impugnação de mandato eletivo", "15 dias da diplomação", "CF, art. 14, § 10"),
      pz("Prazos no período eleitoral", "Contínuos, inclusive fins de semana", "LC 64/90, art. 16"),
    ],
    exemplos: [
      { titulo: "Prestação de contas de campanha", cliente: "Diretório Municipal do Partido Cidadania Viva", fase: 3, orgao: "Zona Eleitoral", comarca: "Barra Mansa", dados: { tipo: "Prestação de contas", candidato: "Diretório municipal", cargo: "Não se aplica", eleicao: "2026", zona: "93ª Zona Eleitoral", contas: "Prestadas", diligencias: "Extratos da conta do fundo partidário; notas de material gráfico" } },
      { titulo: "Representação por propaganda antecipada", cliente: "Vereador Anderson Lemos", fase: 5, orgao: "TRE-RJ", comarca: "Rio de Janeiro", dados: { tipo: "Representação por propaganda", candidato: "Anderson Lemos", cargo: "Deputado estadual", eleicao: "2026", zona: "109ª Zona Eleitoral", contas: "Não se aplica" } },
    ],
  },
  {
    id: "digital", nome: "Digital e proteção de dados", grupo: "judicial", tinta: "violeta", padrao: 19, cnj: "8.19",
    resumo: "Remoção de conteúdo, vazamento de dados, fraudes online e crimes contra a honra.",
    fases: ["Preservação de provas", "Notificação da plataforma", "Ação ajuizada", "Liminar", "Fornecimento de registros", "Sentença", "Recurso", "Encerrado"],
    destaque: ["tipo", "plataforma", "liminar"],
    secoes: [
      sec("Caso", "tipo:Tipo|o|Remoção de conteúdo;Vazamento de dados;Identificação de usuário;Crime contra a honra;Fraude ou golpe;Perfil falso", "plataforma:Plataforma ou controlador", "url:Endereços (URL)|l", "ata:Ata notarial ou captura certificada|s", "conhecimento:Data do conhecimento|d"),
      sec("Medidas", "preservacao:Preservação de registros pedida|s", "liminar:Liminar|o|Não pedida;Pedida;Deferida;Indeferida;Cumprida", "anpd:Comunicação à ANPD|o|Não se aplica;Pendente;Feita", "dano:Dano moral pedido|v"),
    ],
    prazos: [
      pz("Guarda de registros de conexão", "1 ano", "Marco Civil da Internet, art. 13"),
      pz("Guarda de registros de acesso a aplicações", "6 meses", "Marco Civil da Internet, art. 15"),
      pz("Queixa-crime nos crimes contra a honra", "6 meses do conhecimento da autoria", "CPP, art. 38"),
      pz("Resposta ao titular de dados", "15 dias (declaração completa)", "LGPD, art. 19, II"),
    ],
    exemplos: [
      { titulo: "Perfil falso usando fotos da cliente", cliente: "Bruna Tavares Lacerda", contraria: "Plataforma de rede social", fase: 4, orgao: "2ª Vara Cível", comarca: "Resende", valor: 20000, dados: { tipo: "Perfil falso", plataforma: "Rede social Vitrine", url: "vitrine.example/perfil/bruna.tl\nvitrine.example/perfil/bruna_tl2", ata: "Sim", conhecimento: "@-60", preservacao: "Sim", liminar: "Deferida", anpd: "Não se aplica", dano: 20000 } },
      { titulo: "Vazamento de cadastro de clientes de loja virtual", cliente: "Empório Raiz Comércio Digital Ltda.", fase: 0, comarca: "Volta Redonda", dados: { tipo: "Vazamento de dados", plataforma: "Hospedagem contratada", conhecimento: "@-4", preservacao: "Sim", liminar: "Não pedida", anpd: "Pendente" } },
    ],
  },

  // ─────────────────────────── EXTRAJUDICIAL ───────────────────────────
  {
    id: "inventario_cartorio", nome: "Inventário em cartório", grupo: "extrajudicial", tinta: "grafite", padrao: 21,
    resumo: "Inventário e partilha por escritura pública, sobrepartilha e alvarás.",
    fases: ["Levantamento de documentos", "Certidões", "Declaração do ITCMD", "Imposto pago", "Minuta da escritura", "Assinatura", "Registro e transferências", "Concluído"],
    destaque: ["falecido", "tabelionato", "itcmd"],
    secoes: [
      sec("Sucessão", "falecido:Autor da herança", "obito:Data do óbito|d", "tabelionato:Tabelionato", "inventariante:Inventariante", "testamento:Há testamento|s", "incapaz:Herdeiro menor ou incapaz|s", "herdeiros:Herdeiros|l"),
      sec("Bens e imposto", "bens:Bens|l", "monte:Valor do monte|v", "itcmd:ITCMD|o|Não declarado;Declarado;Guia emitida;Pago;Isento", "itcmd_valor:Valor do ITCMD|v", "emolumentos:Emolumentos estimados|v"),
      sec("Documentos", "certidoes:Certidões pendentes|l", "escritura:Data da escritura|d", "registro:Registro nos cartórios de imóveis|o|Não iniciado;Protocolado;Com exigência;Concluído"),
    ],
    prazos: [
      pz("Abertura da sucessão", "2 meses do óbito", "CPC, art. 611"),
      pz("Declaração e pagamento do ITCMD", "Conforme a lei estadual (multa por atraso)", "Lei do estado do bem"),
      pz("Inventário com menor, incapaz ou testamento", "Admitido em cartório com requisitos próprios", "Resolução CNJ 35/2007, alterada pela 571/2024"),
    ],
    exemplos: [
      { titulo: "Inventário de Lourdes Carvalho", cliente: "Família Carvalho (três herdeiros)", fase: 2, orgao: "2º Ofício de Notas", comarca: "Volta Redonda", valor: 820000, dados: { falecido: "Maria de Lourdes Carvalho", obito: "@-38", tabelionato: "2º Ofício de Notas de Volta Redonda", inventariante: "Paulo Carvalho", testamento: "Não", incapaz: "Não", herdeiros: "Paulo, Regina e Simone (filhos)", bens: "Apartamento no Jardim Amália\nCasa em Conservatória\nVeículo", monte: 820000, itcmd: "Não declarado", emolumentos: 9400, certidoes: "Certidão de casamento atualizada\nCND municipal do imóvel de Conservatória" } },
      { titulo: "Sobrepartilha de cotas societárias", cliente: "Regina Carvalho Nunes", fase: 4, orgao: "1º Ofício de Notas", comarca: "Barra Mansa", valor: 96000, dados: { falecido: "Osvaldo Nunes", obito: "@-900", tabelionato: "1º Ofício de Notas de Barra Mansa", testamento: "Não", incapaz: "Não", monte: 96000, itcmd: "Pago", itcmd_valor: 4320 } },
    ],
  },
  {
    id: "divorcio_cartorio", nome: "Divórcio em cartório", grupo: "extrajudicial", tinta: "vinho", padrao: 22,
    resumo: "Divórcio e dissolução de união estável por escritura, com partilha.",
    fases: ["Atendimento", "Documentos", "Minuta", "Revisão pelas partes", "Assinatura", "Averbação", "Concluído"],
    destaque: ["tipo", "tabelionato", "averbacao"],
    secoes: [
      sec("Acordo", "tipo:Tipo|o|Divórcio consensual;Dissolução de união estável;Conversão de separação em divórcio", "tabelionato:Tabelionato", "filhos:Filhos menores ou incapazes|s", "judicial:Guarda e alimentos já resolvidos em juízo|s", "nome:Retomada do nome de solteiro|s", "alimentos:Alimentos entre os cônjuges"),
      sec("Partilha", "bens:Bens e divisão|l", "imposto:Imposto sobre excesso de meação|o|Não há;A recolher;Recolhido", "escritura:Data da escritura|d", "averbacao:Averbação no registro civil|o|Pendente;Protocolada;Concluída"),
    ],
    prazos: [
      pz("Divórcio com filhos menores", "Possível em cartório quando guarda, convivência e alimentos já estão resolvidos em juízo", "Resolução CNJ 35/2007, alterada pela 571/2024"),
      pz("Presença de advogado", "Obrigatória na escritura", "CPC, art. 733, § 2º"),
    ],
    exemplos: [
      { titulo: "Divórcio consensual com partilha", cliente: "Aline e Gustavo Prates", fase: 3, orgao: "3º Ofício de Notas", comarca: "Volta Redonda", dados: { tipo: "Divórcio consensual", tabelionato: "3º Ofício de Notas", filhos: "Não", nome: "Sim", bens: "Apartamento: 50% para cada um\nVeículo: fica com Gustavo, com compensação", imposto: "Não há", averbacao: "Pendente" } },
      { titulo: "Dissolução de união estável", cliente: "Mônica Estrela Faria", contraria: "Leandro Bastos", fase: 5, orgao: "1º Ofício de Notas", comarca: "Resende", dados: { tipo: "Dissolução de união estável", tabelionato: "1º Ofício de Notas de Resende", filhos: "Não", nome: "Não", imposto: "Não há", escritura: "@-9", averbacao: "Protocolada" } },
    ],
  },
  {
    id: "usucapiao_cartorio", nome: "Usucapião em cartório", grupo: "extrajudicial", tinta: "garrafa", padrao: 23,
    resumo: "Usucapião extrajudicial no registro de imóveis, com ata notarial.",
    fases: ["Análise da posse", "Planta e memorial", "Ata notarial", "Protocolo no registro", "Notificações", "Edital", "Nota de exigência", "Registro", "Concluído"],
    destaque: ["modalidade", "imovel", "prenotacao"],
    secoes: [
      sec("Posse", "modalidade:Modalidade|o|Extraordinária;Ordinária;Especial urbana;Especial rural;Familiar", "imovel:Imóvel", "matricula:Matrícula ou transcrição", "tempo:Tempo de posse", "origem:Origem da posse|l"),
      sec("Documentos técnicos", "planta:Planta e memorial com responsabilidade técnica|s", "ata:Ata notarial|o|Não lavrada;Agendada;Lavrada", "anuencia:Anuência dos confrontantes|o|Pendente;Parcial;Completa"),
      sec("Registro", "cartorio:Registro de imóveis", "prenotacao:Prenotação (número e data)", "notificacoes:Notificações expedidas|l", "impugnacao:Houve impugnação|s"),
    ],
    prazos: [
      pz("Manifestação dos notificados", "15 dias (o silêncio vale como concordância)", "Lei 6.015/73, art. 216-A, § 2º"),
      pz("Manifestação de terceiros após o edital", "15 dias", "Lei 6.015/73, art. 216-A, § 4º"),
      pz("Tempo de posse (extraordinária)", "15 anos, ou 10 com moradia ou obras", "CC, art. 1.238"),
      pz("Tempo de posse (especial urbana)", "5 anos, até 250 m²", "CF, art. 183"),
    ],
    exemplos: [
      { titulo: "Usucapião de casa em loteamento antigo", cliente: "Benedita Fonseca Arruda", fase: 4, orgao: "2º Registro de Imóveis", comarca: "Barra Mansa", valor: 210000, dados: { modalidade: "Extraordinária", imovel: "Rua Projetada B, nº 48, Vila Nova", matricula: "Matrícula 14.207 (em nome do loteador)", tempo: "23 anos", planta: "Sim", ata: "Lavrada", anuencia: "Parcial", cartorio: "2º Registro de Imóveis de Barra Mansa", prenotacao: "88.412, de 12/10/2026", impugnacao: "Não" } },
      { titulo: "Usucapião especial urbana", cliente: "Jorge Luiz Paranhos", fase: 1, comarca: "Volta Redonda", valor: 130000, dados: { modalidade: "Especial urbana", imovel: "Travessa das Acácias, nº 9, Retiro", tempo: "8 anos", planta: "Não", ata: "Não lavrada", anuencia: "Pendente", impugnacao: "Não" } },
    ],
  },
  {
    id: "contratos", nome: "Contratos", grupo: "extrajudicial", tinta: "cobalto", padrao: 24,
    resumo: "Elaboração, revisão e gestão de contratos, com controle de vigência.",
    fases: ["Pedido", "Minuta", "Em negociação", "Versão final", "Assinatura", "Vigente", "Encerrado"],
    destaque: ["tipo", "fim", "renovacao"],
    secoes: [
      sec("Contrato", "tipo:Tipo de contrato", "partes:Partes|l", "objeto:Objeto|l", "valor:Valor|v", "versao:Versão atual", "assinatura:Forma de assinatura|o|Física;Certificado digital;Assinatura eletrônica"),
      sec("Vigência", "inicio:Início|d", "fim:Fim da vigência|d", "renovacao:Renovação automática|s", "aviso:Aviso prévio para rescisão", "reajuste:Índice e data de reajuste"),
      sec("Cláusulas de atenção", "multa:Multa por rescisão", "foro:Foro ou arbitragem", "exclusividade:Exclusividade ou não concorrência|s", "obs:Pontos negociados|l"),
    ],
    prazos: [
      pz("Aviso de não renovação", "Conforme o contrato (o sistema alerta 60 dias antes do fim)", "Cláusula de vigência"),
      pz("Reajuste anual", "Na data-base do contrato", "Lei 10.192/01, art. 2º"),
    ],
    exemplos: [
      { titulo: "Contrato de fornecimento: revisão", cliente: "Distribuidora Três Rios Ltda.", contraria: "Laticínios Serra da Bocaina", fase: 2, valor: 540000, dados: { tipo: "Fornecimento com exclusividade regional", partes: "Distribuidora Três Rios (compradora)\nLaticínios Serra da Bocaina (fornecedora)", valor: 540000, versao: "v3, com comentários da contraparte", assinatura: "Certificado digital", inicio: "@+20", fim: "@+750", renovacao: "Sim", aviso: "90 dias", reajuste: "IPCA, anual", exclusividade: "Sim", foro: "Câmara de arbitragem, Rio de Janeiro" } },
      { titulo: "Locação comercial: acompanhamento da vigência", cliente: "Clínica Vida Plena Ltda.", contraria: "Espólio de Álvaro Sampaio", fase: 5, valor: 132000, dados: { tipo: "Locação não residencial", valor: 132000, assinatura: "Física", inicio: "@-1420", fim: "@+405", renovacao: "Não", aviso: "30 dias", reajuste: "IGP-M, todo mês de março", multa: "3 aluguéis, proporcional" } },
    ],
  },
  {
    id: "consultivo", nome: "Consultivo e pareceres", grupo: "extrajudicial", tinta: "turquesa", padrao: 25,
    resumo: "Consultas, pareceres, opiniões legais e auditorias, com controle de horas.",
    fases: ["Consulta recebida", "Proposta enviada", "Em pesquisa", "Em redação", "Revisão", "Entregue", "Faturado"],
    destaque: ["tipo", "entrega", "horas_gastas"],
    secoes: [
      sec("Consulta", "tipo:Tipo|o|Parecer;Opinião legal;Consulta verbal;Auditoria jurídica;Treinamento", "solicitante:Solicitante", "materia:Matéria", "pergunta:Pergunta a responder|l"),
      sec("Entrega e horas", "entrega:Prazo de entrega|d", "horas_est:Horas estimadas|n", "horas_gastas:Horas lançadas|n", "cobranca:Forma de cobrança|o|Valor fechado;Por hora;Mensalidade de assessoria", "entregue:Entregue em|d"),
    ],
    prazos: [pz("Entrega do parecer", "Conforme a proposta aceita", "Contrato de honorários")],
    exemplos: [
      { titulo: "Parecer sobre terceirização da frota", cliente: "Transportes Guará Ltda.", fase: 3, valor: 12000, dados: { tipo: "Parecer", solicitante: "Diretoria administrativa", materia: "Trabalhista e contratual", pergunta: "Riscos de vínculo na contratação de motoristas como pessoa jurídica", entrega: "@+8", horas_est: 24, horas_gastas: 15, cobranca: "Valor fechado" } },
      { titulo: "Assessoria mensal: condomínio", cliente: "Condomínio Edifício Solar das Palmeiras", fase: 2, valor: 1800, dados: { tipo: "Consulta verbal", solicitante: "Síndico", materia: "Condominial", cobranca: "Mensalidade de assessoria", horas_est: 6, horas_gastas: 4 } },
    ],
  },
  {
    id: "societario", nome: "Societário", grupo: "extrajudicial", tinta: "cobalto", padrao: 26,
    resumo: "Constituição, alterações, acordos de sócios, atas e registro na Junta.",
    fases: ["Coleta de informações", "Minuta", "Assinaturas", "Protocolo no registro", "Exigência", "Registrado", "Atualização cadastral", "Concluído"],
    destaque: ["ato", "empresa", "protocolo"],
    secoes: [
      sec("Sociedade", "empresa:Empresa", "cnpj:CNPJ", "tipo:Tipo societário|o|Limitada;Limitada unipessoal;Sociedade anônima;Sociedade simples;Cooperativa;Associação", "capital:Capital social|v", "socios:Sócios e participações|l"),
      sec("Ato", "ato:Ato|o|Constituição;Alteração contratual;Cessão de quotas;Transformação;Fusão, cisão ou incorporação;Distrato;Acordo de sócios;Ata de assembleia ou reunião", "orgao:Órgão de registro|o|Junta Comercial;Registro Civil de Pessoas Jurídicas", "assinatura:Data da assinatura|d", "protocolo:Protocolo", "exigencia:Exigências|l", "registro:Registrado em|d"),
    ],
    prazos: [
      pz("Levar o ato a registro", "30 dias da assinatura, para os efeitos retroagirem", "Lei 8.934/94, art. 36"),
      pz("Aprovação das contas dos administradores", "Até 4 meses após o fim do exercício", "CC, art. 1.078"),
    ],
    exemplos: [
      { titulo: "Alteração contratual: entrada de sócio", cliente: "Ferragens Santa Rita Ltda.", fase: 3, valor: 4500, dados: { empresa: "Ferragens Santa Rita Ltda.", tipo: "Limitada", capital: 300000, socios: "Rita Almeida 60%\nCésar Almeida 25%\nNovo sócio: Davi Moraes 15%", ato: "Cessão de quotas", orgao: "Junta Comercial", assinatura: "@-11", protocolo: "JUCERJA 2026/118.442-0" } },
      { titulo: "Constituição de holding familiar", cliente: "Família Honorato", fase: 1, valor: 18000, dados: { empresa: "Honorato Participações Ltda. (em constituição)", tipo: "Limitada", capital: 1200000, ato: "Constituição", orgao: "Junta Comercial" } },
    ],
  },
  {
    id: "compliance", nome: "Compliance e LGPD", grupo: "extrajudicial", tinta: "violeta", padrao: 27,
    resumo: "Programas de integridade, adequação à LGPD, políticas e treinamentos.",
    fases: ["Diagnóstico", "Mapeamento", "Plano de ação", "Políticas e contratos", "Treinamento", "Monitoramento"],
    destaque: ["escopo", "mapeamento", "incidentes"],
    secoes: [
      sec("Programa", "escopo:Escopo|o|Adequação à LGPD;Programa de integridade;Canal de denúncias;Investigação interna;Código de conduta", "encarregado:Encarregado de dados", "mapeamento:Mapeamento de dados|o|Não iniciado;Em andamento;Concluído", "politicas:Políticas entregues|l"),
      sec("Rotina", "treinamentos:Treinamentos realizados|l", "incidentes:Incidentes registrados|n", "pedidos:Pedidos de titulares em aberto|n", "revisao:Próxima revisão|d"),
    ],
    prazos: [
      pz("Comunicar incidente de segurança à ANPD e aos titulares", "3 dias úteis do conhecimento", "Resolução CD/ANPD 15/2024"),
      pz("Responder ao titular (declaração completa)", "15 dias", "LGPD, art. 19, II"),
    ],
    exemplos: [
      { titulo: "Adequação à LGPD: clínica", cliente: "Clínica Vida Plena Ltda.", fase: 2, valor: 22000, dados: { escopo: "Adequação à LGPD", encarregado: "Marina Lopes (gerente administrativa)", mapeamento: "Concluído", politicas: "Política de privacidade\nTermo de consentimento do paciente", incidentes: 0, pedidos: 1, revisao: "@+150" } },
      { titulo: "Canal de denúncias e código de conduta", cliente: "Metalúrgica Paraíba do Sul Ltda.", fase: 0, valor: 15000, dados: { escopo: "Canal de denúncias", mapeamento: "Não iniciado", incidentes: 0, pedidos: 0 } },
    ],
  },
  {
    id: "mediacao", nome: "Mediação e arbitragem", grupo: "extrajudicial", tinta: "turquesa", padrao: 28,
    resumo: "Mediações privadas, conciliações e procedimentos arbitrais.",
    fases: ["Convite à outra parte", "Termo inicial", "Sessões", "Proposta de acordo", "Termo de acordo ou sentença", "Cumprimento", "Encerrado"],
    destaque: ["tipo", "camara", "disputa"],
    secoes: [
      sec("Procedimento", "tipo:Tipo|o|Mediação;Conciliação;Arbitragem;Negociação direta", "camara:Câmara", "mediador:Mediador ou árbitro", "disputa:Valor em disputa|v", "custas:Custas da câmara|v"),
      sec("Sessões", "sessoes:Sessões realizadas|n", "proxima:Próxima sessão|d", "pontos:Pontos de impasse|l", "resultado:Resultado|o|Em andamento;Acordo total;Acordo parcial;Sem acordo;Sentença arbitral"),
    ],
    prazos: [
      pz("Pedido de esclarecimentos da sentença arbitral", "5 dias", "Lei 9.307/96, art. 30"),
      pz("Ação anulatória da sentença arbitral", "90 dias", "Lei 9.307/96, art. 33, § 1º"),
      pz("Sentença arbitral", "6 meses, salvo convenção", "Lei 9.307/96, art. 23"),
    ],
    exemplos: [
      { titulo: "Mediação entre sócios", cliente: "Olívia Camargo Reis", contraria: "Hugo Tavares", fase: 2, valor: 900000, dados: { tipo: "Mediação", camara: "Câmara de Mediação do Sul Fluminense", mediador: "Dra. Estela Rangel", disputa: 900000, custas: 6800, sessoes: 2, proxima: "@+5", pontos: "Critério de avaliação das quotas; prazo de pagamento", resultado: "Em andamento" } },
      { titulo: "Arbitragem: contrato de empreitada", cliente: "Construtora Serra Azul S.A.", contraria: "Consórcio Ponte Nova", fase: 2, valor: 2400000, dados: { tipo: "Arbitragem", camara: "Câmara de Arbitragem Empresarial", disputa: 2400000, custas: 58000, sessoes: 1, resultado: "Em andamento" } },
    ],
  },
  {
    id: "notificacoes", nome: "Notificações e cobranças", grupo: "extrajudicial", tinta: "ocre", padrao: 29,
    resumo: "Notificações extrajudiciais, cobranças amigáveis, protestos e acordos.",
    fases: ["Redação", "Enviada", "Recebida", "Prazo em curso", "Respondida", "Acordo", "Protesto ou ação", "Encerrado"],
    destaque: ["destinatario", "meio", "prazo"],
    secoes: [
      sec("Notificação", "destinatario:Destinatário", "objeto:Objeto|l", "meio:Meio|o|Cartório de títulos e documentos;Carta com aviso de recebimento;E-mail com confirmação;Aplicativo de mensagens;Plataforma digital", "envio:Enviada em|d", "recebimento:Recebida em|d", "prazo:Prazo concedido"),
      sec("Cobrança", "valor:Valor cobrado|v", "resposta:Resposta|l", "protesto:Protesto|o|Não se aplica;A enviar;Protestado;Pago em cartório;Sustado", "acordo:Acordo (condições)|l"),
    ],
    prazos: [
      pz("Pagamento do título apontado para protesto", "3 dias úteis da intimação", "Lei 9.492/97, arts. 12 e 13"),
      pz("Cobrança de dívida líquida em instrumento", "Prescreve em 5 anos", "CC, art. 206, § 5º, I"),
    ],
    exemplos: [
      { titulo: "Notificação por descumprimento contratual", cliente: "Ateliê Flor de Lis ME", contraria: "Shopping Pátio das Flores", fase: 3, valor: 18600, dados: { destinatario: "Administração do Shopping Pátio das Flores", objeto: "Devolução de luvas e multa por rescisão antecipada", meio: "Cartório de títulos e documentos", envio: "@-12", recebimento: "@-8", prazo: "10 dias", valor: 18600, protesto: "Não se aplica" } },
      { titulo: "Cobrança de mensalidades escolares", cliente: "Colégio Novo Saber Ltda.", fase: 5, valor: 64300, dados: { destinatario: "22 responsáveis inadimplentes", meio: "E-mail com confirmação", envio: "@-40", valor: 64300, protesto: "A enviar", acordo: "11 acordos fechados, em até 6 parcelas" } },
    ],
  },
  {
    id: "regularizacao", nome: "Regularização de imóveis", grupo: "extrajudicial", tinta: "garrafa", padrao: 30,
    resumo: "Averbações, retificações, adjudicação em cartório e compra e venda.",
    fases: ["Análise da matrícula", "Documentos", "Protocolo", "Nota de exigência", "Cumprimento da exigência", "Registro ou averbação", "Concluído"],
    destaque: ["pendencia", "imovel", "prenotacao"],
    secoes: [
      sec("Imóvel", "imovel:Imóvel", "matricula:Matrícula", "cartorio:Registro de imóveis", "pendencia:Serviço|o|Averbação de construção;Retificação de área;Desmembramento ou unificação;Adjudicação compulsória em cartório;Regularização fundiária;Georreferenciamento;Baixa de hipoteca ou alienação;Compra e venda com escritura"),
      sec("Andamento", "prenotacao:Prenotação (número e data)", "exigencias:Exigências|l", "imposto:Imposto de transmissão|o|Não se aplica;A recolher;Recolhido", "habite:Habite-se ou certidão de construção|s", "emolumentos:Emolumentos|v"),
    ],
    prazos: [
      pz("Validade da prenotação", "20 dias úteis", "Lei 6.015/73, art. 205"),
      pz("Qualificação do título pelo cartório", "10 dias úteis", "Lei 6.015/73, art. 188"),
      pz("Adjudicação compulsória em cartório", "Notificação do vendedor com 15 dias para manifestação", "Lei 6.015/73, art. 216-B"),
    ],
    exemplos: [
      { titulo: "Averbação de construção e habite-se", cliente: "Geraldo Pires de Almeida", fase: 3, orgao: "1º Registro de Imóveis", comarca: "Volta Redonda", valor: 3200, dados: { imovel: "Rua 207, nº 55, Conforto", matricula: "22.918", cartorio: "1º Registro de Imóveis de Volta Redonda", pendencia: "Averbação de construção", prenotacao: "141.220, de 28/10/2026", exigencias: "Certidão negativa do INSS da obra\nPlanta aprovada com carimbo legível", imposto: "Não se aplica", habite: "Sim", emolumentos: 1840 } },
      { titulo: "Adjudicação compulsória em cartório", cliente: "Nelson Farias Borba", contraria: "Construtora Ideal (inativa)", fase: 1, comarca: "Barra Mansa", valor: 5000, dados: { imovel: "Apartamento 302, Edifício Ipê", matricula: "9.775", pendencia: "Adjudicação compulsória em cartório", imposto: "A recolher", habite: "Sim" } },
    ],
  },
  {
    id: "planejamento", nome: "Planejamento sucessório", grupo: "extrajudicial", tinta: "vinho", padrao: 31,
    resumo: "Testamentos, doações com usufruto, holdings familiares e pactos.",
    fases: ["Entrevista", "Levantamento patrimonial", "Proposta de estrutura", "Minutas", "Assinatura e registro", "Revisão periódica"],
    destaque: ["instrumento", "patrimonio", "revisao"],
    secoes: [
      sec("Família e patrimônio", "titular:Titular do patrimônio", "herdeiros:Herdeiros e legatários|l", "patrimonio:Patrimônio estimado|v", "regime:Regime de bens"),
      sec("Estrutura", "instrumento:Instrumento|o|Testamento público;Testamento particular;Doação com reserva de usufruto;Holding familiar;Pacto antenupcial;Contrato de convivência;Diretivas antecipadas de vontade", "clausulas:Cláusulas restritivas|l", "imposto:Imposto estimado|v", "revisao:Próxima revisão|d"),
    ],
    prazos: [
      pz("Parte disponível do patrimônio", "Metade, havendo herdeiros necessários", "CC, art. 1.789"),
      pz("Registro do pacto antenupcial", "Antes do casamento, por escritura pública", "CC, art. 1.653"),
    ],
    exemplos: [
      { titulo: "Doação de imóveis com reserva de usufruto", cliente: "Marta Honorato Vieira", fase: 3, valor: 14000, dados: { titular: "Marta Honorato Vieira", herdeiros: "Dois filhos maiores", patrimonio: 1900000, instrumento: "Doação com reserva de usufruto", clausulas: "Incomunicabilidade e reversão", imposto: 76000, revisao: "@+365" } },
      { titulo: "Testamento público", cliente: "Álvaro Mendonça Sá", fase: 1, valor: 6000, dados: { titular: "Álvaro Mendonça Sá", herdeiros: "Esposa e três filhos; legado para a afilhada", patrimonio: 3400000, instrumento: "Testamento público", regime: "Comunhão universal" } },
    ],
  },
  {
    id: "marcas", nome: "Marcas e propriedade intelectual", grupo: "extrajudicial", tinta: "tijolo", padrao: 32,
    resumo: "Registro de marca no INPI, oposições, prorrogações e licenças.",
    fases: ["Busca prévia", "Depósito", "Publicação", "Oposição", "Exame de mérito", "Deferimento", "Concessão", "Vigente"],
    destaque: ["marca", "classe", "vigencia"],
    secoes: [
      sec("Marca", "marca:Marca", "processo:Nº do processo no INPI", "classe:Classe (NCL)", "apresentacao:Apresentação|o|Nominativa;Mista;Figurativa;Tridimensional", "deposito:Data do depósito|d"),
      sec("Andamento", "situacao:Situação|o|Aguardando exame formal;Publicada;Com oposição;Em exame de mérito;Deferida;Indeferida;Registrada;Extinta", "oposicao:Oposição ou exigência|l", "concessao:Concessão|d", "vigencia:Vigência até|d"),
    ],
    prazos: [
      pz("Oposição ao pedido de registro", "60 dias da publicação", "Lei 9.279/96, art. 158"),
      pz("Manifestação sobre a oposição", "60 dias", "Lei 9.279/96, art. 158, § 1º"),
      pz("Recurso contra o indeferimento", "60 dias", "Lei 9.279/96, art. 212"),
      pz("Pagamento da concessão", "60 dias do deferimento", "Lei 9.279/96, art. 162"),
      pz("Prorrogação do registro", "No último ano do decênio", "Lei 9.279/96, art. 133"),
    ],
    exemplos: [
      { titulo: "Registro da marca Flor de Lis", cliente: "Ateliê Flor de Lis ME", fase: 3, valor: 3800, dados: { marca: "Flor de Lis Ateliê", processo: "931.204.557", classe: "25 (vestuário)", apresentacao: "Mista", deposito: "@-200", situacao: "Com oposição", oposicao: "Oposição de titular de marca semelhante na classe 25; manifestação em preparo" } },
      { titulo: "Prorrogação de registro", cliente: "Laticínios Serra da Bocaina", fase: 7, valor: 2200, dados: { marca: "Bocaina", processo: "902.118.330", classe: "29 (laticínios)", apresentacao: "Nominativa", situacao: "Registrada", concessao: "@-3400", vigencia: "@+250" } },
    ],
  },
];

export const AREA_POR_ID: Record<string, Area> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
export const areaDe = (id?: string): Area => AREA_POR_ID[id ?? ""] ?? AREAS[0];

/** Converte o "tipo" do Justio atual para a área correspondente aqui. */
export const TIPO_JUSTIO_PARA_AREA: Record<string, string> = {
  civel: "civel", familia: "familia", criminal: "criminal", juri: "juri", execucao_penal: "execucao_penal",
  inquerito_policial: "inquerito", bo_pm: "inquerito", trabalhista: "trabalhista", previdenciario: "previdenciario",
  tributario: "tributario", federal: "administrativo", outro: "civel",
};
