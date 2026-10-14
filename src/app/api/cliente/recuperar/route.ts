import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registrar, soDigitos, type AcessoPortal } from "@/lib/portal/servidor";
import { enviarEmailCliente } from "@/lib/portal/email";

export const runtime = "nodejs";

// "Esqueci a senha" do Portal do Cliente: manda um link de 1 hora para o e-mail cadastrado.
// A resposta é sempre a mesma (não revela se o CPF existe) e são no máximo 3 pedidos por hora.

const RESPOSTA = { ok: true, mensagem: "Se houver um e-mail cadastrado para este CPF, enviamos o link. Confira também a caixa de spam." };

export async function POST(req: NextRequest) {
  const { cpf } = (await req.json().catch(() => ({}))) as { cpf?: string };
  const digitos = soDigitos(cpf ?? "");
  if (digitos.length !== 11) return NextResponse.json(RESPOSTA);

  const { data } = await supabase.from("portal_acessos").select("*").eq("cpf", digitos).maybeSingle();
  const acesso = data as (AcessoPortal & { email: string | null }) | null;
  if (!acesso?.ativo || !acesso.email) return NextResponse.json(RESPOSTA);

  const umaHora = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from("portal_log")
    .select("id", { count: "exact", head: true })
    .eq("acesso_id", acesso.id)
    .eq("acao", "pediu_nova_senha")
    .gte("em", umaHora);
  if ((count ?? 0) >= 3) return NextResponse.json(RESPOSTA);

  const token = randomBytes(24).toString("hex");
  await supabase
    .from("portal_acessos")
    .update({ convite_token: token, convite_expira: new Date(Date.now() + 60 * 60_000).toISOString(), updated_at: new Date().toISOString() })
    .eq("id", acesso.id);
  const base = process.env.JUSTIO_URL || "https://www.justio.com.br";
  const enviado = await enviarEmailCliente(acesso.email, acesso.nome, `${base}/cliente/convite/${token}`);
  await registrar(acesso.id, "pediu_nova_senha", undefined, enviado ? "e-mail enviado" : "falha no envio");
  return NextResponse.json(RESPOSTA);
}
