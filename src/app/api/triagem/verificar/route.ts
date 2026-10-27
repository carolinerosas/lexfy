import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function getAgentToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-justio-agent-token")?.trim() ?? "";
}

/** 20 dígitos viram o formato CNJ (0000000-00.0000.0.00.0000); outro formato volta como veio. */
function formatarCnj(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.length !== 20) return numero.trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

// GET /api/triagem/verificar?nome=...&numero=...
// Protegido pelo token do agente. Antes de mandar algo para a Triagem, o agente confere se o
// cliente e o processo já existem e o que já foi lançado nos andamentos (para não duplicar).
export async function GET(req: NextRequest) {
  const expected = process.env.JUSTIO_AGENT_TOKEN;
  if (!expected) return NextResponse.json({ error: "JUSTIO_AGENT_TOKEN não configurado no servidor." }, { status: 503 });
  if (getAgentToken(req) !== expected) return NextResponse.json({ error: "Token do agente inválido." }, { status: 401 });

  const nome = (req.nextUrl.searchParams.get("nome") ?? "").replace(/[%,()*]/g, " ").trim();
  const numero = (req.nextUrl.searchParams.get("numero") ?? "").trim();
  if (!nome && !numero) return NextResponse.json({ error: "Informe nome ou numero." }, { status: 400 });

  try {
    // Nome: primeiro e último termo precisam aparecer (tolera nome do meio omitido; a busca não ignora acento).
    const termos = nome.split(/\s+/).filter((t) => t.length > 1);
    const buscaNome = [...new Set([termos[0], termos.length > 1 ? termos[termos.length - 1] : undefined])].filter(Boolean) as string[];

    let qClientes = supabase.from("clientes").select("id,nome,cpf,celular,email");
    let qProcessos = supabase.from("processos").select("id,numero,titulo,tipo,fase,status,cliente_id,cliente_nome,vara,comarca");
    if (buscaNome.length) {
      for (const t of buscaNome) {
        qClientes = qClientes.ilike("nome", `%${t}%`);
        qProcessos = qProcessos.ilike("cliente_nome", `%${t}%`);
      }
    }
    const [clientes, porNome, porNumero] = await Promise.all([
      buscaNome.length ? qClientes.limit(10) : Promise.resolve({ data: [], error: null }),
      buscaNome.length ? qProcessos.limit(20) : Promise.resolve({ data: [], error: null }),
      numero
        ? supabase
            .from("processos")
            .select("id,numero,titulo,tipo,fase,status,cliente_id,cliente_nome,vara,comarca")
            .eq("numero", formatarCnj(numero))
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const erro = clientes.error ?? porNome.error ?? porNumero.error;
    if (erro) throw new Error(erro.message);

    const processos = new Map<string, NonNullable<typeof porNome.data>[number]>();
    for (const p of [...(porNumero.data ?? []), ...(porNome.data ?? [])]) processos.set(p.id, p);

    const detalhados = await Promise.all(
      [...processos.values()].map(async (p) => {
        const [movs, anots] = await Promise.all([
          supabase
            .from("movimentacoes")
            .select("data_movimentacao,descricao,tipo")
            .eq("processo_id", p.id)
            .order("data_movimentacao", { ascending: false })
            .limit(15),
          supabase.from("anotacoes").select("titulo,created_at").eq("processo_id", p.id).order("created_at", { ascending: false }).limit(15),
        ]);
        return {
          ...p,
          ultimas_movimentacoes: (movs.data ?? []).map((m) => ({ data: m.data_movimentacao, tipo: m.tipo, descricao: String(m.descricao).slice(0, 300) })),
          anotacoes: (anots.data ?? []).map((a) => ({ titulo: a.titulo, criada_em: a.created_at })),
        };
      })
    );

    return NextResponse.json({
      cliente_existe: (clientes.data ?? []).length > 0,
      processo_existe: detalhados.length > 0,
      clientes: clientes.data ?? [],
      processos: detalhados,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao verificar." }, { status: 500 });
  }
}
