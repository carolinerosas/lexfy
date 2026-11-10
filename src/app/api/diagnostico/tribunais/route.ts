import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Diagnóstico (só com login): mostra de qual região o servidor está saindo e se o CNJ responde.
// Não envia nenhum dado do escritório: a consulta de teste pede uma única publicação de um tribunal.

async function testar(nome: string, url: string, init?: RequestInit) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
    return { nome, http: res.status, ms: Date.now() - t0 };
  } catch (err) {
    return { nome, erro: err instanceof Error ? err.message : "erro", ms: Date.now() - t0 };
  }
}

export async function GET() {
  const testes = await Promise.all([
    testar("DJEN (publicações)", "https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=1&siglaTribunal=TJRR&meio=D"),
    testar("PJe TJRJ (consulta pública)", "https://tjrj.pje.jus.br/1g/ConsultaPublica/listView.seam"),
    testar("DataJud", "https://api-publica.datajud.cnj.jus.br/api_publica_tjrr/_search", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"size\":0}" }),
  ]);
  return NextResponse.json({ regiao: process.env.VERCEL_REGION ?? "local", testes, obs: "DataJud sem chave responde 401; isso já mostra que a conexão chegou." });
}
