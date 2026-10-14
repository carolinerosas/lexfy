import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { lerSessao } from "@/lib/sessao";

// Login do Justio (uma usuária): senha com hash scrypt na tabela justio_acesso (só a chave
// secreta lê). Enquanto não houver senha no banco, vale JUSTIO_PASSWORD da Vercel.

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

const MAX_FALHAS = 8;
const BLOQUEIO_MIN = 15;
export const SENHA_MIN = 10;

interface Acesso {
  senha_hash: string | null;
  sessao_versao: number;
  reset_token_hash: string | null;
  reset_expira: string | null;
  reset_pedido_em: string | null;
  falhas: number;
  bloqueado_ate: string | null;
}

async function lerAcesso(): Promise<Acesso> {
  const { data, error } = await supabase
    .from("justio_acesso")
    .select("senha_hash,sessao_versao,reset_token_hash,reset_expira,reset_pedido_em,falhas,bloqueado_ate")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error(`Não consegui ler o acesso: ${error?.message ?? "sem registro"}`);
  return data as Acesso;
}

async function gravarAcesso(dados: Partial<Acesso>): Promise<void> {
  const { error } = await supabase
    .from("justio_acesso")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Não consegui gravar o acesso: ${error.message}`);
  versaoCache = null;
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

async function conferirHash(senha: string, guardado: string): Promise<boolean> {
  const [algo, sal, hash] = guardado.split("$");
  if (algo !== "scrypt" || !sal || !hash) return false;
  const calculado = await scrypt(senha, Buffer.from(sal, "base64"), 64);
  const esperado = Buffer.from(hash, "base64");
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export type ResultadoLogin = { ok: true; versao: number } | { ok: false; motivo: "incorreto" | "bloqueado" };

export async function conferirLogin(usuario: string, senha: string): Promise<ResultadoLogin> {
  const acesso = await lerAcesso();
  if (acesso.bloqueado_ate && new Date(acesso.bloqueado_ate) > new Date()) {
    return { ok: false, motivo: "bloqueado" };
  }

  const usuarioCerto = envLimpo("JUSTIO_USERNAME") ?? "";
  const usuarioOk = !!usuarioCerto && iguais(usuario.trim().toLowerCase(), usuarioCerto.toLowerCase());
  const senhaOk = acesso.senha_hash
    ? await conferirHash(senha, acesso.senha_hash)
    : iguais(senha, envLimpo("JUSTIO_PASSWORD") ?? "\u0000sem-senha");

  if (usuarioOk && senhaOk) {
    if (acesso.falhas || acesso.bloqueado_ate) await gravarAcesso({ falhas: 0, bloqueado_ate: null });
    return { ok: true, versao: acesso.sessao_versao };
  }

  const falhas = acesso.falhas + 1;
  await gravarAcesso(
    falhas >= MAX_FALHAS
      ? { falhas: 0, bloqueado_ate: new Date(Date.now() + BLOQUEIO_MIN * 60_000).toISOString() }
      : { falhas }
  );
  return { ok: false, motivo: "incorreto" };
}

// A versão da sessão muda pouco; guardar por 30 s evita ir ao banco a cada consulta do app.
let versaoCache: { valor: number; ate: number } | null = null;

async function versaoAtual(): Promise<number> {
  if (versaoCache && versaoCache.ate > Date.now()) return versaoCache.valor;
  const { sessao_versao } = await lerAcesso();
  versaoCache = { valor: sessao_versao, ate: Date.now() + 30_000 };
  return sessao_versao;
}

/** Sessão assinada, dentro da validade e da versão atual (senha trocada derruba as antigas). */
export async function sessaoValida(cookie: string | undefined): Promise<boolean> {
  const sessao = await lerSessao(cookie);
  if (!sessao) return false;
  return sessao.v === (await versaoAtual());
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Gera um link de redefinição (30 min). Devolve null se já pediram há menos de 2 min. */
export async function criarTokenRedefinicao(): Promise<string | null> {
  const acesso = await lerAcesso();
  if (acesso.reset_pedido_em && Date.now() - new Date(acesso.reset_pedido_em).getTime() < 2 * 60_000) {
    return null;
  }
  const token = randomBytes(32).toString("base64url");
  await gravarAcesso({
    reset_token_hash: hashToken(token),
    reset_expira: new Date(Date.now() + 30 * 60_000).toISOString(),
    reset_pedido_em: new Date().toISOString(),
  });
  return token;
}

export async function redefinirSenha(token: string, novaSenha: string): Promise<"ok" | "token-invalido" | "senha-curta"> {
  if (novaSenha.length < SENHA_MIN) return "senha-curta";
  const acesso = await lerAcesso();
  const valido =
    !!token &&
    !!acesso.reset_token_hash &&
    !!acesso.reset_expira &&
    new Date(acesso.reset_expira) > new Date() &&
    iguais(hashToken(token), acesso.reset_token_hash);
  if (!valido) return "token-invalido";
  await gravarAcesso({
    senha_hash: await gerarHash(novaSenha),
    sessao_versao: acesso.sessao_versao + 1,
    reset_token_hash: null,
    reset_expira: null,
    falhas: 0,
    bloqueado_ate: null,
  });
  return "ok";
}
