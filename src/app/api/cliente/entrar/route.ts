import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { abrirSessao, conferirSenha, registrar, soDigitos, tentativasRecentes, type AcessoPortal } from "@/lib/portal/servidor";

export const runtime = "nodejs";

// Login do Portal do Cliente: CPF + senha. Mensagem de erro sempre igual (não revela se o
// CPF existe) e trava por 15 min depois de 8 tentativas erradas.
export async function POST(req: NextRequest) {
  const { cpf, senha } = (await req.json().catch(() => ({}))) as { cpf?: string; senha?: string };
  const digitos = soDigitos(cpf ?? "");
  const erro = NextResponse.json({ error: "CPF ou senha incorretos." }, { status: 401 });
  if (digitos.length !== 11 || !senha) return erro;

  if ((await tentativasRecentes(digitos)) >= 8) {
    return NextResponse.json({ error: "Muitas tentativas. Tente de novo em 15 minutos." }, { status: 429 });
  }

  const { data } = await supabase.from("portal_acessos").select("*").eq("cpf", digitos).maybeSingle();
  const acesso = data as AcessoPortal | null;
  if (!acesso || !acesso.ativo || !acesso.senha_hash || !(await conferirSenha(senha, acesso.senha_hash))) {
    await registrar(`cpf:${digitos}`, "senha_errada");
    return erro;
  }
  if (!acesso.termos_aceitos_em) {
    return NextResponse.json({ error: "Conclua o primeiro acesso pelo link de convite." }, { status: 403 });
  }

  await abrirSessao(acesso.id);
  return NextResponse.json({ ok: true });
}
