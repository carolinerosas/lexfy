import type { Cliente } from "@/types";
import type { PerfilAdvogado } from "./perfil";

export type ModeloId = "procuracao" | "hipossuficiencia" | "recibo" | "declaracao";

export interface ModeloDocumento {
  id: ModeloId;
  nome: string;
  descricao: string;
  /** HTML do corpo do documento, já preenchido. Trechos a completar vêm marcados com [colchetes]. */
  gerar: (ctx: ModeloContexto) => { titulo: string; corpoHtml: string };
}

export interface ModeloContexto {
  cliente: Cliente;
  perfil: PerfilAdvogado;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(d = new Date()): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Marca um trecho a preencher pela advogada, destacado no editor. */
function fill(label: string): string {
  return `<span class="doc-fill">[${label}]</span>`;
}

function ou(valor: string | undefined | null, label: string): string {
  const v = (valor ?? "").trim();
  return v ? escapeHtml(v) : fill(label);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function enderecoCliente(c: Cliente): string {
  const partes = [
    c.logradouro,
    c.numero_end ? `nº ${c.numero_end}` : null,
    c.complemento,
    c.bairro,
    c.cidade,
    c.uf,
    c.cep ? `CEP ${c.cep}` : null,
  ].filter(Boolean);
  return partes.length ? escapeHtml(partes.join(", ")) : fill("endereço do cliente");
}

/** Qualificação do cliente (outorgante / declarante). */
function qualificacaoCliente(c: Cliente): string {
  const s = (c.sexo ?? "").trim().toUpperCase();
  const flex = (m: string, f: string) => (s === "M" ? m : s === "F" ? f : `${m}(a)`);
  const nome = `<strong>${ou(c.nome, "nome do cliente")}</strong>`;
  const rg = (c.rg ?? "").trim();
  // Suprime a parte do RG quando o cliente só tem CPF (nova CIN).
  const rgParte = rg
    ? `${flex("portador", "portadora")} da cédula de identidade RG nº ${escapeHtml(rg)}, `
    : "";
  return (
    `${nome}, ${ou(c.nacionalidade, "nacionalidade")}, ${ou(c.estado_civil, "estado civil")}, ${ou(c.profissao, "profissão")}, ` +
    rgParte +
    `${flex("inscrito", "inscrita")} no CPF sob o nº ${ou(c.cpf, "CPF")}, ` +
    `residente e ${flex("domiciliado", "domiciliada")} em ${enderecoCliente(c)}`
  );
}

/** Qualificação da advogada (outorgada). */
function qualificacaoAdvogada(p: PerfilAdvogado): string {
  const nome = `<strong>${ou(p.nome, "nome da advogada")}</strong>`;
  const oab = `OAB/${ou(p.oab_uf, "UF")} nº ${ou(p.oab_numero, "número OAB")}`;
  return (
    `${nome}, ${ou(p.nacionalidade, "nacionalidade")}, ${ou(p.estado_civil, "estado civil")}, ` +
    `advogada, inscrita na ${oab}, ` +
    `inscrita no CPF sob o nº ${ou(p.cpf, "CPF da advogada")}, ` +
    `com escritório profissional em ${ou(p.endereco_escritorio, "endereço do escritório")}`
  );
}

function localEData(c: Cliente, p: PerfilAdvogado): string {
  const cidade = (c.cidade || "").trim() || (p.endereco_escritorio ? "" : "");
  const local = cidade || fill("cidade");
  const uf = (c.uf || "").trim();
  return `${local}${uf ? `/${escapeHtml(uf)}` : ""}, ${dataPorExtenso()}.`;
}

function assinaturaCliente(c: Cliente): string {
  return (
    `<p class="doc-sign">_________________________________________<br>` +
    `<strong>${ou(c.nome, "nome do cliente")}</strong>${c.cpf ? `<br>CPF: ${escapeHtml(c.cpf)}` : ""}</p>`
  );
}

function assinaturaAdvogada(p: PerfilAdvogado): string {
  return (
    `<p class="doc-sign">_________________________________________<br>` +
    `<strong>${ou(p.nome, "nome da advogada")}</strong><br>` +
    `OAB/${ou(p.oab_uf, "UF")} nº ${ou(p.oab_numero, "número OAB")}</p>`
  );
}

export const MODELOS: ModeloDocumento[] = [
  {
    id: "procuracao",
    nome: "Procuração ad judicia",
    descricao: "Outorga poderes da cláusula ad judicia et extra (art. 105 do CPC).",
    gerar: ({ cliente, perfil }) => ({
      titulo: "PROCURAÇÃO AD JUDICIA ET EXTRA",
      corpoHtml:
        `<p><strong>OUTORGANTE:</strong> ${qualificacaoCliente(cliente)}.</p>` +
        `<p><strong>OUTORGADA:</strong> ${qualificacaoAdvogada(perfil)}.</p>` +
        `<p><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, a outorgante nomeia e ` +
        `constitui sua bastante procuradora a advogada acima qualificada, a quem confere os poderes da cláusula ` +
        `<em>ad judicia et extra</em>, previstos no art. 105 do Código de Processo Civil, para o foro em geral, ` +
        `em qualquer Juízo, Instância ou Tribunal, podendo propor e contestar ações, requerer, recorrer, ` +
        `arrazoar, juntar e retirar documentos, dar e receber quitação, e praticar todos os demais atos ` +
        `necessários ao fiel cumprimento deste mandato, bem como os poderes especiais para ` +
        `${fill("poderes especiais: receber e dar quitação, transigir, firmar acordo, substabelecer etc.")}.</p>` +
        `<p class="doc-local">${localEData(cliente, perfil)}</p>` +
        assinaturaCliente(cliente),
    }),
  },
  {
    id: "hipossuficiencia",
    nome: "Declaração de hipossuficiência",
    descricao: "Para concessão da gratuidade de justiça (art. 98 do CPC).",
    gerar: ({ cliente, perfil }) => ({
      titulo: "DECLARAÇÃO DE HIPOSSUFICIÊNCIA",
      corpoHtml:
        `<p>Eu, ${qualificacaoCliente(cliente)}, <strong>DECLARO</strong>, sob as penas da lei e para fins ` +
        `de concessão dos benefícios da gratuidade de justiça, nos termos do art. 98 do Código de Processo Civil ` +
        `e da Lei nº 1.060/1950, que não possuo condições de arcar com as custas, despesas processuais e ` +
        `honorários advocatícios sem prejuízo do meu próprio sustento e do de minha família.</p>` +
        `<p>Declaro estar ciente de que a falsidade desta declaração sujeita o declarante às sanções civis, ` +
        `administrativas e criminais previstas na legislação.</p>` +
        `<p>Por ser expressão da verdade, firmo a presente declaração.</p>` +
        `<p class="doc-local">${localEData(cliente, perfil)}</p>` +
        assinaturaCliente(cliente),
    }),
  },
  {
    id: "recibo",
    nome: "Recibo de honorários",
    descricao: "Recibo de valores recebidos a título de honorários advocatícios.",
    gerar: ({ cliente, perfil }) => ({
      titulo: "RECIBO DE HONORÁRIOS ADVOCATÍCIOS",
      corpoHtml:
        `<p>Recebi de <strong>${ou(cliente.nome, "nome do cliente")}</strong>, ` +
        `inscrito(a) no CPF sob o nº ${ou(cliente.cpf, "CPF")}, a importância de ` +
        `R$ ${fill("valor")} (${fill("valor por extenso")}), referente a ` +
        `${fill("descrição dos honorários — ex.: honorários advocatícios contratados para a ação...")}.</p>` +
        `<p>Para clareza e como prova de quitação do valor acima, firmo o presente recibo.</p>` +
        `<p class="doc-local">${localEData(cliente, perfil)}</p>` +
        assinaturaAdvogada(perfil),
    }),
  },
  {
    id: "declaracao",
    nome: "Declaração genérica",
    descricao: "Declaração em branco, qualificada com os dados do cliente.",
    gerar: ({ cliente, perfil }) => ({
      titulo: "DECLARAÇÃO",
      corpoHtml:
        `<p>Eu, ${qualificacaoCliente(cliente)}, <strong>DECLARO</strong>, para os devidos fins de direito, que ` +
        `${fill("conteúdo da declaração")}.</p>` +
        `<p>Por ser expressão da verdade, firmo a presente.</p>` +
        `<p class="doc-local">${localEData(cliente, perfil)}</p>` +
        assinaturaCliente(cliente),
    }),
  },
];

export function getModelo(id: ModeloId): ModeloDocumento | undefined {
  return MODELOS.find((m) => m.id === id);
}
