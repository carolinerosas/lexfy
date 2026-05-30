import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { username, password } = (await req.json()) as { username?: string; password?: string };

  const correctUsername = process.env.JUSTIO_USERNAME;
  const correctPassword = process.env.JUSTIO_PASSWORD;
  const secretToken = process.env.JUSTIO_SECRET_TOKEN;

  if (!correctUsername || !correctPassword || !secretToken) {
    return NextResponse.json({ error: "Configuração inválida" }, { status: 500 });
  }

  if (!username || !password || username !== correctUsername || password !== correctPassword) {
    return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("justio_auth", secretToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    path: "/",
  });

  return res;
}
