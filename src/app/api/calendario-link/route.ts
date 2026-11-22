import { NextRequest, NextResponse } from "next/server";

// Endereço da agenda (prazos e audiências) para assinar no Google Agenda ou no celular.
// Só com login (ver middleware). O token fica na variável CALENDAR_TOKEN da Vercel.
export async function GET(req: NextRequest) {
  const token = process.env.CALENDAR_TOKEN;
  if (!token) return NextResponse.json({ url: null });
  const origem = process.env.VERCEL_ENV === "production" ? "https://www.justio.com.br" : req.nextUrl.origin;
  return NextResponse.json({ url: `${origem}/api/calendario/${encodeURIComponent(token)}` });
}
