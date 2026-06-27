import type { Cliente, Processo, ProcessoClienteParte } from "@/types";

function clean(value?: string | null): string {
  return (value ?? "").trim();
}

function keyParte(parte: ProcessoClienteParte): string {
  return parte.cliente_id || clean(parte.nome).toLocaleLowerCase("pt-BR");
}

export function partesDoProcesso(
  processo: Pick<Processo, "cliente_id" | "cliente_nome" | "cliente_cpf_cnpj" | "clientes_partes">
): ProcessoClienteParte[] {
  const partes = Array.isArray(processo.clientes_partes) ? processo.clientes_partes : [];
  const todas = [
    ...partes,
    processo.cliente_nome
      ? {
          cliente_id: processo.cliente_id,
          nome: processo.cliente_nome,
          cpf_cnpj: processo.cliente_cpf_cnpj,
          papel: "Cliente principal",
        }
      : undefined,
  ].filter((parte): parte is ProcessoClienteParte => Boolean(parte?.nome?.trim()));

  const seen = new Set<string>();
  return todas.filter((parte) => {
    const key = keyParte(parte);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function nomesPartesProcesso(processo: Pick<Processo, "cliente_id" | "cliente_nome" | "cliente_cpf_cnpj" | "clientes_partes">): string {
  const nomes = partesDoProcesso(processo).map((parte) => parte.nome);
  return nomes.length ? nomes.join(", ") : processo.cliente_nome || "—";
}

export function processoTemCliente(processo: Pick<Processo, "cliente_id" | "cliente_nome" | "cliente_cpf_cnpj" | "clientes_partes">, cliente: Pick<Cliente, "id" | "nome"> | string): boolean {
  const id = typeof cliente === "string" ? cliente : cliente.id;
  const nome = typeof cliente === "string" ? cliente : cliente.nome;
  const nomeKey = clean(nome).toLocaleLowerCase("pt-BR");
  return partesDoProcesso(processo).some((parte) => {
    if (id && parte.cliente_id === id) return true;
    return Boolean(nomeKey && clean(parte.nome).toLocaleLowerCase("pt-BR") === nomeKey);
  });
}

export function parteDeCliente(cliente: Pick<Cliente, "id" | "nome" | "cpf">, papel = "Cliente"): ProcessoClienteParte {
  return {
    cliente_id: cliente.id,
    nome: cliente.nome,
    cpf_cnpj: cliente.cpf,
    papel,
  };
}

export function tiposPenaisDoProcesso(processo: Pick<Processo, "tipo_penal" | "tipos_penais">): string[] {
  const valores = [
    ...(Array.isArray(processo.tipos_penais) ? processo.tipos_penais : []),
    ...(processo.tipo_penal ?? "").split(/\s*[;\n]\s*/),
  ]
    .map((valor) => valor.trim())
    .filter(Boolean);

  return Array.from(new Set(valores));
}

export function labelTiposPenais(processo: Pick<Processo, "tipo_penal" | "tipos_penais">): string {
  return tiposPenaisDoProcesso(processo).join("; ");
}
