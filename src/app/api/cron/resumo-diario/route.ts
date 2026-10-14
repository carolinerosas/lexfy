import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";
import { enviarPush, primeiraVez } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cron das 6h (09:00 UTC): resumo do dia no celular da Carol e, para cada audiência daqui a
// 3 dias, um aviso que abre o WhatsApp do cliente com a mensagem de lembrete pronta.

function hojeBR(deslocamentoDias = 0): string {
  const d = new Date(Date.now() + deslocamentoDias * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

const hora = (dataHora: string) => (dataHora.split("T")[1] ?? "").slice(0, 5);
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function GET(req: NextRequest) {
  const segredo = envLimpo("CRON_SECRET");
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // Sem aparelho autorizado, não marca nada como enviado (senão os lembretes se perdem).
  const { count: aparelhos } = await supabase.from("push_inscricoes").select("endpoint", { count: "exact", head: true });
  if (!aparelhos) return NextResponse.json({ ok: true, aparelhos: 0 });

  const hoje = hojeBR();
  const em2 = hojeBR(2);
  const em3 = hojeBR(3);
  const ontem = new Date(Date.now() - 864e5).toISOString();

  const [processos, prazos, audiencias, aud3, atendimentos, publicacoes, tarefas, contas, parcelas, honorarios] = await Promise.all([
    supabase.from("processos").select("id,titulo,cliente_nome,cliente_id"),
    supabase.from("prazos").select("titulo,data_prazo,processo_id").eq("concluido", false).lte("data_prazo", em2).order("data_prazo"),
    supabase.from("audiencias").select("titulo,data_hora,local,processo_id").eq("realizada", false).gte("data_hora", hoje).lt("data_hora", `${hoje}T99`),
    supabase.from("audiencias").select("id,titulo,data_hora,local,processo_id").eq("realizada", false).gte("data_hora", em3).lt("data_hora", `${em3}T99`),
    supabase.from("atendimentos").select("cliente_nome,data_hora,tipo").eq("status", "agendado").gte("data_hora", hoje).lt("data_hora", `${hoje}T99`),
    supabase.from("publicacoes").select("id", { count: "exact", head: true }).gte("created_at", ontem),
    supabase.from("tarefas").select("titulo,processo_id").eq("concluida", false).eq("data_limite", hoje),
    supabase.from("contas_escritorio").select("descricao,valor").neq("status", "paga").eq("data_vencimento", hoje),
    supabase.from("acordo_parcelas").select("titulo,cliente_nome,valor,direcao").eq("pago", false).eq("data_vencimento", hoje),
    supabase.from("honorarios").select("descricao,valor,processo_id").eq("categoria", "cobranca").eq("status", "pendente").eq("data_vencimento", hoje),
  ]);

  const proc = new Map((processos.data ?? []).map((p) => [p.id, p]));
  const cliente = (processoId?: string | null) => (processoId ? proc.get(processoId)?.cliente_nome?.split(" ")[0] : undefined) ?? "";

  // --- resumo do dia ---
  const linhas: string[] = [];
  for (const a of (audiencias.data ?? []).sort((x, y) => x.data_hora.localeCompare(y.data_hora))) {
    linhas.push(`⚖️ ${hora(a.data_hora)} ${a.titulo}${cliente(a.processo_id) ? ` — ${cliente(a.processo_id)}` : ""}`);
  }
  for (const a of (atendimentos.data ?? []).sort((x, y) => x.data_hora.localeCompare(y.data_hora))) {
    linhas.push(`🗓️ ${hora(a.data_hora)} atendimento — ${a.cliente_nome}`);
  }
  for (const p of prazos.data ?? []) {
    const quando = p.data_prazo < hoje ? `VENCIDO ${dataBR(p.data_prazo)}` : p.data_prazo === hoje ? "vence HOJE" : `vence ${dataBR(p.data_prazo)}`;
    linhas.push(`⏰ ${p.titulo}${cliente(p.processo_id) ? ` (${cliente(p.processo_id)})` : ""} — ${quando}`);
  }
  for (const t of tarefas.data ?? []) linhas.push(`✅ ${t.titulo}${cliente(t.processo_id) ? ` (${cliente(t.processo_id)})` : ""}`);
  for (const c of contas.data ?? []) linhas.push(`🧾 ${c.descricao} ${reais(Number(c.valor))} vence hoje`);
  for (const p of parcelas.data ?? []) {
    linhas.push(`🤝 ${p.titulo ?? "Acordo"}${p.cliente_nome ? ` (${p.cliente_nome.split(" ")[0]})` : ""} ${reais(Number(p.valor))} a ${p.direcao === "pagar" ? "pagar" : "receber"}`);
  }
  for (const h of honorarios.data ?? []) linhas.push(`💰 ${h.descricao} ${reais(Number(h.valor))}${cliente(h.processo_id) ? ` (${cliente(h.processo_id)})` : ""}`);
  if (publicacoes.count) linhas.push(`📰 ${publicacoes.count} publicaç${publicacoes.count > 1 ? "ões novas" : "ão nova"} desde ontem`);

  let enviados = 0;
  if (linhas.length && (await primeiraVez(`resumo:${hoje}`))) {
    const qtdAud = audiencias.data?.length ?? 0;
    const titulo = qtdAud ? `Bom dia! Hoje: ${qtdAud} audiência${qtdAud > 1 ? "s" : ""}` : "Bom dia! Seu dia no Justio";
    enviados += await enviarPush({ title: titulo, body: linhas.slice(0, 12).join("\n"), url: "/dashboard/agenda", tag: `resumo-${hoje}` });
  }

  // --- audiências daqui a 3 dias: avisar o cliente pelo WhatsApp ---
  const idsClientes = [...new Set((aud3.data ?? []).map((a) => proc.get(a.processo_id)?.cliente_id).filter(Boolean))] as string[];
  const { data: clientes } = idsClientes.length
    ? await supabase.from("clientes").select("id,nome,celular").in("id", idsClientes)
    : { data: [] as { id: string; nome: string; celular?: string }[] };
  const celulares = new Map((clientes ?? []).map((c) => [c.id, c]));

  for (const a of aud3.data ?? []) {
    if (!(await primeiraVez(`aud3:${a.id}`))) continue;
    const p = proc.get(a.processo_id);
    const c = p?.cliente_id ? celulares.get(p.cliente_id) : undefined;
    const fone = (c?.celular ?? "").replace(/\D/g, "");
    const nome = (c?.nome ?? p?.cliente_nome ?? "").split(" ")[0];
    const quando = `${dataBR(a.data_hora)} às ${hora(a.data_hora)}`;
    const mensagem = `Olá, ${nome}! Aqui é a Dra. Caroline Fraga. Passando para lembrar da sua audiência no dia ${quando}${a.local ? `, ${a.local}` : ""}. Qualquer dúvida, estou à disposição.`;
    enviados += await enviarPush({
      title: `Audiência em 3 dias — ${nome || "cliente"}`,
      body: fone ? `${a.titulo}, ${quando}. Toque para avisar ${nome} pelo WhatsApp.` : `${a.titulo}, ${quando}. Cliente sem celular cadastrado no Justio.`,
      url: fone ? `https://wa.me/${fone.length <= 11 ? `55${fone}` : fone}?text=${encodeURIComponent(mensagem)}` : `/dashboard/processos/${a.processo_id}`,
      tag: `aud3-${a.id}`,
    });
  }

  return NextResponse.json({ ok: true, hoje, itens: linhas.length, lembretes: aud3.data?.length ?? 0, enviados });
}
