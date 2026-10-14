import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { abrirSessao, gerarHash, registrar, senhaFraca, soDigitos, type AcessoPortal } from "@/lib/portal/servidor";

export const runtime = "nodejs";

// Primeiro acesso (ou nova senha): pelo link de convite que a Carol manda por WhatsApp/e-mail.
// A pessoa confirma o CPF, cria a senha e aceita os termos; o convite vale uma vez.

async function acessoDoConvite(token: string): Promise<AcessoPortal | null> {
  if (!token || token.length < 20) return null;
  const { data } = await supabase.from("portal_acessos").select("*").eq("convite_token", token).maybeSingle();
  const acesso = data as (AcessoPortal & { convite_expira: string | null }) | null;
  if (!acesso?.ativo || !acesso.convite_expira || Date.parse(acesso.convite_expira) < Date.now()) return null;
  return acesso;
}

export async function GET(req: NextRequest) {
  const acesso = await acessoDoConvite(req.nextUrl.searchParams.get("token") ?? "");
  if (!acesso) return NextResponse.json({ valido: false });
  return NextResponse.json({ valido: true, nome: acesso.nome.split(" ")[0] });
}

export async function POST(req: NextRequest) {
  const { token, cpf, senha, aceito } = (await req.json().catch(() => ({}))) as {
    token?: string;
    cpf?: string;
    senha?: string;
    aceito?: boolean;
  };
  const acesso = await acessoDoConvite(token ?? "");
  if (!acesso) return NextResponse.json({ error: "Este link expirou ou já foi usado. Peça um novo ao escritório." }, { status: 410 });
  if (soDigitos(cpf ?? "") !== acesso.cpf) return NextResponse.json({ error: "O CPF não confere com o cadastro." }, { status: 400 });
  const fraca = senhaFraca(senha ?? "");
  if (fraca) return NextResponse.json({ error: fraca }, { status: 400 });
  if (!aceito) return NextResponse.json({ error: "É preciso aceitar os termos para continuar." }, { status: 400 });

  const { error } = await supabase
    .from("portal_acessos")
    .update({
      senha_hash: await gerarHash(senha!),
      termos_aceitos_em: acesso.termos_aceitos_em ?? new Date().toISOString(),
      convite_token: null,
      convite_expira: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", acesso.id);
  if (error) return NextResponse.json({ error: "Não consegui salvar. Tente de novo." }, { status: 500 });

  await registrar(acesso.id, "criou_senha");
  await abrirSessao(acesso.id);
  return NextResponse.json({ ok: true });
}
