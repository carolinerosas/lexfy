import type { Area, Tinta } from "@/novo/lib/areas";

// Marca da área: sigla de duas letras. Preto cheio para áreas judiciais,
// contorno preto para as extrajudiciais. (O arquivo guarda o nome antigo.)
const SIGLAS: Record<string, string> = {
  civel: "CV", consumidor: "CD", familia: "FM", sucessoes: "SC", criminal: "CR", juri: "JR", execucao_penal: "EP", inquerito: "IQ",
  trabalhista: "TB", previdenciario: "PV", tributario: "TR", empresarial: "EM", imobiliario: "IM", administrativo: "AD", saude: "SD",
  bancario: "BC", ambiental: "AB", eleitoral: "EL", digital: "DG", inventario_cartorio: "IN", divorcio_cartorio: "DV",
  usucapiao_cartorio: "US", contratos: "CT", consultivo: "CS", societario: "SO", compliance: "CP", mediacao: "MD", notificacoes: "NT",
  regularizacao: "RG", planejamento: "PL", marcas: "MC",
};

export function Azulejo({ area, tamanho = 36, className = "" }: { area: Pick<Area, "id" | "nome" | "grupo">; tamanho?: number; className?: string }) {
  const judicial = area.grupo === "judicial";
  return (
    <span role="img" aria-label={`Área ${area.nome}`} title={area.nome}
      className={`inline-flex shrink-0 select-none items-center justify-center font-bold ${className}`}
      style={{
        width: tamanho, height: tamanho, borderRadius: Math.max(5, tamanho * 0.3), fontSize: Math.max(8, tamanho * 0.36), letterSpacing: "0.01em",
        background: judicial ? "#0a0a0a" : "#fff", color: judicial ? "#fff" : "#0a0a0a", boxShadow: judicial ? undefined : "inset 0 0 0 1.5px #0a0a0a",
      }}>
      {SIGLAS[area.id] ?? area.nome.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Sem uso no tema atual; mantido para não quebrar chamadas antigas. */
export function FaixaAzulejos(_: { padrao: number; tinta?: Tinta; cor?: string; altura?: number; className?: string }) {
  return null;
}

export function estiloTinta(_: Tinta): React.CSSProperties {
  return { ["--tinta" as string]: "#0a0a0a", ["--tinta-f" as string]: "#f0f0f0" };
}
