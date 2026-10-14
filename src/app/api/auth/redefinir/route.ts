import { NextRequest, NextResponse } from "next/server";
import { SENHA_MIN, redefinirSenha } from "@/lib/acesso";

export async function POST(req: NextRequest) {
  const { token, senha } = (await req.json().catch(() => ({}))) as { token?: string; senha?: string };
  const resultado = await redefinirSenha(token ?? "", senha ?? "");
  if (resultado === "senha-curta") {
    return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` }, { status: 400 });
  }
  if (resultado === "token-invalido") {
    return NextResponse.json({ error: "Link inválido ou vencido. Peça um novo em \"Esqueceu sua senha?\"." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
