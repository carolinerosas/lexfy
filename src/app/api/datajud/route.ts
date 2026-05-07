import { NextRequest, NextResponse } from "next/server";

// Chave pública do CNJ — disponível em https://datajud-wiki.cnj.jus.br/api-publica/acesso
const PUBLIC_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const BASE_URL = "https://api-publica.datajud.cnj.jus.br";

export async function POST(req: NextRequest) {
  const { tribunal, numero, apiKey } = await req.json();

  if (!tribunal || !numero) {
    return NextResponse.json({ error: "tribunal e numero obrigatorios" }, { status: 400 });
  }

  const key = apiKey || PUBLIC_KEY;
  const url = `${BASE_URL}/api_publica_${tribunal}/_search`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          bool: {
            should: [
              { term: { "numeroProcesso.keyword": numero } },
              { match: { numeroProcesso: numero } },
              { wildcard: { "numeroProcesso.keyword": `*${numero.replace(/\D/g, "").slice(0, 7)}*` } },
            ],
            minimum_should_match: 1,
          },
        },
        size: 3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();

    if (!res.ok) {
      const msg = res.status === 401
        ? "Chave DataJud inválida ou expirada. Verifique em Configurações."
        : `DataJud retornou erro ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const data = JSON.parse(text);
    console.log("[DataJud] hits:", data?.hits?.total?.value ?? 0, "| numero:", numero, "| tribunal:", tribunal);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
