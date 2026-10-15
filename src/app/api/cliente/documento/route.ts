import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { acessoAtual, registrar } from "@/lib/portal/servidor";

export const runtime = "nodejs";

// Download de documento pelo cliente: só se ele está logado, o documento é de um processo
// liberado para ele e a Carol marcou o documento como visível. Link assinado de 60 segundos.
export async function GET(req: NextRequest) {
  const acesso = await acessoAtual();
  if (!acesso) return NextResponse.redirect(new URL("/cliente", req.url));

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const { data: doc } = await supabase
    .from("documentos")
    .select("id,registro_id,caminho,nome,contexto,visivel_cliente")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.contexto !== "processos" || !doc.visivel_cliente || !acesso.processos.includes(doc.registro_id)) {
    return NextResponse.json({ error: "Documento não disponível." }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.caminho, 60, { download: `${doc.nome}.pdf` });
  if (error || !data) return NextResponse.json({ error: "Não consegui abrir o documento." }, { status: 500 });
  await registrar(acesso.id, "baixou_documento", doc.registro_id, doc.nome);
  return NextResponse.redirect(data.signedUrl);
}
