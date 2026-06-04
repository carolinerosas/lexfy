export type ProcessoStatus = "ativo" | "suspenso" | "arquivado" | "encerrado";
// As classificações abaixo aceitam valores customizados (cadastrados pela usuária via "Outro").
// O (string & {}) mantém o autocomplete dos valores conhecidos e permite texto livre.
export type ProcessoTipo =
  | "civel"
  | "familia"
  | "criminal"
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
  created_at: string;
  updated_at: string;
  user_id: string;
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
  parte_contraria?: string;
  valor_causa?: number;
  data_distribuicao?: string;
  resultado_tipo?: ProcessoResultadoTipo;
  resultado_descricao?: string;
  pena?: string;
  processo_principal_id?: string;
  monitorar_datajud?: boolean;
  ultimo_sync?: string;
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
