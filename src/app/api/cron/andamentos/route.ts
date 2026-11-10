import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { parseCNJ } from "@/lib/datajud";
import { getSistema } from "@/lib/sistemas";
import { POST as datajudPOST } from "@/app/api/datajud/route";
import { POST as pjePOST } from "@/app/api/pje/route";
import { POST as pjeRjPOST } from "@/app/api/pje-rj/route";
import { POST as tjrjPOST } from "@/app/api/tjrj/route";
import { POST as eprocPOST } from "@/app/api/eproc/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// Rotina diária: busca andamentos dos processos monitorados direto no servidor,
// sem depender de alguém abrir o Justio no navegador. Não usa o sincronizador local
// (certificado), que só existe no computador do escritório.

const USER_ID = "lexfy_shared";
const STATUS_ID = "daily_andamentos";
const ORCAMENTO_MS = 42_000; // para de começar processos novos depois disso
const POR_PROCESSO_MS = 30_000;
const PARALELO = 3;

type Mov = { data: string; descricao: string; fonte: string };
type Rota = (req: NextRequest) => Promise<Response>;

async function chamar(rota: Rota, corpo: unknown): Promise<{ ok: boolean; dados: Record<string, unknown> }> {
  const req = new NextRequest("http://interno.justio/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const res = await rota(req);
  const dados = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, dados };
}

async function viaRota(rota: Rota, corpo: unknown, fonte: string): Promise<Mov[] | null> {
  try {
    const { ok, dados } = await chamar(rota, corpo);
    if (!ok || !Array.isArray(dados.movimentos) || dados.movimentos.length === 0) return null;
    return (dados.movimentos as { data: string; descricao: string }[]).map((m) => ({ data: m.data, descricao: m.descricao, fonte }));
  } catch {
    return null;
  }
}

async function viaDataJud(tribunal: string, numero: string): Promise<Mov[]> {
  const { ok, dados } = await chamar(datajudPOST, { tribunal, numero });
  if (!ok) throw new Error(String(dados.error ?? "DataJud indisponível"));
  const hit = (dados as { hits?: { hits?: { _source?: Record<string, unknown> }[] } }).hits?.hits?.[0]?._source;
  if (!hit) throw new Error("Não encontrado no DataJud");
  const retornado = String(hit.numeroProcesso ?? "").replace(/\D/g, "");
  if (retornado && retornado !== numero.replace(/\D/g, "")) throw new Error("Não encontrado no DataJud");
  const movimentos = (hit.movimentos ?? []) as { nome: string; dataHora: string; complementosTabelados?: { descricao: string }[] }[];
  return movimentos.map((m) => {
    const comp = m.complementosTabelados?.length ? ` — ${m.complementosTabelados.map((c) => c.descricao).join(", ")}` : "";
    return { data: m.dataHora, descricao: `${m.nome}${comp}`, fonte: `DataJud/${tribunal.toUpperCase()}` };
  });
}

// Mesma ordem de fontes usada na tela do processo (src/lib/sistemas.ts), sem o sincronizador local.
async function buscarMovimentos(tribunal: string, numero: string): Promise<Mov[]> {
  const sistema = getSistema(tribunal);
  if (tribunal === "tjrj") {
    const a = await viaRota(pjeRjPOST, { numero }, "PJe-RJ");
    if (a) return a;
    const b = await viaRota(tjrjPOST, { numero }, "TJRJ");
    if (b) return b;
  }
  if (sistema === "pje") {
    const a = await viaRota(pjePOST, { sigla: tribunal, numero }, `PJe/${tribunal.toUpperCase()}`);
    if (a) return a;
  }
  if (sistema === "eproc") {
    const a = await viaRota(eprocPOST, { tribunal, numero }, `EPROC/${tribunal.toUpperCase()}`);
    if (a) return a;
  }
  return viaDataJud(tribunal, numero);
}

