/**
 * Corrige palavras em CAIXA ALTA em que a letra acentuada ficou minúscula ("INTIMAçãO", "LUíS", "VíTIMA").
 * Acontece em textos vindos dos diários e dos tribunais, cujo "maiúsculo" não trata acento.
 * Só mexe em palavra com 2 ou mais maiúsculas, sem nenhuma minúscula comum, e com minúscula acentuada.
 * "Ação", "Júri" e "Ré" ficam como estão.
 */
const acentuada = (c: string) => c.normalize("NFD").length > c.length;

export function corrigirCaixa(texto?: unknown): string {
  const s = String(texto ?? "");
  if (!/[À-ÿ]/.test(s)) return s;
  return s.replace(/\p{L}+/gu, (palavra) => {
    let maiusculas = 0, acentuadasMinusculas = 0;
    for (const c of palavra) {
      const minuscula = c !== c.toUpperCase();
      const maiuscula = c !== c.toLowerCase();
      if (maiuscula) maiusculas++;
      else if (minuscula) { if (acentuada(c)) acentuadasMinusculas++; else return palavra; }
    }
    return maiusculas >= 2 && acentuadasMinusculas > 0 ? palavra.toUpperCase() : palavra;
  });
}
