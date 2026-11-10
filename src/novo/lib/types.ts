export type Prioridade = "alta" | "media" | "baixa";
export type StatusCaso = "ativo" | "suspenso" | "arquivado" | "encerrado";

export interface Cliente {
  id: string; nome: string; tipo: "pf" | "pj"; documento?: string; email?: string; celular?: string;
  cidade?: string; uf?: string; profissao?: string; origem?: string; observacoes?: string; criado_em: string;
}
export interface Caso {
  id: string; natureza: "judicial" | "extrajudicial"; area: string; numero: string; titulo: string;
  status: StatusCaso; fase: number; orgao?: string; comarca?: string; uf?: string;
  cliente_id: string; cliente_nome: string; parte_contraria?: string; valor?: number;
  responsavel_id: string; distribuido_em?: string; dados: Record<string, string | number>;
  /** Chance de êxito estimada pelo responsável (provisão). */
  risco?: "provavel" | "possivel" | "remoto";
  /** Documentos que o cliente ainda precisa entregar. */
  docs_pendentes?: DocPendente[];
  criado_em: string;
}
export interface DocPendente { id: string; nome: string; pedido_em: string; recebido: boolean; recebido_em?: string; obs?: string }
export interface Prazo {
  id: string; caso_id: string; titulo: string; data: string; fatal: boolean; concluido: boolean;
  prioridade: Prioridade; responsavel_id: string; base?: string;
}
export interface Audiencia {
  id: string; caso_id: string; titulo: string; data_hora: string; local?: string;
  modalidade: "presencial" | "virtual" | "híbrida"; realizada: boolean; responsavel_id: string; observacoes?: string;
}
export interface Andamento {
  id: string; caso_id: string; data: string; descricao: string; fonte: "tribunal" | "manual" | "diário" | "cartório";
  lido: boolean; texto_cliente?: string;
}
export interface Publicacao {
  id: string; caso_id?: string; data: string; diario: string; orgao: string; texto: string; lida: boolean;
  prazo_sugerido?: string;
}
export interface Honorario {
  id: string; caso_id: string; descricao: string; valor: number; vencimento: string;
  status: "pendente" | "recebido" | "cancelado"; recebido_em?: string;
  tipo: "contratual" | "êxito" | "sucumbência" | "consulta" | "mensalidade";
}
export interface Conta {
  id: string; descricao: string; categoria: string; valor: number; vencimento: string;
  status: "pendente" | "paga"; recorrente: boolean;
}
export interface Atendimento {
  id: string; cliente_id?: string; cliente_nome: string; caso_id?: string; data_hora: string; duracao_min: number;
  tipo: "consulta inicial" | "retorno" | "orientação" | "preparação de audiência" | "visita à unidade prisional";
  status: "agendado" | "realizado" | "cancelado"; notas?: string; responsavel_id: string; valor?: number;
}
export interface Tarefa {
  id: string; caso_id?: string; titulo: string; estado: "a fazer" | "fazendo" | "feito";
  prioridade: Prioridade; responsavel_id: string; limite?: string;
}
export interface Lead {
  id: string; nome: string; contato: string; area: string; resumo: string; canal: string;
  etapa: "novo" | "em análise" | "proposta enviada" | "fechado" | "descartado";
  urgencia: Prioridade; valor_proposta?: number; criado_em: string;
  /** Preenchido quando o contato fechado virou cliente e caso. */
  convertido_caso_id?: string;
}
export interface Colaborador {
  id: string; nome: string; cargo: string;
  vinculo: "sócia" | "associado" | "CLT" | "estágio" | "consultor";
  oab?: string; email: string; celular: string; admissao: string; nascimento: string;
  remuneracao: number; areas: string[]; carga_semanal: number; meta_horas?: number;
  /** Vencimentos que o RH de um escritório precisa vigiar. */
  certificado_digital?: string; anuidade_oab?: string; fim_contrato_estagio?: string; exame_periodico?: string;
  instituicao_ensino?: string; ativo: boolean; cor: string;
}
export interface Ausencia {
  id: string; colaborador_id: string; tipo: "férias" | "recesso de estágio" | "licença médica" | "folga" | "licença-maternidade" | "curso";
  inicio: string; fim: string; status: "solicitada" | "aprovada" | "recusada"; observacao?: string;
}
export interface Vaga {
  id: string; titulo: string; vinculo: string; area: string; aberta_em: string; status: "aberta" | "pausada" | "preenchida";
}
export interface Candidato {
  id: string; vaga_id: string; nome: string; etapa: "triagem" | "entrevista" | "prova prática" | "proposta" | "contratado" | "dispensado";
  origem: string; nota?: number; observacao?: string;
}
export interface Avaliacao {
  id: string; colaborador_id: string; ciclo: string; tecnica: number; prazos: number; atendimento: number; equipe: number;
  comentario: string; metas: string;
}
export interface Hora {
  id: string; colaborador_id: string; caso_id?: string; data: string; minutos: number; atividade: string; faturavel: boolean;
}
export interface Procuracao {
  id: string; caso_id?: string; cliente_nome: string; tipo: "procuração" | "substabelecimento com reserva" | "substabelecimento sem reserva";
  outorgado: string; poderes: string; data: string; validade?: string;
}
export interface Correspondente {
  id: string; nome: string; cidade: string; uf: string; servicos: string; contato: string; valor_diligencia: number; avaliacao: number;
}
export interface Custa {
  id: string; caso_id: string; descricao: string; tipo: "custas" | "depósito recursal" | "depósito judicial" | "perícia" | "diligência" | "emolumentos" | "alvará a repassar";
  valor: number; data: string; reembolsavel: boolean; reembolsado: boolean;
}
export interface Anotacao { id: string; caso_id: string; texto: string; data: string; autor_id: string }
export interface Treinamento {
  id: string; colaborador_id: string; titulo: string; instituicao: string; horas: number; conclusao?: string; status: "em curso" | "concluído" | "planejado";
}

export interface Ponto { id: string; colaborador_id: string; data: string; entrada: string; saida?: string; intervalo_min: number }
export interface DocumentoGerado {
  id: string; caso_id?: string; cliente_nome: string; modelo: string; titulo: string; texto: string; criado_em: string;
  assinatura: "rascunho" | "enviado para assinatura" | "assinado"; assinado_em?: string;
}
export type Perfil = "socio" | "advogado" | "estagiario" | "financeiro";

export interface Config {
  escritorio: string; responsavel: string; oab: string; cidade: string;
  areasAtivas: string[]; fonte: "demonstracao" | "copia";
  pix_chave?: string; perfil?: Perfil;
}

export interface DB {
  versao: number; config: Config;
  clientes: Cliente[]; casos: Caso[]; prazos: Prazo[]; audiencias: Audiencia[]; andamentos: Andamento[];
  publicacoes: Publicacao[]; honorarios: Honorario[]; contas: Conta[]; atendimentos: Atendimento[];
  tarefas: Tarefa[]; leads: Lead[]; equipe: Colaborador[]; ausencias: Ausencia[]; vagas: Vaga[];
  candidatos: Candidato[]; avaliacoes: Avaliacao[]; horas: Hora[]; procuracoes: Procuracao[];
  correspondentes: Correspondente[]; custas: Custa[]; anotacoes: Anotacao[]; treinamentos: Treinamento[];
  pontos: Ponto[]; documentos: DocumentoGerado[];
}
export type Tabela = Exclude<keyof DB, "versao" | "config">;
