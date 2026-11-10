"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Check, MapPin, Video } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { AREAS, areaDe } from "@/novo/lib/areas";
import { brl, data, dataCurta, dataLonga, diasAte, hojeISO, hora, quando } from "@/novo/lib/format";
import { Azulejo } from "@/novo/components/azulejo";
import { Avatar, Cabecalho, LinkCaso, Vazio, useMapas } from "@/novo/components/ui";

export default function Hoje() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const hoje = hojeISO();

  const pauta = useMemo(() => [
    ...db.audiencias.filter((a) => a.data_hora.startsWith(hoje)).map((a) => ({ id: a.id, quando: a.data_hora, tipo: "Audiência", titulo: a.titulo, caso_id: a.caso_id, local: a.local, virtual: a.modalidade !== "presencial", resp: a.responsavel_id })),
    ...db.atendimentos.filter((a) => a.data_hora.startsWith(hoje) && a.status !== "cancelado").map((a) => ({ id: a.id, quando: a.data_hora, tipo: "Atendimento", titulo: `${a.tipo[0].toUpperCase()}${a.tipo.slice(1)}: ${a.cliente_nome}`, caso_id: a.caso_id, local: "Escritório", virtual: false, resp: a.responsavel_id })),
  ].sort((a, b) => a.quando.localeCompare(b.quando)), [db.audiencias, db.atendimentos, hoje]);

  const prazos = useMemo(() => db.prazos.filter((p) => !p.concluido && diasAte(p.data) <= 7).sort((a, b) => a.data.localeCompare(b.data)), [db.prazos]);
  const novos = useMemo(() => [
    ...db.publicacoes.filter((p) => !p.lida).map((p) => ({ id: p.id, t: "publicacoes" as const, data: p.data, rotulo: `Publicação · ${p.diario}`, texto: p.texto, caso_id: p.caso_id })),
    ...db.andamentos.filter((a) => !a.lido).map((a) => ({ id: a.id, t: "andamentos" as const, data: a.data, rotulo: "Andamento", texto: a.descricao, caso_id: a.caso_id })),
  ].sort((a, b) => b.data.localeCompare(a.data)), [db.publicacoes, db.andamentos]);

  const presos = useMemo(() => db.casos.filter((c) => c.status === "ativo" && typeof c.dados.situacao === "string" && /pris[aã]o prev|flagrante|tempor/i.test(c.dados.situacao)).map((c) => {
    const base = String(c.dados.revisao || c.dados.prisao_data || "");
    return { c, dias: base ? -diasAte(base) : null };
  }).sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0)), [db.casos]);

  const porArea = useMemo(() => AREAS.filter((a) => db.config.areasAtivas.includes(a.id)).map((a) => ({ a, n: db.casos.filter((c) => c.area === a.id && c.status === "ativo").length })).filter((x) => x.n > 0), [db.casos, db.config.areasAtivas]);
  const pend = db.honorarios.filter((h) => h.status === "pendente" && h.tipo !== "êxito");
  const vencidos = pend.filter((h) => h.vencimento < hoje);
  const doMes = pend.filter((h) => h.vencimento >= hoje && h.vencimento.slice(0, 7) === hoje.slice(0, 7));
  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0);

  const marcarLido = (n: (typeof novos)[number]) => n.t === "publicacoes" ? alterar("publicacoes", n.id, { lida: true }) : alterar("andamentos", n.id, { lido: true });

  return (
    <>
      <Cabecalho titulo="Hoje" sub={<span className="first-letter:uppercase">{dataLonga(new Date())}</span>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0 space-y-5">
          <section className="painel">
            <div className="painel-cab"><h2>Pauta do dia</h2><Link href="/agenda" className="btn btn-q btn-sm">Agenda completa <ArrowRight /></Link></div>
            {pauta.length === 0 ? <Vazio titulo="Nenhum compromisso hoje">Audiências e atendimentos marcados para o dia aparecem aqui, em ordem de horário.</Vazio> : (
              <ol>
                {pauta.map((p) => {
                  const c = caso(p.caso_id);
                  const passou = new Date(p.quando).getTime() < Date.now();
                  return (
                    <li key={p.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-2 px-4 py-3 last:border-0">
                      <span className={`titulo text-[24px] ${passou ? "text-ink-3" : "text-ink"}`}>{hora(p.quando)}</span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`tag ${p.tipo === "Audiência" ? "tag-info" : ""}`}>{p.tipo}</span><span className="font-semibold">{p.titulo}</span></p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-3">
                          {c && <Link href={`/casos/${c.id}`} className="inline-flex items-center gap-1.5 hover:text-cobalto hover:underline"><Azulejo area={areaDe(c.area)} tamanho={14} />{c.titulo}</Link>}
                          <span className="inline-flex items-center gap-1">{p.virtual ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}{p.local}</span>
                        </p>
                      </div>
                      <Avatar pessoa={pessoa(p.resp)} />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="painel">
            <div className="painel-cab"><h2>Prazos até a próxima semana</h2><Link href="/prazos" className="btn btn-q btn-sm">Todos os prazos <ArrowRight /></Link></div>
            {prazos.length === 0 ? <Vazio titulo="Nenhum prazo nos próximos 7 dias" /> : (
              <div className="overflow-x-auto"><table className="tb">
                <thead><tr><th className="w-10"><span className="sr-only">Concluir</span></th><th>Vence</th><th>Prazo</th><th>Caso</th><th>Resp.</th></tr></thead>
                <tbody>{prazos.map((p) => {
                  const n = diasAte(p.data);
                  return (
                    <tr key={p.id}>
                      <td><button className="btn btn-g btn-icone btn-sm" title="Marcar como cumprido" aria-label={`Marcar ${p.titulo} como cumprido`} onClick={() => alterar("prazos", p.id, { concluido: true })}><Check /></button></td>
                      <td className="whitespace-nowrap"><span className={`tag ${n < 0 ? "tag-perigo" : n === 0 ? "tag-alerta" : ""}`}>{n < 0 ? `Vencido ${quando(p.data)}` : quando(p.data)}</span><span className="ml-2 text-[12.5px] text-ink-3">{dataCurta(p.data)}</span></td>
                      <td><span className="font-semibold">{p.titulo}</span>{p.fatal && <span className="ml-2 text-[12px] font-semibold text-perigo">fatal</span>}{p.base && <span className="block text-[12.5px] text-ink-3">{p.base}</span>}</td>
                      <td className="max-w-[280px]"><LinkCaso caso={caso(p.caso_id)} /></td>
                      <td><Avatar pessoa={pessoa(p.responsavel_id)} /></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>

          <section className="painel">
            <div className="painel-cab"><h2>Ainda não lido</h2><span className="text-[12.5px] text-ink-3">{novos.length} {novos.length === 1 ? "item" : "itens"}</span></div>
            {novos.length === 0 ? <Vazio titulo="Tudo lido">Publicações e andamentos novos ficam marcados aqui até alguém ler.</Vazio> : (
              <ul>{novos.slice(0, 8).map((n) => (
                <li key={n.t + n.id} className="nao-lido flex items-start gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-ink-3"><span className="font-semibold text-ink">{n.rotulo}</span> · {data(n.data)}{caso(n.caso_id) && <> · <Link className="hover:underline" href={`/casos/${n.caso_id}`}>{caso(n.caso_id)!.cliente_nome}</Link></>}</p>
                    <p className="line-clamp-2">{n.texto}</p>
                  </div>
                  <button className="btn btn-g btn-sm" onClick={() => marcarLido(n)}>Marcar lido</button>
                </li>
              ))}</ul>
            )}
            {novos.length > 8 && <p className="border-t border-line-2 px-4 py-2 text-[12.5px] text-ink-3">Mais {novos.length - 8} em <Link className="font-semibold text-cobalto hover:underline" href="/publicacoes">Publicações</Link> e <Link className="font-semibold text-cobalto hover:underline" href="/andamentos">Andamentos</Link>.</p>}
          </section>
        </div>

        <aside className="space-y-5">
          {presos.length > 0 && (
            <section className="painel">
              <div className="painel-cab"><h2>Clientes presos</h2><span className="tag tag-perigo">{presos.length}</span></div>
              <ul>{presos.map(({ c, dias }) => (
                <li key={c.id} className="border-b border-line-2 px-4 py-2.5 last:border-0">
                  <Link href={`/casos/${c.id}`} className="font-semibold hover:text-cobalto hover:underline">{c.cliente_nome}</Link>
                  <p className="text-[12.5px] text-ink-3">{String(c.dados.situacao)}{c.dados.unidade ? ` · ${c.dados.unidade}` : ""}</p>
                  {dias !== null && (
                    <p className="mt-1.5 flex items-center gap-2 text-[12.5px]">
                      <span className="h-1.5 flex-1 rounded-full bg-cobalto-f"><span className="block h-1.5 rounded-full" style={{ width: `${Math.min(100, (dias / 90) * 100)}%`, background: dias >= 75 ? "var(--color-perigo)" : "var(--color-cobalto)" }} /></span>
                      <span className={dias >= 75 ? "font-semibold text-perigo" : "text-ink-2"}>{dias >= 90 ? `Revisão atrasada (${dias} dias)` : `${dias} de 90 dias da última revisão`}</span>
                    </p>
                  )}
                </li>
              ))}</ul>
            </section>
          )}

          <section className="painel">
            <div className="painel-cab"><h2>Casos por área</h2><Link href="/areas" className="btn btn-q btn-sm">Ver áreas <ArrowRight /></Link></div>
            <ul className="grid grid-cols-2 gap-px bg-line-2">
              {porArea.map(({ a, n }) => (
                <li key={a.id} className="bg-surface">
                  <Link href={`/areas/${a.id}`} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-porcelana">
                    <Azulejo area={a} tamanho={30} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.nome}</span>
                    <span className="font-bold">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="painel">
            <div className="painel-cab"><h2>Honorários a receber</h2><Link href="/financeiro" className="btn btn-q btn-sm">Financeiro <ArrowRight /></Link></div>
            <dl className="divide-y divide-line-2">
              <div className="flex items-baseline justify-between px-4 py-2.5"><dt className="text-ink-2">Vencidos ({vencidos.length})</dt><dd className="font-bold text-perigo">{brl(soma(vencidos))}</dd></div>
              <div className="flex items-baseline justify-between px-4 py-2.5"><dt className="text-ink-2">A vencer neste mês ({doMes.length})</dt><dd className="font-bold">{brl(soma(doMes))}</dd></div>
            </dl>
            <ul className="border-t border-line-2">{vencidos.slice(0, 3).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]"><span className="min-w-0 truncate">{caso(h.caso_id)?.cliente_nome} <span className="text-ink-3">· {h.descricao}</span></span><span className="shrink-0 text-ink-2">{brl(h.valor)}</span></li>
            ))}</ul>
          </section>

        </aside>
      </div>
    </>
  );
}
