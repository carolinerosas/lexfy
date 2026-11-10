// Modelos de documento preenchidos com os dados do caso, do cliente e do escritório.
// O que não está cadastrado sai entre colchetes, para completar antes de assinar.
import { areaDe } from "./areas";
import { brl, dataLonga } from "./format";
import type { Caso, Cliente, Colaborador, Config } from "./types";

export interface Ctx { cliente?: Cliente; caso?: Caso; cfg: Config; advogado?: Colaborador; valor?: number }
export interface Modelo { id: string; nome: string; para: string; areas?: string[]; texto: (c: Ctx) => string }

const qualifica = (c?: Cliente) => !c ? "[NOME E QUALIFICAÇÃO DO CLIENTE]" : c.tipo === "pj"
  ? `${c.nome.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.documento ?? "[CNPJ]"}, com sede em [endereço], ${c.cidade ?? "[cidade]"}/${c.uf ?? "[UF]"}, neste ato representada por [representante legal]`
  : `${c.nome.toUpperCase()}, [nacionalidade], [estado civil], ${c.profissao ?? "[profissão]"}, inscrito(a) no CPF sob o nº ${c.documento ?? "[CPF]"}, residente e domiciliado(a) em [endereço], ${c.cidade ?? "[cidade]"}/${c.uf ?? "[UF]"}`;
const adv = (x: Ctx) => `${(x.advogado?.nome ?? x.cfg.responsavel).toUpperCase()}, advogado(a), inscrito(a) na ${x.advogado?.oab ?? x.cfg.oab ?? "OAB/[UF] nº [número]"}, com escritório em ${x.cfg.cidade || "[endereço do escritório]"}`;
const local = (x: Ctx) => `${(x.cfg.cidade || "[cidade]").split(",")[0]}, ${dataLonga(new Date()).replace(/^[^,]+, /, "")}.`;
const objeto = (x: Ctx) => x.caso ? `${x.caso.titulo}${x.caso.numero ? `, processo nº ${x.caso.numero}` : ""}${x.caso.orgao ? `, ${x.caso.orgao}` : ""}${x.caso.comarca ? `, comarca de ${x.caso.comarca}` : ""}${x.caso.parte_contraria ? `, em face de ${x.caso.parte_contraria}` : ""}` : "[objeto]";
const assina = (nome?: string) => `\n\n\n______________________________________\n${nome ?? "[nome]"}`;

