// Sessão de login do Justio: cookie assinado (HMAC-SHA256) com validade e versão.
// Usa só Web Crypto, para rodar tanto no middleware quanto nas rotas.
// A chave de assinatura é JUSTIO_SECRET_TOKEN (nunca vai para o navegador).
import { envLimpo } from "@/lib/env";

export const COOKIE_SESSAO = "justio_auth";
export const DURACAO_SESSAO_S = 60 * 60 * 24 * 30; // 30 dias

export interface Sessao {
  v: number; // versão: muda quando a senha é trocada, derrubando sessões antigas
  exp: number; // segundos desde 1970
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64url(texto: string): Uint8Array {
  const s = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function chave(): Promise<CryptoKey | null> {
  const segredo = envLimpo("JUSTIO_SECRET_TOKEN");
  if (!segredo) return null;
  return crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function criarSessao(versao: number): Promise<string> {
  const k = await chave();
  if (!k) throw new Error("JUSTIO_SECRET_TOKEN não configurado");
  const sessao: Sessao = { v: versao, exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_S };
  const corpo = b64url(enc.encode(JSON.stringify(sessao)));
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(corpo)));
  return `${corpo}.${b64url(assinatura)}`;
}

/** Confere assinatura e validade. Não confere a versão (isso exige o banco; ver sessao-servidor.ts). */
export async function lerSessao(cookie: string | undefined): Promise<Sessao | null> {
  if (!cookie) return null;
  const [corpo, assinatura, ...resto] = cookie.split(".");
  if (!corpo || !assinatura || resto.length) return null;
  const k = await chave();
  if (!k) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", k, deB64url(assinatura) as BufferSource, enc.encode(corpo));
    if (!ok) return null;
    const sessao = JSON.parse(new TextDecoder().decode(deB64url(corpo))) as Sessao;
    if (typeof sessao.v !== "number" || typeof sessao.exp !== "number") return null;
    if (sessao.exp * 1000 < Date.now()) return null;
    return sessao;
  } catch {
    return null;
  }
}

export const OPCOES_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
