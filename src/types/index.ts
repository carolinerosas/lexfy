export type ProcessoStatus = "ativo" | "suspenso" | "arquivado" | "encerrado";
// As classificações abaixo aceitam valores customizados (cadastrados pela usuária via "Outro").
// O (string & {}) mantém o autocomplete dos valores conhecidos e permite texto livre.
export type ProcessoTipo =
  | "civel"
  | "familia"
  | "criminal"
  | "juri"
  | "execucao_penal"
  | "inquerito_policial"
  | "bo_pm"
  | "trabalhista"
  | "previdenciario"
  | "tributario"
  | "federal"
  | "outro"
  | (string & {});
export type ProcessoResultadoTipo =
  | "sentenca_favoravel"
  | "exito"
  | "sentenca_desfavoravel"
  | "pronuncia"
  | "impronuncia"
  | "pena"
  | "acordo"
  | "outro"
  | (string & {});
export type PrazoTipo =
  | "recurso"
  | "contestacao"
  | "peticao"
  | "contrarrazoes"
  | "outro";
export type Prioridade = "alta" | "media" | "baixa";
export type AudienciaTipo =
  | "instrucao"
  | "conciliacao"
  | "julgamento"
  | "una"
  | "outro";
export type HonorarioStatus = "pendente" | "recebido" | "cancelado";
export type HonorarioTipo = "contratual" | "sucumbencial" | "exito" | "outro";
export type ContaEscritorioStatus = "pendente" | "paga" | "cancelada";
export type ContaEscritorioCategoria =
  | "aluguel"
  | "condominio"
  | "internet"
  | "telefone"
  | "energia"
  | "agua"
  | "software"
  | "contador"
  | "tributos"
  | "marketing"
  | "material"
  | "servicos"
  | "outro"
  | (string & {});
export type IncidenteExecucaoTipo =
  | "trabalho_extramuros"
  | "progressao_regime"
  | "livramento_condicional"
  | "remicao"
  | "saida_temporaria"
  | "regressao"
  | "unificacao_penas"
  | "detracao"
  | "indulto"
  | "comutacao"
  | "extincao_pena"
  | "outro"
  | (string & {});
export type IncidenteExecucaoStatus =
  | "em_preparacao"
  | "protocolado"
  | "em_andamento"
  | "deferido"
  | "indeferido"
  | "cumprido"
  | "arquivado";
export type BeneficioPenalTipo = "comutacao" | "indulto";
export type BeneficioPenalStatus =
  | "em_estudo"
  | "requerido"
  | "deferido"
  | "indeferido"
  | "prejudicado";
export type InqueritoSituacao =
  | "em_andamento"
  | "relatado"
  | "denunciado"
  | "arquivado"
  | "baixado"
  | "outro"
  | (string & {});

export type AtendimentoStatus = "agendado" | "realizado" | "cancelado";
export type AtendimentoTipo =
  | "consulta_inicial"
  | "retorno"
  | "orientacao"
  | "audiencia_prep"
  | "outro";