export const MODELOS: Modelo[] = [
  {
    id: "procuracao", nome: "Procuração (foro em geral)", para: "Qualquer caso cível, de família, trabalhista ou previdenciário",
    texto: (x) => `PROCURAÇÃO

OUTORGANTE: ${qualifica(x.cliente)}.

OUTORGADO(A): ${adv(x)}.

PODERES: os da cláusula ad judicia et extra, para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor as ações cabíveis e defender o(a) outorgante nas contrárias, acompanhando-as até decisão final, com poderes especiais para confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito em que se funda a ação, receber, dar quitação, firmar compromisso e assinar declaração de hipossuficiência econômica (art. 105 do Código de Processo Civil), podendo ainda substabelecer, com ou sem reserva de poderes.

FINALIDADE: ${objeto(x)}.

${local(x)}${assina(x.cliente?.nome)}`,
  },
  {
    id: "procuracao_criminal", nome: "Procuração criminal", para: "Ação penal, inquérito, júri e execução penal", areas: ["criminal", "juri", "inquerito", "execucao_penal"],
    texto: (x) => `PROCURAÇÃO

OUTORGANTE: ${qualifica(x.cliente)}${x.caso?.dados.unidade ? `, atualmente custodiado(a) em ${x.caso.dados.unidade}` : ""}.

OUTORGADO(A): ${adv(x)}.

PODERES: amplos poderes para o foro em geral e para a defesa do(a) outorgante em inquéritos policiais, procedimentos investigatórios, ações penais e execuções penais, em qualquer juízo, instância ou tribunal, podendo requerer liberdade provisória, relaxamento e revogação de prisão, impetrar habeas corpus, apresentar resposta à acusação, arrolar testemunhas, recorrer, requerer benefícios da execução penal e ter acesso aos autos, com os poderes especiais do art. 44 do Código de Processo Penal quando necessários, podendo substabelecer, com ou sem reserva.

FINALIDADE: ${objeto(x)}.

${local(x)}${assina(x.cliente?.nome)}`,
  },
  {
    id: "contrato", nome: "Contrato de honorários", para: "Todos os casos",
    texto: (x) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: ${qualifica(x.cliente)}.

CONTRATADO(A): ${adv(x)}.

1. OBJETO. O(A) contratado(a) prestará serviços advocatícios ao(à) contratante em: ${objeto(x)}. Área: ${x.caso ? areaDe(x.caso.area).nome : "[área]"}.

2. HONORÁRIOS. Pelos serviços, o(a) contratante pagará ${x.valor ? brl(x.valor) : "R$ [valor]"}, da seguinte forma: [entrada e parcelas, com datas de vencimento]. O atraso sujeita a parcela a multa de 2%, juros de 1% ao mês e correção monetária.

3. ÊXITO. Havendo proveito econômico, serão devidos também honorários de êxito de [percentual]% sobre o valor obtido, por sentença ou acordo.

4. SUCUMBÊNCIA. Os honorários de sucumbência pertencem ao(à) advogado(a) e não se compensam com os contratuais (art. 23 da Lei 8.906/94).

5. DESPESAS. Custas, emolumentos, perícias, diligências e deslocamentos são de responsabilidade do(a) contratante e serão pagos ou reembolsados mediante comprovante.

6. DEVERES DO(A) CONTRATANTE. Fornecer documentos e informações verdadeiros e manter endereço, telefone e e-mail atualizados.

7. RESCISÃO. Qualquer das partes pode rescindir este contrato por escrito. Os honorários pelo trabalho já realizado continuam devidos.

8. DADOS PESSOAIS. Os dados do(a) contratante serão tratados apenas para a execução deste contrato e o exercício regular de direitos em processo, conforme a Lei 13.709/2018.

9. FORO. Fica eleito o foro da comarca de ${(x.cfg.cidade || "[cidade]").split(",")[0]}.

${local(x)}${assina(x.cliente?.nome)}${assina(x.advogado?.nome ?? x.cfg.responsavel)}`,
  },
  {
    id: "hipossuficiencia", nome: "Declaração de hipossuficiência", para: "Pedido de justiça gratuita",
    texto: (x) => `DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA

${qualifica(x.cliente)}, declara, para os fins dos arts. 98 e 99 do Código de Processo Civil, que não tem condições de pagar as custas do processo e os honorários advocatícios sem prejuízo do próprio sustento e do sustento de sua família.

Declara estar ciente de que a afirmação falsa sujeita o(a) declarante às sanções civis e penais previstas em lei.

${local(x)}${assina(x.cliente?.nome)}`,
  },
  {
    id: "substabelecimento", nome: "Substabelecimento", para: "Audiência ou diligência por correspondente",
    texto: (x) => `SUBSTABELECIMENTO

${adv(x)}, substabelece, COM RESERVA DE IGUAIS PODERES, ao(à) advogado(a) [NOME], inscrito(a) na OAB/[UF] sob o nº [número], os poderes que lhe foram outorgados por ${x.cliente?.nome.toUpperCase() ?? "[CLIENTE]"}, para atuar em: ${objeto(x)}.

${local(x)}${assina(x.advogado?.nome ?? x.cfg.responsavel)}`,
  },
  {
    id: "recibo", nome: "Recibo de honorários", para: "Pagamento recebido",
    texto: (x) => `RECIBO

Recebi de ${x.cliente?.nome.toUpperCase() ?? "[CLIENTE]"}, ${x.cliente?.tipo === "pj" ? "CNPJ" : "CPF"} nº ${x.cliente?.documento ?? "[documento]"}, a quantia de ${x.valor ? brl(x.valor) : "R$ [valor]"} ([valor por extenso]), referente a honorários advocatícios em: ${objeto(x)}.

Pelo que dou quitação do valor recebido.

${local(x)}${assina(`${x.advogado?.nome ?? x.cfg.responsavel}\n${x.advogado?.oab ?? x.cfg.oab}`)}`,
  },
  {
    id: "notificacao", nome: "Notificação extrajudicial", para: "Cobranças e descumprimento de contrato", areas: ["notificacoes", "contratos", "consumidor", "imobiliario", "civel"],
    texto: (x) => `NOTIFICAÇÃO EXTRAJUDICIAL

NOTIFICANTE: ${qualifica(x.cliente)}.

NOTIFICADO(A): ${x.caso?.parte_contraria?.toUpperCase() ?? "[NOME E ENDEREÇO DO NOTIFICADO]"}.

O(A) notificante, por seu(sua) advogado(a), vem notificar V.Sa. do seguinte:

1. [Descrever o fato: contrato, data, obrigação descumprida ou valor devido.]

2. Fica V.Sa. notificado(a) a ${x.caso?.dados.objeto ? String(x.caso.dados.objeto) : "[cumprir a obrigação ou pagar o valor]"}, no prazo de ${x.caso?.dados.prazo ? String(x.caso.dados.prazo) : "[prazo]"}, contado do recebimento desta.

3. O não atendimento levará à adoção das medidas judiciais cabíveis, com os acréscimos legais, custas e honorários.

${local(x)}${assina(`${x.advogado?.nome ?? x.cfg.responsavel}\n${x.advogado?.oab ?? x.cfg.oab}`)}`,
  },
  {
    id: "lgpd", nome: "Termo de ciência sobre dados pessoais", para: "Cadastro de cliente novo",
    texto: (x) => `TERMO DE CIÊNCIA SOBRE O TRATAMENTO DE DADOS PESSOAIS

${x.cliente?.nome.toUpperCase() ?? "[CLIENTE]"} declara estar ciente de que ${x.cfg.escritorio || "[escritório]"} tratará seus dados pessoais, inclusive dados sensíveis que constem de documentos e processos, para as seguintes finalidades: prestação dos serviços advocatícios contratados, exercício regular de direitos em processo judicial, administrativo ou arbitral, cumprimento de obrigações legais e cobrança de honorários (arts. 7º, II, V e VI, e 11, II, "d", da Lei 13.709/2018).

Os dados ficam guardados pelo tempo necessário ao serviço e aos prazos legais, com acesso restrito à equipe do escritório. O(A) titular pode pedir confirmação, acesso e correção de seus dados pelo e-mail ou telefone do escritório.

${local(x)}${assina(x.cliente?.nome)}`,
  },
];
