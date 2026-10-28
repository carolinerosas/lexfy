import type { PerfilAdvogado } from "./perfil";

// Recibo de honorários no timbrado (public/timbre.png), impresso como PDF em folha A4.

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** Extenso de 1 a 999. */
function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

/** Extenso de um inteiro (até a casa dos bilhões). */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos: { valor: number; texto: string }[] = [];
  const escalas: [number, string, string][] = [
    [1_000_000_000, "bilhão", "bilhões"],
    [1_000_000, "milhão", "milhões"],
    [1_000, "mil", "mil"],
  ];
  let resto = n;
  for (const [base, sing, plur] of escalas) {
    const q = Math.floor(resto / base);
    resto %= base;
    if (!q) continue;
    if (base === 1_000) grupos.push({ valor: q * base, texto: q === 1 ? "mil" : `${ate999(q)} mil` });
    else grupos.push({ valor: q * base, texto: `${ate999(q)} ${q === 1 ? sing : plur}` });
  }
  if (resto) grupos.push({ valor: resto, texto: ate999(resto) });

  // "mil e quinhentos", "mil e vinte", mas "mil duzentos e trinta".
  return grupos.reduce((acc, g, i) => {
    if (i === 0) return g.texto;
    const ultimo = i === grupos.length - 1;
    const usaE = ultimo && (g.valor < 100 || g.valor % 100 === 0);
    return `${acc}${usaE ? " e " : " "}${g.texto}`;
  }, "");
}

/** Valor em reais por extenso: 1500.5 → "mil e quinhentos reais e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  const totalCentavos = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const partes: string[] = [];
  if (reais) {
    const exato = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiroPorExtenso(reais)}${exato ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10-28" → "28 de outubro de 2026". */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

function dataCurta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface DadosRecibo {
  pagadorNome: string;
  pagadorDoc: string;
  /** "M", "F" ou vazio — flexiona "inscrito/inscrita". */
  pagadorSexo?: string;
  valor: number;
  /** Data do recebimento (ISO). */
  data: string;
  referente: string;
  processoNumero?: string;
  formaPagamento?: string;
  cidade: string;
  /** Data de emissão (ISO) — vai no local e data. */
  dataEmissao: string;
}

/** Corpo do recibo (HTML), sem a folha nem o timbre. */
export function corpoRecibo(r: DadosRecibo, perfil: PerfilAdvogado): string {
  const s = (r.pagadorSexo ?? "").trim().toUpperCase();
  const inscrito = s === "M" ? "inscrito" : s === "F" ? "inscrita" : "inscrito(a)";
  const doc = r.pagadorDoc.trim();
  const tipoDoc = doc.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
  const referente = r.referente.trim().replace(/[.\s]+$/, "");
  const processo = r.processoNumero?.trim() ? `, nos autos do processo nº ${escapeHtml(r.processoNumero.trim())}` : "";
  const forma = r.formaPagamento?.trim() ? `, pago por ${escapeHtml(r.formaPagamento.trim())}` : "";
  const nomeAdv = perfil.nome?.trim() || "Caroline Fraga Rosas Marinho";
  const oab = `OAB/${perfil.oab_uf?.trim() || "RJ"} nº ${perfil.oab_numero?.trim() || "165955"}`;
  const cpfAdv = perfil.cpf?.trim();

  return (
    `<h1 class="rec-titulo">RECIBO DE HONORÁRIOS ADVOCATÍCIOS</h1>` +
    `<p class="rec-valor">${moeda(r.valor)}</p>` +
    `<p>Recebi de <strong>${escapeHtml(r.pagadorNome.trim())}</strong>` +
    (doc ? `, ${inscrito} no ${tipoDoc} sob o nº ${escapeHtml(doc)}` : "") +
    `, a importância de <strong>${moeda(r.valor)}</strong> (${valorPorExtenso(r.valor)}), ` +
    `referente a ${escapeHtml(referente || "honorários advocatícios")}${processo}${forma}, ` +
    `recebida em ${dataCurta(r.data)}.</p>` +
    `<p>Para clareza e como prova de quitação do valor acima, firmo o presente recibo.</p>` +
    `<p class="rec-local">${r.cidade.trim() ? `${escapeHtml(r.cidade.trim())}, ` : ""}${dataPorExtenso(r.dataEmissao)}.</p>` +
    `<p class="rec-assinatura">_________________________________________<br>` +
    `<strong>${escapeHtml(nomeAdv)}</strong><br>Advogada — ${escapeHtml(oab)}` +
    (cpfAdv ? `<br>CPF ${escapeHtml(cpfAdv)}` : "") +
    `</p>`
  );
}

const CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .folha { position: relative; width: 21cm; height: 29.7cm; box-sizing: border-box; overflow: hidden; }
  .folha .timbre { position: absolute; top: 0; left: 0; width: 21cm; height: 29.7cm; z-index: 0; }
  .folha .conteudo { position: relative; z-index: 1; padding: 6.5cm 2.5cm 4cm 2.5cm;
    font-family: "Times New Roman", Georgia, serif; font-size: 12.5pt; line-height: 1.7; color: #111; text-align: justify; }
  .rec-titulo { text-align: center; font-size: 14pt; font-weight: bold; letter-spacing: 1px; margin: 0 0 10px; }
  .rec-valor { text-align: right; font-size: 13pt; font-weight: bold; margin: 0 0 28px; }
  .conteudo p { margin: 0 0 16px; text-indent: 0; }
  .rec-local { text-align: right; margin-top: 36px !important; }
  .rec-assinatura { text-align: center; margin-top: 80px !important; line-height: 1.4; }
`;

/** Documento HTML completo (folha A4 com timbre) — usado na prévia e na impressão. */
export function documentoRecibo(corpoHtml: string, timbreUrl: string, titulo: string): string {
  const timbre = timbreUrl ? `<img class="timbre" src="${timbreUrl}" alt="" />` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title><style>${CSS}</style></head>` +
    `<body><div class="folha">${timbre}<div class="conteudo">${corpoHtml}</div></div></body></html>`;
}

/** Carrega o timbre como data URL (a impressão em iframe não depende de rede). */
export async function carregarTimbre(): Promise<string> {
  const r = await fetch("/timbre.png");
  if (!r.ok) return "";
  const b = await r.blob();
  return new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });
}

/** Abre a janela de impressão (Salvar como PDF) via iframe invisível. */
export function imprimirHtml(html: string): boolean {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  }, 300);
  return true;
}