function tribunalDe(numero: string, informado?: string | null): string | null {
  const t = (informado ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t.includes("seeu")) return "seeu";
  if (t.includes("esaj") || t.includes("tjsp")) return "tjsp";
  if (t.includes("dcp") || t.includes("tjerj")) return "tjrj";
  return parseCNJ(numero).tribunal;
}

function paraIso(data: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}/.test(data)) {
    const [d, m, y] = data.slice(0, 10).split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`;
  }
  return data;
}

const comLimite = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);

async function sincronizar(p: { id: string; numero: string; tribunal?: string | null }): Promise<number> {
  const tribunal = tribunalDe(p.numero, p.tribunal);
  if (!tribunal) throw new Error("número CNJ inválido ou tribunal não reconhecido");
  const movimentos = await comLimite(buscarMovimentos(tribunal, p.numero), POR_PROCESSO_MS);

  const { data: existentes, error } = await supabase.from("movimentacoes").select("data_movimentacao,descricao").eq("processo_id", p.id);
  if (error) throw new Error(error.message);
  const chaves = new Set((existentes ?? []).map((m) => `${String(m.data_movimentacao).slice(0, 10)}|${m.descricao}`));

  const novas = [];
  for (const mov of movimentos) {
    const iso = paraIso(mov.data);
    const chave = `${iso.slice(0, 10)}|${mov.descricao}`;
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    novas.push({ id: crypto.randomUUID(), processo_id: p.id, descricao: mov.descricao, data_movimentacao: iso, fonte: mov.fonte, lida: false, created_at: new Date().toISOString(), user_id: USER_ID });
  }
  if (novas.length > 0) {
    const { error: erroInsert } = await supabase.from("movimentacoes").insert(novas);
    if (erroInsert) throw new Error(erroInsert.message);
  }
  return novas.length;
}

async function registrar(campos: Record<string, unknown>) {
  // Reaproveita a tabela de situação das publicações (uma linha por rotina). Se a tabela não existir, segue sem registrar.
  await supabase.from("publicacoes_sync_status").upsert({ id: STATUS_ID, updated_at: new Date().toISOString(), ...campos }, { onConflict: "id" });
}

export async function GET(req: NextRequest) {
  const segredo = envLimpo("CRON_SECRET");
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const iniciadoEm = new Date().toISOString();
  const { data: processos, error } = await supabase
    .from("processos")
    .select("id,numero,tribunal,ultimo_sync")
    .eq("monitorar_datajud", true)
    .eq("status", "ativo")
    .order("ultimo_sync", { ascending: true, nullsFirst: true });
  if (error) {
    await registrar({ last_run_at: iniciadoEm, last_errors: [error.message] });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Os que ficaram mais tempo sem consulta vão primeiro; o que não couber no tempo fica para a próxima execução.
  const fila = (processos ?? []).filter((p) => p.numero && String(p.numero).replace(/\D/g, "").length === 20);
  let consultados = 0, novas = 0;
  const erros: string[] = [];

  async function trabalhador() {
    while (fila.length > 0 && Date.now() - inicio < ORCAMENTO_MS) {
      const p = fila.shift()!;
      consultados++;
      try {
        novas += await sincronizar(p);
      } catch (err) {
        erros.push(`${p.numero}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
      }
      // Marca a tentativa mesmo com erro, para a fila girar e um processo com problema não travar os outros.
      await supabase.from("processos").update({ ultimo_sync: new Date().toISOString() }).eq("id", p.id);
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabalhador));

  await registrar({
    last_run_at: iniciadoEm,
    ...(erros.length < consultados || consultados === 0 ? { last_success_at: new Date().toISOString() } : {}),
    last_found: consultados,
    last_imported: novas,
    last_errors: erros.slice(0, 20),
  });

  return NextResponse.json({ ok: true, regiao: process.env.VERCEL_REGION ?? null, consultados, pendentes: fila.length, novas, erros: erros.slice(0, 20) });
}
