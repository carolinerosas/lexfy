import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SYNC_STATUS_ID = "daily_publicacoes";

function isMissingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (
    (error as { code?: string }).code === "PGRST205" ||
    (error as { code?: string }).code === "42P01"
  );
}

export async function GET() {
  const { data, error } = await supabase
    .from("publicacoes_sync_status")
    .select("*")
    .eq("id", SYNC_STATUS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: data ?? null });
}
