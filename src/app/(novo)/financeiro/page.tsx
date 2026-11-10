"use client";
import { useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { areaDe, AREAS } from "@/novo/lib/areas";
import { brl, brlCurto, data, hojeISO, horas } from "@/novo/lib/format";
import { Abas, Avatar, Barras, Cabecalho, LinkCaso, Rotulado, Seg, Vazio, useMapas } from "@/novo/components/ui";
import { Cobrar, NovoHonorario } from "@/novo/components/honorario";
import { BotaoNovo } from "@/novo/components/form-rapido";
import type { Custa } from "@/novo/lib/types";

type Aba = "geral" | "honorarios" | "contas" | "custas" | "horas";

export default function Financeiro() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [aba, setAba] = useState<Aba>("geral");
  const [fh, setFh] = useState<"vencidos" | "pendentes" | "recebidos" | "exito">("vencidos");
  const [nc, setNc] = useState({ descricao: "", categoria: "Outros", valor: "", vencimento: "" });
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0);

  const pend = db.honorarios.filter((h) => h.status === "pendente" && h.tipo !== "êxito");
  const vencidos = pend.filter((h) => h.vencimento < hoje);
  const recebidoMes = db.honorarios.filter((h) => h.status === "recebido" && h.recebido_em?.startsWith(mes));
  const contasMes = db.contas.filter((c) => c.vencimento.startsWith(mes));
  const repasses = db.custas.filter((k) => k.tipo === "alvará a repassar");
  const reembolsar = db.custas.filter((k) => k.reembolsavel && !k.reembolsado);

  const fluxo = useMemo(() => [-3, -2, -1, 0, 1, 2].map((d) => {
    const m = format(addMonths(new Date(), d), "yyyy-MM");
    return {
      m, rotulo: format(addMonths(new Date(), d), "MMM", { locale: ptBR }), futuro: d > 0, atual: d === 0,
      entrou: soma(db.honorarios.filter((h) => h.status === "recebido" && h.recebido_em?.startsWith(m))),
      previsto: soma(db.honorarios.filter((h) => h.status === "pendente" && h.tipo !== "êxito" && h.vencimento.startsWith(m))),
      saiu: soma(db.contas.filter((c) => c.vencimento.startsWith(m))) + soma(db.equipe.map((e) => ({ valor: e.remuneracao }))),
    };
  }), [db.honorarios, db.contas, db.equipe]);
  const teto = Math.max(1, ...fluxo.map((f) => Math.max(f.entrou + f.previsto, f.saiu)));

  const porArea = useMemo(() => AREAS.map((a) => {
    const ids = new Set(db.casos.filter((c) => c.area === a.id).map((c) => c.id));
    return { rotulo: a.nome, valor: soma(db.honorarios.filter((h) => ids.has(h.caso_id) && h.status === "recebido")) };
  }).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 8), [db.casos, db.honorarios]);

  const listaH = db.honorarios.filter((h) => fh === "exito" ? h.tipo === "êxito" : fh === "recebidos" ? h.status === "recebido" : fh === "vencidos" ? h.status === "pendente" && h.tipo !== "êxito" && h.vencimento < hoje : h.status === "pendente" && h.tipo !== "êxito" && h.vencimento >= hoje)
    .sort((a, b) => (fh === "recebidos" ? (b.recebido_em ?? "").localeCompare(a.recebido_em ?? "") : a.vencimento.localeCompare(b.vencimento))).slice(0, 80);

  const horasPessoa = useMemo(() => db.equipe.filter((e) => e.meta_horas).map((e) => {
    const hs = db.horas.filter((h) => h.colaborador_id === e.id && h.data.startsWith(mes));
    return { e, total: hs.reduce((s, h) => s + h.minutos, 0), fat: hs.filter((h) => h.faturavel).reduce((s, h) => s + h.minutos, 0) };
  }), [db.equipe, db.horas, mes]);

  return (
    <>
      <Cabecalho titulo="Financeiro" sub="Honorários, contas do escritório, custas adiantadas, repasses a clientes e horas trabalhadas." />
      <Abas valor={aba} aoMudar={setAba} abas={[["geral", "Visão geral"], ["honorarios", `Honorários (${vencidos.length} vencidos)`], ["contas", "Contas do escritório"], ["custas", "Custas e repasses"], ["horas", "Horas"]] as const} />
      <div className="mt-5">
        {aba === "geral" && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line bg-line lg:grid-cols-4">
              {([["Recebido neste mês", brl(soma(recebidoMes)), ""], ["A receber, já vencido", brl(soma(vencidos)), "text-perigo"], ["Contas do mês", brl(soma(contasMes)), ""], ["A repassar a clientes", brl(soma(repasses)), repasses.length ? "text-ocre" : ""]] as const).map(([k, v, cor]) => (
                <div key={k} className="bg-surface p-5"><dt className="text-[12.5px] font-semibold text-ink-3">{k}</dt><dd className={`titulo mt-1 text-[26px] ${cor}`}>{v}</dd></div>
              ))}
            </dl>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <section className="painel">
                <div className="painel-cab"><h2>Entradas e saídas por mês</h2><p className="flex gap-3 text-[12px] text-ink-2"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />Recebido</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-ink bg-ocre-v" />Previsto</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c9c9c9]" />Saídas</span></p></div>
                <div className="flex h-[240px] items-end gap-3 px-5 pb-4 pt-6 sm:gap-6">
                  {fluxo.map((f) => (
                    <div key={f.m} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      <div className="flex flex-1 items-end justify-center gap-1.5" title={`Recebido ${brl(f.entrou)} · previsto ${brl(f.previsto)} · saídas ${brl(f.saiu)}`}>
                        <div className="flex w-1/2 max-w-9 flex-col justify-end" style={{ height: `${((f.entrou + f.previsto) / teto) * 100}%` }}>
                          {f.previsto > 0 && <div className="rounded-t-[6px] border border-b-0 border-ink bg-ocre-v" style={{ flex: f.previsto }} />}
                          {f.entrou > 0 && <div className={`bg-ink ${f.previsto > 0 ? "" : "rounded-t-[6px]"}`} style={{ flex: f.entrou }} />}
                        </div>
                        <div className="w-1/2 max-w-9 rounded-t-[6px] bg-[#c9c9c9]" style={{ height: `${(f.saiu / teto) * 100}%` }} />
                      </div>
                      <p className={`mt-2 text-center text-[12px] ${f.atual ? "font-bold" : "text-ink-3"}`}>{f.rotulo}</p>
                      <p className="truncate text-center text-[11.5px] text-ink-3">{brlCurto(f.entrou + f.previsto)}</p>
                    </div>
                  ))}
                </div>
                <p className="border-t border-line-2 px-5 py-2.5 text-[12.5px] text-ink-3">Saídas somam as contas do escritório e a remuneração da equipe. Honorários de êxito ficam fora da previsão.</p>
              </section>
              <section className="painel">
                <div className="painel-cab"><h2>Honorários recebidos por área</h2></div>
                <div className="p-5">{porArea.length ? <Barras itens={porArea} formato={brlCurto} /> : <p className="text-ink-2">Nenhum recebimento registrado.</p>}</div>
              </section>
            </div>
          </div>
        )}

        {aba === "honorarios" && (
          <>
            <div className="mb-3 flex flex-row-reverse flex-wrap items-center justify-between gap-2"><NovoHonorario /><Seg rotulo="Situação" valor={fh} aoMudar={setFh} opcoes={[["vencidos", `Vencidos · ${brlCurto(soma(vencidos))}`], ["pendentes", "A vencer"], ["recebidos", "Recebidos"], ["exito", "De êxito"]] as const} /></div>
            <div className="painel overflow-x-auto">
              {listaH.length === 0 ? <Vazio titulo="Nada nesta situação" /> : (
                <table className="tb min-w-[720px]"><thead><tr><th>Caso</th><th>Descrição</th><th>{fh === "recebidos" ? "Recebido em" : "Vencimento"}</th><th className="num">Valor</th><th /></tr></thead>
                  <tbody>{listaH.map((h) => (
                    <tr key={h.id}><td className="max-w-[300px]"><LinkCaso caso={caso(h.caso_id)} /></td><td>{h.descricao}<span className="block text-[12px] text-ink-3">{h.tipo}</span></td>
                      <td className={fh === "vencidos" ? "font-semibold text-perigo" : ""}>{data(fh === "recebidos" ? h.recebido_em : h.vencimento)}</td><td className="num font-semibold">{brl(h.valor)}</td>
                      <td className="num">{h.status === "recebido" ? <span className="tag tag-ok">Recebido</span> : <span className="inline-flex items-center gap-1"><Cobrar honorario={h} /><button className="btn btn-g btn-sm" onClick={() => alterar("honorarios", h.id, { status: "recebido", recebido_em: hoje })}>Dar baixa</button></span>}</td></tr>
                  ))}</tbody></table>
              )}
            </div>
          </>
        )}

        {aba === "contas" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="painel overflow-x-auto">
              <table className="tb min-w-[560px]"><thead><tr><th>Conta</th><th>Categoria</th><th>Vencimento</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{db.contas.filter((c) => c.vencimento >= format(addMonths(new Date(), -1), "yyyy-MM")).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((c) => (
                  <tr key={c.id}><td className="font-semibold">{c.descricao}{c.recorrente && <span className="ml-2 text-[12px] font-normal text-ink-3">mensal</span>}</td><td>{c.categoria}</td>
                    <td className={c.status === "pendente" && c.vencimento < hoje ? "font-semibold text-perigo" : ""}>{data(c.vencimento)}</td><td className="num">{brl(c.valor)}</td>
                    <td className="num">{c.status === "paga" ? <span className="tag tag-ok">Paga</span> : <button className="btn btn-g btn-sm" onClick={() => alterar("contas", c.id, { status: "paga" })}>Marcar paga</button>}</td></tr>
                ))}</tbody></table>
            </div>
            <form className="painel h-fit space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (!nc.descricao.trim() || !nc.valor || !nc.vencimento) return; incluir("contas", { descricao: nc.descricao.trim(), categoria: nc.categoria, valor: Number(nc.valor), vencimento: nc.vencimento, status: "pendente", recorrente: false }); setNc({ descricao: "", categoria: "Outros", valor: "", vencimento: "" }); }}>
              <h2 className="titulo text-[16px]">Nova conta</h2>
              <Rotulado rotulo="Descrição"><input className="inp" value={nc.descricao} onChange={(e) => setNc({ ...nc, descricao: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Categoria"><select className="inp" value={nc.categoria} onChange={(e) => setNc({ ...nc, categoria: e.target.value })}>{["Aluguel", "Condomínio", "Internet", "Energia", "Software", "Contador", "Tributos", "Marketing", "Material", "Anuidade da OAB", "Outros"].map((c) => <option key={c}>{c}</option>)}</select></Rotulado>
              <Rotulado rotulo="Valor (R$)"><input className="inp" type="number" step="0.01" value={nc.valor} onChange={(e) => setNc({ ...nc, valor: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Vencimento"><input className="inp" type="date" value={nc.vencimento} onChange={(e) => setNc({ ...nc, vencimento: e.target.value })} /></Rotulado>
              <button className="btn btn-p w-full" disabled={!nc.descricao.trim() || !nc.valor || !nc.vencimento}><Plus />Lançar conta</button>
            </form>
          </div>
        )}

        {aba === "custas" && (
          <div className="space-y-5">
            <p className="max-w-[75ch] text-ink-2">O dinheiro do cliente fica separado do dinheiro do escritório: alvarás levantados aparecem como valor a repassar, e as custas adiantadas ficam marcadas até o reembolso. {reembolsar.length > 0 && <>Há <strong className="text-ink">{brl(soma(reembolsar))}</strong> em custas a cobrar dos clientes.</>}</p>
            <BotaoNovo rotulo="Lançar custa ou repasse" aoSalvar={(v) => incluir("custas", { caso_id: String(v.caso_id), descricao: String(v.descricao), tipo: (v.tipo ?? "custas") as Custa["tipo"], valor: Number(v.valor) || 0, data: String(v.data ?? hoje), reembolsavel: !!v.reembolsavel, reembolsado: false })}
              campos={[{ k: "caso_id", rotulo: "Caso", tipo: "opcoes", obrig: true, largo: true, opcoes: db.casos.map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }, { k: "descricao", rotulo: "Descrição", obrig: true, largo: true }, { k: "tipo", rotulo: "Tipo", tipo: "opcoes", inicial: "custas", opcoes: ["custas", "depósito recursal", "depósito judicial", "perícia", "diligência", "emolumentos", "alvará a repassar"] }, { k: "valor", rotulo: "Valor (R$)", tipo: "numero", obrig: true }, { k: "data", rotulo: "Data", tipo: "data", inicial: hoje }, { k: "reembolsavel", rotulo: "O cliente reembolsa", tipo: "check", inicial: true }]} />
            <div className="painel overflow-x-auto">
              <table className="tb min-w-[720px]"><thead><tr><th>Caso</th><th>Lançamento</th><th>Data</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{[...db.custas].sort((a, b) => b.data.localeCompare(a.data)).map((k) => (
                  <tr key={k.id}><td className="max-w-[300px]"><LinkCaso caso={caso(k.caso_id)} /></td><td>{k.descricao}<span className="block text-[12px] text-ink-3">{k.tipo}</span></td><td>{data(k.data)}</td><td className="num font-semibold">{brl(k.valor)}</td>
                    <td className="num">{k.tipo === "alvará a repassar" ? <span className="tag tag-alerta">Repassar ao cliente</span> : k.reembolsavel ? (k.reembolsado ? <span className="tag tag-ok">Reembolsado</span> : <button className="btn btn-g btn-sm" onClick={() => alterar("custas", k.id, { reembolsado: true })}>Registrar reembolso</button>) : <span className="tag">Não reembolsável</span>}</td></tr>
                ))}</tbody></table>
            </div>
          </div>
        )}

        {aba === "horas" && (
          <><div className="mb-3"><BotaoNovo rotulo="Lançar horas" aoSalvar={(v) => incluir("horas", { colaborador_id: String(v.colaborador_id), caso_id: v.caso_id ? String(v.caso_id) : undefined, data: String(v.data ?? hoje), minutos: Math.round((Number(v.horas) || 0) * 60), atividade: String(v.atividade), faturavel: !!v.faturavel })}
            campos={[{ k: "colaborador_id", rotulo: "Quem", tipo: "opcoes", obrig: true, opcoes: db.equipe.map((e) => [e.id, e.nome] as const) }, { k: "data", rotulo: "Data", tipo: "data", inicial: hoje }, { k: "caso_id", rotulo: "Caso (em branco: trabalho interno)", tipo: "opcoes", largo: true, opcoes: db.casos.map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }, { k: "atividade", rotulo: "Atividade", obrig: true, largo: true }, { k: "horas", rotulo: "Horas (ex.: 1,5 = 1h30)", tipo: "numero", obrig: true }, { k: "faturavel", rotulo: "Faturável", tipo: "check", inicial: true }]} /></div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="painel">
              <div className="painel-cab"><h2>Horas do mês por pessoa</h2></div>
              <ul>{horasPessoa.map(({ e, total, fat }) => (
                <li key={e.id} className="border-b border-line-2 px-5 py-3 last:border-0">
                  <p className="flex items-center gap-2.5"><Avatar pessoa={e} /><span className="flex-1 font-semibold">{e.nome}</span><span className="text-[13px] text-ink-2">{horas(total)} de {e.meta_horas}h</span></p>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-cobalto-f"><span className="bg-ink" style={{ width: `${Math.min(100, (fat / 60 / (e.meta_horas ?? 1)) * 100)}%` }} /><span className="bg-[#b5b5b5]" style={{ width: `${Math.min(100, ((total - fat) / 60 / (e.meta_horas ?? 1)) * 100)}%` }} /></div>
                  <p className="mt-1 text-[12px] text-ink-3">{horas(fat)} faturáveis · {horas(total - fat)} internas</p>
                </li>
              ))}</ul>
            </section>
            <section className="painel overflow-x-auto">
              <div className="painel-cab"><h2>Últimos lançamentos</h2></div>
              <table className="tb"><thead><tr><th>Data</th><th>Atividade</th><th>Quem</th><th className="num">Tempo</th></tr></thead>
                <tbody>{[...db.horas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 14).map((h) => { const c = caso(h.caso_id); return (
                  <tr key={h.id}><td className="whitespace-nowrap">{data(h.data)}</td><td>{h.atividade}<span className="block max-w-[220px] truncate text-[12px] text-ink-3">{c ? `${areaDe(c.area).nome} · ${c.cliente_nome}` : "Interno"}</span></td><td><Avatar pessoa={pessoa(h.colaborador_id)} /></td><td className="num">{horas(h.minutos)}</td></tr>
                ); })}</tbody></table>
            </section>
          </div></>
        )}
      </div>
    </>
  );
}