export interface Cliente {
  id: string;
  nome: string;
  cpf?: string;
  rg?: string;
  sexo?: string;
  nacionalidade?: string;
  estado_civil?: string;
  profissao?: string;
  email?: string;
  celular?: string;
  cep?: string;
  logradouro?: string;
  numero_end?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  unidade_prisional?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface ProcessoClienteParte {
  cliente_id?: string;
  nome: string;
  cpf_cnpj?: string;
  papel?: string;
  // Dados completos do litisconsorte preenchidos na triagem. Só viram um cliente
  // de verdade (cliente_id preenchido) quando a usuária clica em "+ cliente".
  rg?: string;
  email?: string;
  celular?: string;
  cep?: string;
  logradouro?: string;
  numero_end?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface Processo {
  id: string;
  numero: string;
  titulo: string;
  descricao?: string;
  status: ProcessoStatus;
  tribunal?: string;
  vara?: string;
  comarca?: string;
  uf?: string;
  tipo?: ProcessoTipo;
  fase?: string;
  cliente_id?: string;
  cliente_nome: string;
  cliente_cpf_cnpj?: string;
  clientes_partes?: ProcessoClienteParte[];
  parte_contraria?: string;
  valor_causa?: number;
  data_distribuicao?: string;
  resultado_tipo?: ProcessoResultadoTipo;
  resultado_descricao?: string;
  pena?: string;
  processo_principal_id?: string;
  numero_inquerito?: string;
  delegacia?: string;
  autoridade_policial?: string;
  unidade_prisional?: string;
  tipo_penal?: string;
  tipos_penais?: string[];
  data_instauracao?: string;
  situacao_inquerito?: InqueritoSituacao;
  relatorio_final?: string;
  monitorar_datajud?: boolean;
  ultimo_sync?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export type AcordoDirecao = "receber" | "pagar";

export interface AcordoParcela {
  id: string;
  grupo_id: string;
  processo_id: string;
  cliente_nome?: string;
  direcao: AcordoDirecao;
  titulo?: string;
  numero: number;
  total_parcelas: number;
  valor: number;
  data_vencimento?: string;
  pago: boolean;
  data_pagamento?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Prazo {
  id: string;
  processo_id: string;
  titulo: string;
  descricao?: string;
  data_prazo: string;
  concluido: boolean;
  tipo?: PrazoTipo;
  prioridade: Prioridade;
  created_at: string;
  user_id: string;
  processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome">;
}

export interface Audiencia {
  id: string;
  processo_id: string;
  titulo: string;
  data_hora: string;
  local?: string;
  tipo?: AudienciaTipo;
  observacoes?: string;
  realizada: boolean;
  created_at: string;
  user_id: string;
  processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome">;
}

export interface Movimentacao {
  id: string;
  processo_id: string;
  descricao: string;
  data_movimentacao: string;
  tipo?: string;
  fonte?: string;
  datajud_id?: string;
  lida: boolean;
  created_at: string;
  user_id: string;
}

export type HonorarioCategoria = "cobranca" | "pagamento";

export interface Honorario {
  id: string;
  processo_id: string;
  descricao: string;
  valor: number;
  data_lancamento?: string;
  data_recebimento?: string;
  data_vencimento?: string;
  status: HonorarioStatus;
  tipo?: HonorarioTipo;
  categoria: HonorarioCategoria;
  created_at: string;
  user_id: string;
  processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome">;
}

export interface ContaEscritorio {
  id: string;
  descricao: string;
  valor: number;
  categoria: ContaEscritorioCategoria;
  status: ContaEscritorioStatus;
  data_vencimento: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  recorrente?: boolean;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface IncidenteExecucao {
  id: string;
  processo_id: string;
  tipo: IncidenteExecucaoTipo;
  titulo: string;
  descricao?: string;
  status: IncidenteExecucaoStatus;
  data_pedido?: string;
  data_decisao?: string;
  resultado?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface CalculoPena {
  id: string;
  processo_id: string;
  titulo: string;
  pena_anos?: number;
  pena_meses?: number;
  pena_dias?: number;
  data_inicio?: string;
  dias_detracao?: number;
  dias_remicao?: number;
  regime_atual?: string;
  marco_base?: string;
  resumo?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface BeneficioPenal {
  id: string;
  processo_id: string;
  tipo: BeneficioPenalTipo;
  decreto?: string;
  titulo: string;
  status: BeneficioPenalStatus;
  data_requerimento?: string;
  data_decisao?: string;
  requisitos?: string;
  resultado?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Atendimento {
  id: string;
  processo_id?: string;
  cliente_id?: string;
  cliente_nome: string;
  data_hora: string;
  duracao_min?: number;
  tipo?: AtendimentoTipo;
  status: AtendimentoStatus;
  notas?: string;
  valor_cobrado?: number;
  created_at: string;
  user_id: string;
  processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome">;
}

export type TriagemStatus = "novo" | "aprovado" | "descartado";
export type TriagemImportacaoStatus = "pendente" | "aprovada" | "descartada";

export interface TriagemLead {
  id: string;
  nome?: string;
  contato?: string;
  telefone?: string;
  area?: string;
  resumo?: string;
  urgencia?: string;
  detalhes?: string;
  transcricao?: string;
  canal?: string;
  status: TriagemStatus;
  created_at: string;
  user_id?: string;
}

export interface TriagemImportDraft {
  cliente_id?: string;
  cliente?: {
    nome?: string;
    cpf?: string;
    rg?: string;
    email?: string;
    celular?: string;
    cep?: string;
    logradouro?: string;
    numero_end?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    observacoes?: string;
  };
  processos: Array<{
    processo_id?: string;
    numero: string;
    titulo?: string;
    descricao?: string;
    tribunal?: string;
    uf?: string;
    comarca?: string;
    vara?: string;
    tipo?: string;
    parte_contraria?: string;
    cliente_nome?: string;
    cliente_cpf_cnpj?: string;
    data_distribuicao?: string;
    unidade_prisional?: string;
    tipo_penal?: string;
    clientes_partes?: ProcessoClienteParte[];
  }>;
  movimentacoes?: Array<{
    processo_numero?: string;
    data_movimentacao?: string;
    descricao: string;
    tipo?: string;
    fonte?: string;
  }>;
  avisos?: string[];
}

export interface TriagemImportacao {
  id: string;
  texto_original: string;
  draft: TriagemImportDraft;
  origem?: string;
  status: TriagemImportacaoStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Briefing {
  id: string;
  data?: string;
  conteudo: string;
  origem?: string;
  lida?: boolean;
  created_at: string;
  user_id?: string;
}

export interface Publicacao {
  id: string;
  processo_id?: string;
  titulo?: string;
  conteudo?: string;
  data_publicacao?: string;
  diario?: string;
  url?: string;
  lida: boolean;
  created_at: string;
  user_id: string;
}

export interface Anotacao {
  id: string;
  processo_id: string;
  titulo?: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface Tarefa {
  id: string;
  processo_id: string;
  titulo: string;
  descricao?: string;
  data_limite?: string;
  concluida: boolean;
  prioridade: Prioridade;
  created_at: string;
  updated_at: string;
  user_id: string;
}
