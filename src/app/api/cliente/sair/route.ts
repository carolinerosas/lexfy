import { NextResponse } from "next/server";
import { fecharSessao } from "@/lib/portal/servidor";

export const runtime = "nodejs";

export async function POST() {
  await fecharSessao();
  return NextResponse.json({ ok: true });
}
