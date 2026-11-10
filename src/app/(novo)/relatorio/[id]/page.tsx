"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { useDB } from "@/novo/lib/store";
import { areaDe } from "@/novo/lib/areas";
import { brl, data, dataLonga, diasAte, hojeISO } from "@/novo/lib/format";

const RISCO = { provavel: "Provável", possivel: "Possível", remoto: "Remota" } as const;

// Relatório para enviar ao cliente (pensado para clientes empresariais): casos, fase,
// últimos andamentos, próximos prazos, chance de êxito e valores.
export default function Relatorio() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const c = db.clientes.find((x) => x.id === id);
  const hoje = hojeISO();
  if (!c) return <main className="mx-auto max-w-[860px] p-6"><p>Cliente não encontrado. <Link href="/clientes" className="font-semibold underline">Voltar</Link></p></main>;
  const casos = db.casos.filter((x) => x.cliente_id === id);
  const ids = new Set(casos.map((x) => x.id));
  const hon = db.honorarios.filter((h) => ids.has(h.caso_id));
  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0);
  const emCausa = soma(casos.map((x) => ({ valor: x.valor ?? 0 })));

  return (
    <div className="min-h-dvh bg-porcelana print:bg-white">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2 text-[13px] text-white print:hidden">
        <Link href={`/clientes/${id}`} className="inline-flex items-center gap-1 font-semibold"><ChevronLeft className="size-4" />Voltar</Link>
        <button className="btn btn-sm bg-white text-ink" onClick={() => window.print()}><Printer />Imprimir ou salvar em PDF</button>
      </div>
      <main className="mx-auto my-6 max-w-[860px] bg-white p-8 shadow-peca print:my-0 print:p-0 print:shadow-none sm:p-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
          <div><p className="text-[12.5px] font-semibold text-ink-3">Relatório de acompanhamento</p><h1 className="titulo mt-1 text-[30px]">{c.nome}</h1></div>
          <p className="text-right text-[13px] text-ink-2">{db.config.escritorio}<br /><span className="first-letter:uppercase">{dataLonga(new Date())}</span></p>
        </header>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([["Casos acompanhados", String(casos.length)], ["Em andamento", String(casos.filter((x) => x.status === "ativo").length)], ["Valor em discussão", emCausa ? brl(emCausa) : "—"], ["Honorários em aberto", brl(soma(hon.filter((h) => h.status === "pendente" && h.tipo !== "êxito")))]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-[12px] font-semibold text-ink-3">{k}</dt><dd className="titulo mt-0.5 text-[20px]">{v}</dd></div>
          ))}
        </dl>

        {casos.map((x, n) => {
          const a = areaDe(x.area);
          const movs = db.andamentos.filter((m) => m.caso_id === x.id).sort((p, q) => q.data.localeCompare(p.data)).slice(0, 4);
          const prazos = db.prazos.filter((p) => p.caso_id === x.id && !p.concluido).sort((p, q) => p.data.localeCompare(q.data)).slice(0, 3);
          const aud = db.audiencias.filter((p) => p.caso_id === x.id && !p.realizada && p.data_hora.slice(0, 10) >= hoje)[0];
          return (
            <section key={x.id} className="mt-8 break-inside-avoid border-t border-line pt-5">
              <h2 className="titulo text-[18px]">{n + 1}. {x.titulo}</h2>
              <p className="mt-1 text-[13px] text-ink-2">{[a.nome, x.numero && `nº ${x.numero}`, x.orgao, x.comarca, x.parte_contraria && `contra ${x.parte_contraria}`].filter(Boolean).join(" · ")}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-3">
                <div><dt className="text-[12px] font-semibold text-ink-3">Fase</dt><dd>{a.fases[x.fase]}</dd></div>
                <div><dt className="text-[12px] font-semibold text-ink-3">Chance de êxito</dt><dd>{x.risco ? RISCO[x.risco] : "Não avaliada"}</dd></div>
                <div><dt className="text-[12px] font-semibold text-ink-3">Valor</dt><dd>{x.valor ? brl(x.valor) : "—"}</dd></div>
              </dl>
              <h3 className="mt-4 text-[12px] font-semibold text-ink-3">Últimos andamentos</h3>
              {movs.length === 0 ? <p className="text-[13.5px] text-ink-2">Sem andamentos no período.</p> : <ul className="mt-1 text-[13.5px]">{movs.map((m) => <li key={m.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 py-0.5"><span className="text-ink-3">{data(m.data)}</span><span>{m.texto_cliente ?? m.descricao}</span></li>)}</ul>}
              {(prazos.length > 0 || aud) && <>
                <h3 className="mt-4 text-[12px] font-semibold text-ink-3">Próximos passos</h3>
                <ul className="mt-1 text-[13.5px]">
                  {aud && <li className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 py-0.5"><span className="text-ink-3">{data(aud.data_hora)}</span><span>{aud.titulo}</span></li>}
                  {prazos.map((p) => <li key={p.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 py-0.5"><span className="text-ink-3">{data(p.data)}</span><span>{p.titulo}{diasAte(p.data) < 0 ? " (em providência)" : ""}</span></li>)}
                </ul>
              </>}
            </section>
          );
        })}
        {casos.length === 0 && <p className="mt-8 text-ink-2">Este cliente ainda não tem casos cadastrados.</p>}
        <footer className="mt-10 border-t border-line pt-4 text-[12px] text-ink-3">Documento informativo. A chance de êxito é uma estimativa do advogado responsável e pode mudar com o andamento do processo. {db.config.responsavel} · {db.config.oab}</footer>
      </main>
    </div>
  );
}
