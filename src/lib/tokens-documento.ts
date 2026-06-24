import type { Cliente } from "@/types";
import type { PerfilAdvogado } from "./perfil";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(d = new Date()): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function dataCurta(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function enderecoCompleto(c: Cliente): string {
  return [
    c.logradouro,
    c.numero_end ? `nº ${c.numero_end}` : null,
    c.complemento,
    c.bairro,
    c.cidade,
    c.uf,
    c.cep ? `CEP ${c.cep}` : null,
  ].filter(Boolean).join(", ");
}

/**
 * Mapa de marcadores -> valores, usado para preencher os modelos .docx.
 * As chaves correspondem exatamente aos {{marcadores}} documentados para a Carol.
 */
export function montarDadosDocumento(cliente: Cliente, perfil: PerfilAdvogado): Record<string, string> {
  const cidade = (cliente.cidade ?? "").trim();
  const uf = (cliente.uf ?? "").trim();

  // Flexão de gênero pelo campo "sexo" do cliente. Sem sexo definido, cai no "(a)" (sempre aceito).
  const sexo = (cliente.sexo ?? "").trim().toUpperCase();
  const flex = (masc: string, fem: string) =>
    sexo === "M" ? masc : sexo === "F" ? fem : `${masc}(a)`;

  return {
    // Cliente
    nome: cliente.nome ?? "",
    cpf: cliente.cpf ?? "",
    rg: cliente.rg ?? "",
    nacionalidade: cliente.nacionalidade ?? "",
    estado_civil: cliente.estado_civil ?? "",
    profissao: cliente.profissao ?? "",
    email: cliente.email ?? "",
    celular: cliente.celular ?? "",
    endereco: enderecoCompleto(cliente),
    logradouro: cliente.logradouro ?? "",
    numero: cliente.numero_end ?? "",
    complemento: cliente.complemento ?? "",
    bairro: cliente.bairro ?? "",
    cidade,
    uf,
    cep: cliente.cep ?? "",

    // Advogada
    adv_nome: perfil.nome ?? "",
    adv_oab: perfil.oab_numero ?? "",
    adv_oab_uf: perfil.oab_uf ?? "",
    adv_cpf: perfil.cpf ?? "",
    adv_nacionalidade: perfil.nacionalidade ?? "",
    adv_estado_civil: perfil.estado_civil ?? "",
    adv_endereco: perfil.endereco_escritorio ?? "",

    // Flexão de gênero (homem/mulher) — vêm do campo "sexo" do cliente
    portador: flex("portador", "portadora"),
    inscrito: flex("inscrito", "inscrita"),
    domiciliado: flex("domiciliado", "domiciliada"),
    nascido: flex("nascido", "nascida"),
    o_a: flex("o", "a"),

    // Data e local
    cidade_data: `${cidade || "____"}${uf ? `/${uf}` : ""}, ${dataPorExtenso()}`,
    data: dataPorExtenso(),
    data_curta: dataCurta(),
  };
}

/** Nomes de todos os marcadores que o Justio preenche sozinho. */
export const TOKENS_AUTO: string[] = Object.keys(
  montarDadosDocumento(
    { id: "", nome: "", created_at: "", updated_at: "", user_id: "" } as Cliente,
    { nome: "", oab_numero: "", oab_uf: "" }
  )
);
