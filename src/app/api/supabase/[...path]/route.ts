import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase";

// Proxy do navegador para o Supabase: só para quem está logado (cookie justio_auth).
// O navegador nunca recebe chave do Supabase; aqui a requisição sai com a chave secreta.

export const dynamic = "force-dynamic";

const SERVICOS_PERMITIDOS = new Set(["rest", "storage"]);

// Só estes cabeçalhos do navegador seguem adiante (nada de Origin, cookies, Accept-Profile etc.).
const HEADERS_REPASSADOS = ["accept", "content-type", "prefer", "range", "x-client-info", "x-upsert", "cache-control"];
const HEADERS_DEVOLVIDOS = ["content-type", "content-range", "preference-applied", "content-disposition", "etag", "last-modified"];

function autenticado(req: NextRequest): boolean {
  const token = req.cookies.get("justio_auth")?.value;
  const secret = process.env.JUSTIO_SECRET_TOKEN;
  if (!token || !secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function repassar(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!autenticado(req)) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ message: "SUPABASE_SECRET_KEY não configurada" }, { status: 500 });
  }

  const { path } = await ctx.params;
  // Esperado: ["rest" | "storage", "v1", ...]
  if (path.length < 2 || !SERVICOS_PERMITIDOS.has(path[0]) || path[1] !== "v1" || path.some((p) => p === ".." || p === ".")) {
    return NextResponse.json({ message: "Caminho não permitido" }, { status: 404 });
  }

  const destino = new URL(`${SUPABASE_URL}/${path.map(encodeURIComponent).join("/")}`);
  destino.search = req.nextUrl.search;

  const headers = new Headers({ apikey: key, authorization: `Bearer ${key}` });
  for (const nome of HEADERS_REPASSADOS) {
    const valor = req.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }

  const temCorpo = !["GET", "HEAD"].includes(req.method);
  const resposta = await fetch(destino, {
    method: req.method,
    headers,
    body: temCorpo ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const headersResposta = new Headers({ "cache-control": "no-store" });
  for (const nome of HEADERS_DEVOLVIDOS) {
    const valor = resposta.headers.get(nome);
    if (valor) headersResposta.set(nome, valor);
  }

  return new NextResponse(req.method === "HEAD" ? null : resposta.body, {
    status: resposta.status,
    headers: headersResposta,
  });
}

export { repassar as GET, repassar as HEAD, repassar as POST, repassar as PUT, repassar as PATCH, repassar as DELETE };
