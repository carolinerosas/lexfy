"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { brl, data, diaSemana, hora } from "@/novo/lib/format";
import { Avatar, Cabecalho, Dialogo, LinkCaso, Rotulado, Seg, Vazio, useMapas } from "@/novo/components/ui";
import type { Atendimento } from "@/novo/lib/types";

const TIPOS: Atendimento["tipo"][] = ["consulta inicial", "retorno", "orientação", "preparação de audiência", "visita à unidade prisional"];

export default function Atendimentos() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [ver, setVer] = useState<Atendimento["status"]>("agendado");
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ cliente: "", data: "", hora: "10:00", tipo: TIPOS[0], duracao: 45, valor: "", resp: "" });
  const lista = useMemo(() => db.atendimentos.filter((a) => a.status === ver).sort((a, b) => (ver === "agendado" ? a.data_hora.localeCompare(b.data_hora) : b.data_hora.localeCompare(a.data_hora))), [db.atendimentos, ver]);

  function salvar() {
    if (!f.cliente.trim() || !f.data) return;
    const cli = db.clientes.find((c) => c.nome === f.cliente.trim());
    incluir("atendimentos", { cliente_id: cli?.id, cliente_nome: f.cliente.trim(), data_hora: `${f.data}T${f.hora}:00`, duracao_min: Number(f.duracao), tipo: f.tipo, status: "agendado", responsavel_id: f.resp || db.equipe[0].id, valor: f.valor ? Number(f.valor) : undefined });
    setNovo(false);
  }

  return (
    <>
      <Cabecalho titulo="Atendimentos" sub="Consultas, retornos, preparação de audiência e visitas a clientes presos.">
        <Seg rotulo="Situação" valor={ver} aoMudar={setVer} opcoes={[["agendado", "Agendados"], ["realizado", "Realizados"], ["cancelado", "Cancelados"]] as const} />
        <button className="btn btn-p" onClick={() => setNovo(true)}><Plus />Agendar</button>
      </Cabecalho>
      <div className="painel overflow-x-auto">
        {lista.length === 0 ? <Vazio titulo="Nenhum atendimento nesta situação">Use “Agendar” para marcar o próximo.</Vazio> : (
          <table className="tb min-w-[760px]">
            <thead><tr><th>Quando</th><th>Cliente</th><th>Tipo</th><th>Caso</th><th className="num">Valor</th><th>Resp.</th><th /></tr></thead>
            <tbody>{lista.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap"><span className="font-semibold">{data(a.data_hora)}</span> <span className="text-ink-3">{diaSemana(a.data_hora)}</span><span className="block text-[12.5px] text-ink-3">{hora(a.data_hora)} · {a.duracao_min} min</span></td>
                <td className="font-semibold">{a.cliente_nome}{a.notas && <span className="block max-w-[280px] truncate text-[12.5px] font-normal text-ink-3">{a.notas}</span>}</td>
                <td><span className={`tag ${a.tipo === "visita à unidade prisional" ? "tag-alerta" : ""}`}>{a.tipo}</span></td>
                <td className="max-w-[240px]">{a.caso_id ? <LinkCaso caso={caso(a.caso_id)} /> : <span className="text-ink-3">—</span>}</td>
                <td className="num">{a.valor ? brl(a.valor) : "—"}</td>
                <td><Avatar pessoa={pessoa(a.responsavel_id)} /></td>
                <td className="num whitespace-nowrap">{a.status === "agendado" && <><button className="btn btn-g btn-sm" onClick={() => alterar("atendimentos", a.id, { status: "realizado" })}>Realizado</button> <button className="btn btn-perigo btn-sm" onClick={() => alterar("atendimentos", a.id, { status: "cancelado" })}>Cancelar</button></>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <Dialogo aberto={novo} aoFechar={() => setNovo(false)} titulo="Agendar atendimento" rodape={<><button className="btn btn-g" onClick={() => setNovo(false)}>Cancelar</button><button className="btn btn-p" disabled={!f.cliente.trim() || !f.data} onClick={salvar}>Agendar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Cliente ou interessado" className="sm:col-span-2"><input className="inp" list="at-clientes" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /><datalist id="at-clientes">{db.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist></Rotulado>
          <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Hora"><input type="time" className="inp" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Atendimento["tipo"] })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Rotulado>
          <Rotulado rotulo="Duração (min)"><input type="number" className="inp" value={f.duracao} onChange={(e) => setF({ ...f, duracao: Number(e.target.value) })} /></Rotulado>
          <Rotulado rotulo="Valor da consulta (R$)"><input type="number" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Quem atende"><select className="inp" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}><option value="">Escolher</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Rotulado>
        </div>
      </Dialogo>
    </>
  );
}
