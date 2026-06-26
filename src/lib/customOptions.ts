// Opções personalizadas que a usuária cadastra ao escolher "Outro".
// Persistem no navegador (localStorage) por categoria, para reaparecerem nos selects.

const PREFIX = "justio_opts_";
const HIDDEN_PREFIX = "justio_opts_hidden_";

export function getCustomOptions(category: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${PREFIX}${category}`);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addCustomOption(category: string, label: string): void {
  if (typeof window === "undefined") return;
  const value = label.trim();
  if (!value) return;
  const list = getCustomOptions(category);
  if (!list.some((x) => x.toLowerCase() === value.toLowerCase())) {
    list.push(value);
    localStorage.setItem(`${PREFIX}${category}`, JSON.stringify(list));
  }
}

export function removeCustomOption(category: string, label: string): void {
  if (typeof window === "undefined") return;
  const list = getCustomOptions(category).filter((x) => x !== label);
  localStorage.setItem(`${PREFIX}${category}`, JSON.stringify(list));
}

// Opções-base (fixas, vindas do código) que a usuária escolheu esconder por estarem
// erradas ou duplicadas. Guardamos só os valores ocultos por categoria.
export function getHiddenOptions(category: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${HIDDEN_PREFIX}${category}`);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function hideBaseOption(category: string, value: string): void {
  if (typeof window === "undefined") return;
  const v = value.trim();
  if (!v) return;
  const list = getHiddenOptions(category);
  if (!list.includes(v)) {
    list.push(v);
    localStorage.setItem(`${HIDDEN_PREFIX}${category}`, JSON.stringify(list));
  }
}

export function restoreHiddenOptions(category: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${HIDDEN_PREFIX}${category}`);
}
