"use client";
import { useId, useState } from "react";
import { Plus, Play } from "lucide-react";
import { incluir, useDB } from "@/novo/lib/store";
import { hojeISO } from "@/novo/lib/format";
import { Dialogo, Rotulado } from "./ui";
import type { Atendimento } from "@/novo/lib/types";

export const TIPOS_ATENDIMENTO: Atendimento["tipo"][] = ["consulta inicial", "retorno", "orientação", "preparação de audiência", "visita à unidade prisional"];

const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/**
 * Botão + janela para registrar um atendimento.
 * modo "agora": começa já, com data e hora de agora, e fica como realizado (as notas são o registro).
 * modo "agendar": marca para uma data futura.
 * Com `clienteId`, o cliente já vem escolhido (pasta do cliente).
 */
export function NovoAtendimento({ modo, clienteId, classe, rotulo }: { modo: "agora" | "agendar"; clienteId?: string; classe?: string; rotulo?: string }) {
  const db = useDB();
  const lid = useId();
  const [aberto, setAberto] = useState(false);
  const vazio = () => ({ cliente: db.clientes.find((c) => c.id === clienteId)?.nome ?? "", caso_id: "", data: hojeISO(), hora: horaAgora(), tipo: TIPOS_ATENDIMENTO[0], duracao: 45, valor: "", resp: "", notas: "" });
  const [f, setF] = useState(vazio);
  const agora = modo === "agora";

  const cli = db.clientes.find((c) => (clienteId ? c.id === clienteId : c.nome === f.cliente.trim()));
  const casos = db.casos.filter((c) => (cli ? c.cliente_id === cli.id : false));

  function abrir() { setF(vazio()); setAberto(true); }
  function salvar() {
    if (!f.cliente.trim() || !f.data) return;
    incluir("atendimentos", {
      cliente_id: cli?.id, cliente_nome: cli?.nome ?? f.cliente.trim(), caso_id: f.caso_id || undefined,
      data_hora: `${f.data}T${f.hora || "00:00"}:00`, duracao_min: Number(f.duracao) || 45, tipo: f.tipo,
      status: agora ? "realizado" : "agendado", responsavel_id: f.resp || db.equipe[0]?.id || "e1",
      valor: f.valor ? Number(f.valor) : undefined, notas: f.notas.trim() || undefined,
    });
    setAberto(false);
  }

  return (
    <>
      <button className={classe ?? "btn btn-p"} onClick={abrir}>{agora ? <Play /> : <Plus />}{rotulo ?? (agora ? "Iniciar atendimento" : "Agendar")}</button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={agora ? "Iniciar atendimento" : "Agendar atendimento"}
        rodape={<><button className="btn btn-g" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-p" disabled={!f.cliente.trim() || !f.data} onClick={salvar}>{agora ? "Registrar atendimento" : "Agendar"}</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Cliente ou interessado" className="sm:col-span-2">
            <input className="inp" list={lid} value={f.cliente} readOnly={!!clienteId} onChange={(e) => setF({ ...f, cliente: e.target.value, caso_id: "" })} />
            <datalist id={lid}>{db.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
          </Rotulado>
          {casos.length > 0 && <Rotulado rotulo="Caso (opcional)" className="sm:col-span-2"><select className="inp" value={f.caso_id} onChange={(e) => setF({ ...f, caso_id: e.target.value })}><option value="">Nenhum</option>{casos.map((c) => <option key={c.id} value={c.id}>{c.titulo}{c.numero ? ` · ${c.numero}` : ""}</option>)}</select></Rotulado>}
          <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Hora"><input type="time" className="inp" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Atendimento["tipo"] })}>{TIPOS_ATENDIMENTO.map((t) => <option key={t}>{t}</option>)}</select></Rotulado>
          <Rotulado rotulo="Duração (min)"><input type="number" className="inp" value={f.duracao} onChange={(e) => setF({ ...f, duracao: Number(e.target.value) })} /></Rotulado>
          <Rotulado rotulo="Valor da consulta (R$)"><input type="number" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Quem atende"><select className="inp" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}><option value="">{db.equipe[0]?.nome ?? "Escolher"}</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Rotulado>
          <Rotulado rotulo={agora ? "Anotações do atendimento" : "Observações"} className="sm:col-span-2"><textarea className="inp min-h-24" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Rotulado>
        </div>
      </Dialogo>
    </>
  );
}
