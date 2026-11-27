"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Play } from "lucide-react";
import { incluir, useDB } from "@/novo/lib/store";
import { hojeISO, semAcento } from "@/novo/lib/format";
import { Dialogo, Rotulado } from "./ui";
import { CampoCliente } from "./campo-cliente";
import type { Atendimento, DB } from "@/novo/lib/types";

export const TIPOS_ATENDIMENTO: Atendimento["tipo"][] = ["consulta inicial", "retorno", "orientação", "preparação de audiência", "visita à unidade prisional"];

const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export interface FormAt { cliente: string; cliente_id: string; caso_id: string; data: string; hora: string; tipo: Atendimento["tipo"]; duracao: number; valor: string; resp: string; notas: string }

export const formVazio = (db: DB, clienteId?: string): FormAt => ({ cliente: db.clientes.find((c) => c.id === clienteId)?.nome ?? "", cliente_id: clienteId ?? "", caso_id: "", data: hojeISO(), hora: horaAgora(), tipo: TIPOS_ATENDIMENTO[0], duracao: 45, valor: "", resp: "", notas: "" });

/** Cria o atendimento (e o cliente, se o nome ainda não existir). Devolve o id. */
export function criarAtendimento(db: DB, f: FormAt, notas?: string): string {
  const cli = db.clientes.find((c) => (f.cliente_id ? c.id === f.cliente_id : semAcento(c.nome) === semAcento(f.cliente.trim())));
  const nome = cli?.nome ?? f.cliente.trim();
  const clienteNovo = cli ? undefined : incluir("clientes", { nome, tipo: "pf", criado_em: hojeISO() });
  return incluir("atendimentos", {
    cliente_id: cli?.id ?? clienteNovo, cliente_nome: nome, caso_id: f.caso_id || undefined,
    data_hora: `${f.data}T${f.hora || "00:00"}:00`, duracao_min: Number(f.duracao) || 45, tipo: f.tipo,
    status: "agendado", responsavel_id: f.resp || db.equipe[0]?.id || "e1",
    valor: f.valor ? Number(f.valor) : undefined, notas: notas?.trim() || undefined,
  });
}

/** Campos do atendimento, usados na página "Iniciar atendimento" e na janela "Agendar". */
export function CamposAtendimento({ f, setF, clienteId, observacoes }: { f: FormAt; setF: (f: FormAt) => void; clienteId?: string; observacoes?: boolean }) {
  const db = useDB();
  const cli = db.clientes.find((c) => (f.cliente_id ? c.id === f.cliente_id : semAcento(c.nome) === semAcento(f.cliente.trim())));
  const casos = db.casos.filter((c) => (cli ? c.cliente_id === cli.id : false));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Rotulado rotulo="Cliente ou interessado" className="sm:col-span-2">
        <CampoCliente valor={f.cliente} readOnly={!!clienteId} aoMudar={(nome, id) => setF({ ...f, cliente: nome, cliente_id: id ?? "", caso_id: "" })} />
      </Rotulado>
      {casos.length > 0 && <Rotulado rotulo="Caso (opcional)" className="sm:col-span-2"><select className="inp" value={f.caso_id} onChange={(e) => setF({ ...f, caso_id: e.target.value })}><option value="">Nenhum</option>{casos.map((c) => <option key={c.id} value={c.id}>{c.titulo}{c.numero ? ` · ${c.numero}` : ""}</option>)}</select></Rotulado>}
      <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
      <Rotulado rotulo="Hora"><input type="time" className="inp" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Rotulado>
      <Rotulado rotulo="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Atendimento["tipo"] })}>{TIPOS_ATENDIMENTO.map((t) => <option key={t}>{t}</option>)}</select></Rotulado>
      <Rotulado rotulo="Duração prevista (min)"><input type="number" className="inp" value={f.duracao} onChange={(e) => setF({ ...f, duracao: Number(e.target.value) })} /></Rotulado>
      <Rotulado rotulo="Valor da consulta (R$)"><input type="number" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Rotulado>
      <Rotulado rotulo="Quem atende"><select className="inp" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}><option value="">{db.equipe[0]?.nome ?? "Escolher"}</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Rotulado>
      {observacoes && <Rotulado rotulo="Observações" className="sm:col-span-2"><textarea className="inp min-h-24" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Rotulado>}
    </div>
  );
}

/**
 * "agora": leva à página de atendimento (sem janela). Com `clienteId`, o cliente já vem escolhido.
 * "agendar": janela rápida para marcar uma data futura.
 */
export function NovoAtendimento({ modo, clienteId, classe, rotulo }: { modo: "agora" | "agendar"; clienteId?: string; classe?: string; rotulo?: string }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(() => formVazio(db, clienteId));
  if (modo === "agora") {
    return <Link href={clienteId ? `/atendimentos/novo?cliente=${clienteId}` : "/atendimentos/novo"} className={classe ?? "btn btn-p"}><Play />{rotulo ?? "Iniciar atendimento"}</Link>;
  }
  function salvar() { if (!f.cliente.trim() || !f.data) return; criarAtendimento(db, f, f.notas); setAberto(false); }
  return (
    <>
      <button className={classe ?? "btn btn-p"} onClick={() => { setF(formVazio(db, clienteId)); setAberto(true); }}><Plus />{rotulo ?? "Agendar"}</button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Agendar atendimento"
        rodape={<><button className="btn btn-g" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-p" disabled={!f.cliente.trim() || !f.data} onClick={salvar}>Agendar</button></>}>
        <CamposAtendimento f={f} setF={setF} clienteId={clienteId} observacoes />
      </Dialogo>
    </>
  );
}
