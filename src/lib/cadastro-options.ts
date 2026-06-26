export interface CadastroOption {
  value: string;
  label: string;
}

type Sexo = "F" | "M" | string | undefined;

const GENERO_PARES: Array<[masculino: string, feminino: string]> = [
  ["solteiro", "solteira"],
  ["casado", "casada"],
  ["divorciado", "divorciada"],
  ["viúvo", "viúva"],
  ["viuvo", "viúva"],
  ["separado", "separada"],
  ["brasileiro", "brasileira"],
  ["estrangeiro", "estrangeira"],
  ["português", "portuguesa"],
  ["portugues", "portuguesa"],
  ["argentino", "argentina"],
  ["advogado", "advogada"],
  ["aposentado", "aposentada"],
  ["autônomo", "autônoma"],
  ["autonomo", "autônoma"],
  ["empresário", "empresária"],
  ["empresario", "empresária"],
  ["professor", "professora"],
  ["servidor público", "servidora pública"],
  ["servidor publico", "servidora pública"],
  ["trabalhador rural", "trabalhadora rural"],
  ["vendedor", "vendedora"],
];

function opt(value: string): CadastroOption {
  return { value, label: value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1) };
}

function sexoKey(sexo: Sexo): "F" | "M" | "" {
  return sexo === "F" || sexo === "M" ? sexo : "";
}

export function ajustarGenero(value: string | undefined, sexo: Sexo): string {
  const raw = value?.trim() ?? "";
  if (!raw) return raw;
  const alvo = sexoKey(sexo);
  if (!alvo) return raw;

  const normalizado = raw.toLocaleLowerCase("pt-BR");
  const ambiguos: Record<string, [masculino: string, feminino: string]> = {
    "solteiro(a)": ["solteiro", "solteira"],
    "casado(a)": ["casado", "casada"],
    "divorciado(a)": ["divorciado", "divorciada"],
    "viúvo(a)": ["viúvo", "viúva"],
    "viuvo(a)": ["viúvo", "viúva"],
    "separado(a)": ["separado", "separada"],
    "brasileiro(a)": ["brasileiro", "brasileira"],
    "estrangeiro(a)": ["estrangeiro", "estrangeira"],
    "autônomo(a)": ["autônomo", "autônoma"],
    "autonomo(a)": ["autônomo", "autônoma"],
    "aposentado(a)": ["aposentado", "aposentada"],
  };
  const ambiguo = ambiguos[normalizado];
  if (ambiguo) return alvo === "M" ? ambiguo[0] : ambiguo[1];

  for (const [masculino, feminino] of GENERO_PARES) {
    if (alvo === "M" && normalizado === feminino.toLocaleLowerCase("pt-BR")) return masculino;
    if (alvo === "F" && normalizado === masculino.toLocaleLowerCase("pt-BR")) return feminino;
  }
  return raw;
}

export function nacionalidadeOptions(sexo: Sexo): CadastroOption[] {
  if (sexoKey(sexo) === "M") return ["brasileiro", "estrangeiro", "português", "argentino"].map(opt);
  if (sexoKey(sexo) === "F") return ["brasileira", "estrangeira", "portuguesa", "argentina"].map(opt);
  return ["brasileiro", "brasileira", "estrangeiro", "estrangeira", "português", "portuguesa"].map(opt);
}

export function estadoCivilOptions(sexo: Sexo): CadastroOption[] {
  if (sexoKey(sexo) === "M") return ["solteiro", "casado", "divorciado", "viúvo", "separado", "em união estável"].map(opt);
  if (sexoKey(sexo) === "F") return ["solteira", "casada", "divorciada", "viúva", "separada", "em união estável"].map(opt);
  return ["solteiro", "solteira", "casado", "casada", "divorciado", "divorciada", "viúvo", "viúva", "em união estável"].map(opt);
}

export function profissaoOptions(sexo: Sexo): CadastroOption[] {
  if (sexoKey(sexo) === "M") {
    return ["advogado", "aposentado", "autônomo", "comerciante", "empresário", "estudante", "motorista", "professor", "servidor público", "trabalhador rural", "vendedor"].map(opt);
  }
  if (sexoKey(sexo) === "F") {
    return ["advogada", "aposentada", "autônoma", "comerciante", "empresária", "estudante", "motorista", "professora", "servidora pública", "trabalhadora rural", "vendedora", "do lar"].map(opt);
  }
  return ["advogado", "advogada", "aposentado", "aposentada", "autônomo", "autônoma", "comerciante", "empresário", "empresária", "estudante", "motorista", "professor", "professora"].map(opt);
}

export const unidadePrisionalBaseOptions: CadastroOption[] = [
  "Cadeia Pública de Barra Mansa",
  "Cadeia Pública José Frederico Marques",
  "Instituto Penal Plácido de Sá Carvalho",
  "Penitenciária Industrial Esmeraldino Bandeira",
  "Presídio Ary Franco",
].map((value) => ({ value, label: value }));

export const tipoPenalBaseOptions: CadastroOption[] = [
  "Tráfico de drogas (art. 33, Lei 11.343/06)",
  "Associação para o tráfico (art. 35, Lei 11.343/06)",
  "Furto (art. 155, CP)",
  "Roubo (art. 157, CP)",
  "Receptação (art. 180, CP)",
  "Homicídio (art. 121, CP)",
  "Lesão corporal (art. 129, CP)",
  "Ameaça (art. 147, CP)",
  "Estelionato (art. 171, CP)",
  "Estupro (art. 213, CP)",
  "Estupro de vulnerável (art. 217-A, CP)",
  "Porte/posse ilegal de arma (Lei 10.826/03)",
  "Violência doméstica (Lei 11.340/06)",
].map((value) => ({ value, label: value }));

export const comarcaBaseOptions: CadastroOption[] = [
  "Barra Mansa",
  "Volta Redonda",
  "Rio de Janeiro",
  "Resende",
  "Angra dos Reis",
  "Itatiaia",
  "Pinheiral",
].map((value) => ({ value, label: value }));

export const varaBaseOptions: CadastroOption[] = [
  "1ª Vara Cível",
  "2ª Vara Cível",
  "1ª Vara Criminal",
  "2ª Vara Criminal",
  "Vara de Família",
  "Vara de Execuções Penais",
  "Juizado Especial Cível",
  "Juizado Especial Criminal",
].map((value) => ({ value, label: value }));

export function valuesToOptions(values: Array<string | null | undefined>): CadastroOption[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, label: value }));
}

export function mergeOptions(...groups: CadastroOption[][]): CadastroOption[] {
  const seen = new Set<string>();
  const merged: CadastroOption[] = [];
  for (const group of groups) {
    for (const option of group) {
      const key = option.value.trim().toLocaleLowerCase("pt-BR");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(option);
    }
  }
  return merged;
}
