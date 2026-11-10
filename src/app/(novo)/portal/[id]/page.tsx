"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { useDB } from "@/novo/lib/store";
import { areaDe } from "@/novo/lib/areas";
import { brl, data, diaSemana, hojeISO, hora } from "@/novo/lib/format";

// Como o cliente enxerga os próprios casos. Só entra o que não expõe estratégia:
// fase, andamentos (com a versão em linguagem simples), compromissos e parcelas.
export default function Portal() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const c = db.clientes.find((x) => x.id === id);
  const hoje = hojeISO();
  if (!c) return <main className="mx-auto max-w-[720px] p-6"><p>Cliente não encontrado. <Link href="/clientes" className="font-semibold underline">Voltar</Link></p></main>;
  const casos = db.casos.filter((x) => x.cliente_id === id && x.status !== "arquivado");
  const ids = new Set(casos.map((x) => x.id));
  const compromissos = [
    ...db.audiencias.filter((a) => ids.has(a.caso_id) && !a.realizada && a.data_hora.slice(0, 10) >= hoje).map((a) => ({ k: a.id, q: a.data_hora, t: a.titulo, l: a.local })),
    ...db.atendimentos.filter((a) => a.cliente_id === id && a.status === "agendado" && a.data_hora.slice(0, 10) >= hoje).map((a) => ({ k: a.id, q: a.data_hora, t: `Atendimento no escritório (${a.tipo})`, l: db.config.escritorio })),
  ].sort((a, b) => a.q.localeCompare(b.q));
  const parcelas = db.honorarios.filter((h) => ids.has(h.caso_id) && h.status === "pendente" && h.tipo !== "êxito").sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return (
    <div className="min-h-dvh bg-porcelana">
      <div className="bg-ink px-4 py-2 text-center text-[12.5px] text-white">Pré-visualização do portal do cliente. <Link href={`/clientes/${id}`} className="font-semibold underline"><ChevronLeft className="inline size-3.5" />Voltar ao escritório</Link></div>
      <main className="mx-auto max-w-[720px] px-4 pb-16 pt-8">
        <p className="titulo text-[20px]">justio<span className="ml-1 inline-block size-2 rounded-full bg-ocre-v" /></p>
        <h1 className="titulo mt-6 text-[32px]">Olá, {c.nome.split(" ")[0]}</h1>
        <p className="mt-1 text-ink-2">Acompanhe aqui o andamento dos seus casos com {db.config.escritorio}.</p>

        {compromissos.length > 0 && (
          <section className="mt-6 rounded-[16px] bg-ink p-5 text-white">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white/70"><CalendarDays className="size-4" />Próximo compromisso</h2>
            <p className="titulo mt-2 text-[24px]"><span className="first-letter:uppercase">{diaSemana(compromissos[0].q)}</span>, {data(compromissos[0].q)} às {hora(compromissos[0].q)}</p>
            <p className="mt-1">{compromissos[0].t}</p>{compromissos[0].l && <p className="text-[13px] text-white/70">{compromissos[0].l}</p>}
            {compromissos.length > 1 && <p className="mt-3 text-[13px] text-white/70">E mais {compromissos.length - 1} agendado{compromissos.length > 2 ? "s" : ""}.</p>}
          </section>
        )}

        {casos.map((x) => {
          const a = areaDe(x.area);
          const movs = db.andamentos.filter((m) => m.caso_id === x.id).sort((p, q) => q.data.localeCompare(p.data)).slice(0, 5);
          return (
            <section key={x.id} className="painel mt-5">
              <div className="p-5">
                <p className="text-[12.5px] font-semibold text-ink-3">{a.nome}{x.numero ? ` · processo nº ${x.numero}` : ""}</p>
                <h2 className="titulo mt-1 text-[19px]">{x.titulo}</h2>
                <p className="mt-3 text-[13px] text-ink-2">Fase atual: <strong className="text-ink">{a.fases[x.fase]}</strong> ({x.fase + 1} de {a.fases.length})</p>
                <div className="mt-2 flex gap-0.5" aria-hidden>{a.fases.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= x.fase ? "#0a0a0a" : "#e4e4e4" }} />)}</div>
              </div>
              <ol className="border-t border-line-2">
                {movs.length === 0 && <li className="px-5 py-4 text-ink-2">Ainda não há andamentos registrados.</li>}
                {movs.map((m) => <li key={m.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-b border-line-2 px-5 py-3 last:border-0"><span className="text-[12.5px] text-ink-3">{data(m.data)}</span><span>{m.texto_cliente ?? m.descricao}</span></li>)}
              </ol>
            </section>
          );
        })}
        {casos.length === 0 && <p className="painel mt-5 p-5 text-ink-2">Você ainda não tem casos em andamento.</p>}

        {parcelas.length > 0 && (
          <section className="painel mt-5">
            <div className="painel-cab"><h2>Honorários em aberto</h2><span className="font-semibold">{brl(parcelas.reduce((s, h) => s + h.valor, 0))}</span></div>
            <ul>{parcelas.slice(0, 6).map((h) => <li key={h.id} className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-2.5 last:border-0"><span>{h.descricao}<span className={`block text-[12.5px] ${h.vencimento < hoje ? "font-semibold text-perigo" : "text-ink-3"}`}>{h.vencimento < hoje ? "Venceu em" : "Vence em"} {data(h.vencimento)}</span></span><span className="font-semibold">{brl(h.valor)}</span></li>)}</ul>
          </section>
        )}
        <p className="mt-8 text-center text-[12.5px] text-ink-3">{db.config.escritorio} · {db.config.cidade}</p>
      </main>
    </div>
  );
}
