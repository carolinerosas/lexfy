import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";

// Portal do Cliente (justio.com.br/cliente): cada cliente ou familiar autorizado entra com
// CPF + senha e vê SÓ os processos liberados no acesso dele e, dentro deles, só o que a
// Carol marcou como visível. Sessão própria (cookie justio_cliente), separada do login do
// escritório. Tudo passa pelo servidor com a chave secreta.

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;
const COOKIE = "justio_cliente";
const DURACAO_SESSAO = 60 * 60 * 24 * 7; // 7 dias

export interface AcessoPortal {
  id: string;
  cliente_id: string | null;
  nome: string;
  cpf: string;
  vinculo: string;
  processos: string[];
  senha_hash: string | null;
  termos_aceitos_em: string | null;
  ativo: boolean;
}

export function soDigitos(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

export async function conferirSenha(senha: string, guardado: string | null): Promise<boolean> {
  const [alg, salHex, hashHex] = (guardado ?? "").split("$");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const hash = await scrypt(senha, Buffer.from(salHex, "hex"), 64);
  const esperado = Buffer.from(hashHex, "hex");
  return esperado.length === hash.length && timingSafeEqual(esperado, hash);
}

export function senhaFraca(senha: string): string | null {
  if ((senha ?? "").length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/\d/.test(senha) || !/[a-zA-Z]/.test(senha)) return "Use letras e números na senha.";
  return null;
}

function segredo(): string {
  const s = envLimpo("PORTAL_SESSION_SECRET");
  if (!s) throw new Error("PORTAL_SESSION_SECRET não configurado");
  return s;
}

function assinar(valor: string): string {
  return createHmac("sha256", segredo()).update(valor).digest("hex");
}

export async function abrirSessao(acessoId: string): Promise<void> {
  const expira = Math.floor(Date.now() / 1000) + DURACAO_SESSAO;
  const valor = `${acessoId}.${expira}`;
  (await cookies()).set(COOKIE, `${valor}.${assinar(valor)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO,
  });
  await supabase.from("portal_acessos").update({ ultimo_acesso: new Date().toISOString() }).eq("id", acessoId);
  await registrar(acessoId, "entrou");
}

export async function fecharSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Acesso logado (ativo e com termos aceitos), ou null. */
export async function acessoAtual(): Promise<AcessoPortal | null> {
  const bruto = (await cookies()).get(COOKIE)?.value ?? "";
  const [id, expira, assinatura] = bruto.split(".");
  if (!id || !expira || !assinatura) return null;
  const esperado = Buffer.from(assinar(`${id}.${expira}`));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  if (Number(expira) < Date.now() / 1000) return null;
  const { data } = await supabase.from("portal_acessos").select("*").eq("id", id).maybeSingle();
  const acesso = data as AcessoPortal | null;
  return acesso?.ativo && acesso.termos_aceitos_em ? acesso : null;
}

export async function registrar(acessoId: string, acao: string, processoId?: string, detalhe?: string): Promise<void> {
  await supabase.from("portal_log").insert({ acesso_id: acessoId, acao, processo_id: processoId ?? null, detalhe: detalhe ?? null });
}

/** Tentativas erradas de senha nos últimos 15 min (para travar força bruta). */
export async function tentativasRecentes(cpf: string): Promise<number> {
  const desde = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabase
    .from("portal_log")
    .select("id", { count: "exact", head: true })
    .eq("acesso_id", `cpf:${cpf}`)
    .eq("acao", "senha_errada")
    .gte("em", desde);
  return count ?? 0;
}

/** O que o acesso pode ver: os processos liberados, com andamentos e audiências marcados como visíveis. */
export async function dadosDoAcesso(acesso: AcessoPortal) {
  if (!acesso.processos.length) return { processos: [] };
  const [procs, movs, auds, docs] = await Promise.all([
    supabase.from("processos").select("id,numero,titulo,status,tipo,vara,comarca,uf,tribunal").in("id", acesso.processos),
    supabase
      .from("movimentacoes")
      .select("id,processo_id,data_movimentacao,descricao,texto_cliente")
      .in("processo_id", acesso.processos)
      .eq("visivel_cliente", true)
      .order("data_movimentacao", { ascending: false }),
    supabase
      .from("audiencias")
      .select("id,processo_id,titulo,data_hora,local,realizada")
      .in("processo_id", acesso.processos)
      .eq("visivel_cliente", true)
      .order("data_hora"),
    supabase
      .from("documentos")
      .select("id,registro_id,nome,referencia,created_at")
      .eq("contexto", "processos")
      .in("registro_id", acesso.processos)
      .eq("visivel_cliente", true)
      .order("created_at", { ascending: false }),
  ]);
  return {
    processos: (procs.data ?? []).map((p) => ({
      ...p,
      andamentos: (movs.data ?? [])
        .filter((m) => m.processo_id === p.id)
        .map((m) => ({ id: m.id, data: m.data_movimentacao, texto: m.texto_cliente?.trim() || m.descricao })),
      audiencias: (auds.data ?? []).filter((a) => a.processo_id === p.id),
      documentos: (docs.data ?? [])
        .filter((d) => d.registro_id === p.id)
        .map((d) => ({ id: d.id, nome: d.nome, referencia: d.referencia, data: d.created_at })),
    })),
  };
}
