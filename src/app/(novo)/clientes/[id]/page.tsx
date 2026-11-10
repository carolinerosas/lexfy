"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { areaDe } from "@/novo/lib/areas";
import { brl, data, hojeISO, hora } from "@/novo/lib/format";
import { Azulejo } from "@/novo/components/azulejo";
import { Vazio } from "@/novo/components/ui";
import { Cobrar, NovoHonorario } from "@/novo/components/honorario";

export default function PaginaCliente() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const c = db.clientes.find((x) => x.id === id);
  if (!c) return <div className="painel"><Vazio titulo="Cliente não encontrado"><Link className="font-semibold text-cobalto underline" href="/clientes">Voltar para os clientes</Link></Vazio></div>;
  const casos = db.casos.filter((x) => x.cliente_id === id);
  const ids = new Set(casos.map((x) => x.id));
  const hon = db.honorarios.filter((h) => ids.has(h.caso_id)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const atend = db.atendimentos.filter((a) => a.cliente_id === id).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
  const hoje = hojeISO();
  const recebido = hon.filter((h) => h.status === "recebido").reduce((s, h) => s + h.valor, 0);
  const aberto = hon.filter((h) => h.status === "pendente" && h.tipo !== "êxito");

  return (
    <>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-cobalto"><ChevronLeft className="size-4" />Clientes</Link>
      <header className="mb-5">
        <h1 className="titulo text-[34px]">{c.nome}</h1>
        <p className="mt-1 text-ink-2">{c.tipo === "pj" ? "Empresa" : "Pessoa física"} · {c.documento ?? "sem documento"} · cliente desde {data(c.criado_em)}</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <Link href={`/documentos?cliente=${c.id}`} className="btn btn-g btn-sm">Gerar documento</Link>
          <Link href={`/portal/${c.id}`} className="btn btn-g btn-sm">Ver como o cliente vê</Link>
          <Link href={`/relatorio/${c.id}`} className="btn btn-g btn-sm">Relatório do cliente</Link>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="painel">
            <div className="painel-cab"><h2>Contato</h2></div>
            <dl className="divide-y divide-line-2 text-[13.5px]">
              {([["Celular", c.celular], ["E-mail", c.email], ["Cidade", c.cidade && `${c.cidade}/${c.uf ?? ""}`], ["Origem", c.origem]] as const).map(([k, v]) => <div key={k} className="px-4 py-2"><dt className="text-[12px] font-semibold text-ink-3">{k}</dt><dd className="break-words">{v || "Não informado"}</dd></div>)}
            </dl>
          </section>
          <section className="painel">
            <div className="painel-cab"><h2>Financeiro</h2></div>
            <dl className="divide-y divide-line-2 text-[13.5px]">
              <div className="flex justify-between px-4 py-2"><dt className="text-ink-3">Recebido</dt><dd className="font-semibold">{brl(recebido)}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt className="text-ink-3">Em aberto</dt><dd className="font-semibold">{brl(aberto.reduce((s, h) => s + h.valor, 0))}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt className="text-ink-3">Vencido</dt><dd className="font-semibold text-perigo">{brl(aberto.filter((h) => h.vencimento < hoje).reduce((s, h) => s + h.valor, 0))}</dd></div>
            </dl>
          </section>
        </aside>
        <div className="min-w-0 space-y-4">
          <section className="painel">
            <div className="painel-cab"><h2>Casos ({casos.length})</h2></div>
            {casos.length === 0 ? <Vazio titulo="Nenhum caso">Use “Novo caso” no topo e informe este cliente.</Vazio> : (
              <ul>{casos.map((x) => { const a = areaDe(x.area); return (
                <li key={x.id} className="border-b border-line-2 last:border-0"><Link href={`/casos/${x.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-porcelana">
                  <Azulejo area={a} tamanho={32} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.titulo}</span><span className="block truncate text-[12.5px] text-ink-3">{a.nome} · {a.fases[x.fase]}{x.numero ? ` · ${x.numero}` : ""}</span></span>
                  <span className="tag">{x.status === "ativo" ? "Em andamento" : x.status}</span></Link></li>
              ); })}</ul>
            )}
          </section>
          <section className="painel overflow-x-auto">
            <div className="painel-cab"><h2>Honorários</h2>{casos.length > 0 && <NovoHonorario casoId={casos.length === 1 ? casos[0].id : undefined} classe="btn btn-g btn-sm" />}</div>
            {hon.length === 0 ? <Vazio titulo="Nenhum honorário lançado" /> : (
              <table className="tb"><thead><tr><th>Descrição</th><th>Vencimento</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{hon.map((h) => (
                  <tr key={h.id}><td>{h.descricao}<span className="block max-w-[260px] truncate text-[12px] text-ink-3">{casos.find((x) => x.id === h.caso_id)?.titulo}</span></td><td className={h.status === "pendente" && h.vencimento < hoje ? "font-semibold text-perigo" : ""}>{data(h.vencimento)}</td><td className="num">{brl(h.valor)}</td>
                    <td className="num">{h.status === "recebido" ? <span className="tag tag-ok">Recebido</span> : <span className="inline-flex items-center gap-1"><Cobrar honorario={h} /><button className="btn btn-g btn-sm" onClick={() => alterar("honorarios", h.id, { status: "recebido", recebido_em: hoje })}>Dar baixa</button></span>}</td></tr>
                ))}</tbody></table>
            )}
          </section>
          <section className="painel">
            <div className="painel-cab"><h2>Atendimentos</h2></div>
            {atend.length === 0 ? <Vazio titulo="Nenhum atendimento registrado" /> : (
              <ul>{atend.map((a) => <li key={a.id} className="border-b border-line-2 px-4 py-2.5 last:border-0"><p><span className="font-semibold">{data(a.data_hora)} às {hora(a.data_hora)}</span> · {a.tipo} · <span className="text-ink-3">{a.status}</span></p>{a.notas && <p className="text-[13px] text-ink-2">{a.notas}</p>}</li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
