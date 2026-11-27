"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Play } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { hojeISO, semAcento } from "@/novo/lib/format";
import { Dialogo, Rotulado } from "./ui";
import { CaixaTexto } from "./ditado";
import { CampoCliente } from "./campo-cliente";
import type { Atendimento } from "@/novo/lib/types";

export const TIPOS_ATENDIMENTO: Atendimento["tipo"][] = ["consulta inicial", "retorno", "orientação", "preparação de audiência", "visita à unidade prisional"];

const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/**
 * Botão + janela para registrar um atendimento.
 * modo "agora": confirma os dados, cria o atendimento com data e hora de agora e abre a janela grande de anotações.
 * modo "agendar": marca para uma data futura.
 * Com `clienteId`, o cliente já vem escolhido (pasta do cliente).
 */
export function NovoAtendimento({ modo, clienteId, classe, rotulo }: { modo: "agora" | "agendar"; clienteId?: string; classe?: string; rotulo?: string }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [sessao, setSessao] = useState<string | null>(null);
  const vazio = () => ({ cliente: db.clientes.find((c) => c.id === clienteId)?.nome ?? "", cliente_id: clienteId ?? "", caso_id: "", data: hojeISO(), hora: horaAgora(), tipo: TIPOS_ATENDIMENTO[0], duracao: 45, valor: "", resp: "", notas: "" });
  const [f, setF] = useState(vazio);
  const agora = modo === "agora";

  const cli = db.clientes.find((c) => (f.cliente_id ? c.id === f.cliente_id : semAcento(c.nome) === semAcento(f.cliente.trim())));
  const casos = db.casos.filter((c) => (cli ? c.cliente_id === cli.id : false));
  const temCliente = !!f.cliente.trim();

  function abrir() { setF(vazio()); setAberto(true); }
  function salvar() {
    if (!temCliente || !f.data) return;
    const nome = cli?.nome ?? f.cliente.trim();
    const clienteNovo = cli ? undefined : incluir("clientes", { nome, tipo: "pf", criado_em: hojeISO() });
    const id = incluir("atendimentos", {
      cliente_id: cli?.id ?? clienteNovo, cliente_nome: nome, caso_id: f.caso_id || undefined,
      data_hora: `${f.data}T${f.hora || "00:00"}:00`, duracao_min: Number(f.duracao) || 45, tipo: f.tipo,
      status: "agendado", responsavel_id: f.resp || db.equipe[0]?.id || "e1",
      valor: f.valor ? Number(f.valor) : undefined, notas: agora ? undefined : f.notas.trim() || undefined,
    });
    setAberto(false);
    if (agora) setSessao(id);
  }

  return (
    <>
      <button className={classe ?? "btn btn-p"} onClick={abrir}>{agora ? <Play /> : <Plus />}{rotulo ?? (agora ? "Iniciar atendimento" : "Agendar")}</button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={agora ? "Iniciar atendimento" : "Agendar atendimento"}
        rodape={<><button className="btn btn-g" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-p" disabled={!temCliente || !f.data} onClick={salvar}>{agora ? "Iniciar atendimento" : "Agendar"}</button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Cliente ou interessado" className="sm:col-span-2">
            <CampoCliente valor={f.cliente} readOnly={!!clienteId} aoMudar={(nome, id) => setF({ ...f, cliente: nome, cliente_id: id ?? "", caso_id: "" })} />
          </Rotulado>
          {casos.length > 0 && <Rotulado rotulo="Caso (opcional)" className="sm:col-span-2"><select className="inp" value={f.caso_id} onChange={(e) => setF({ ...f, caso_id: e.target.value })}><option value="">Nenhum</option>{casos.map((c) => <option key={c.id} value={c.id}>{c.titulo}{c.numero ? ` · ${c.numero}` : ""}</option>)}</select></Rotulado>}
          <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Hora"><input type="time" className="inp" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Atendimento["tipo"] })}>{TIPOS_ATENDIMENTO.map((t) => <option key={t}>{t}</option>)}</select></Rotulado>
          <Rotulado rotulo="Duração (min)"><input type="number" className="inp" value={f.duracao} onChange={(e) => setF({ ...f, duracao: Number(e.target.value) })} /></Rotulado>
          <Rotulado rotulo="Valor da consulta (R$)"><input type="number" className="inp" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Quem atende"><select className="inp" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}><option value="">{db.equipe[0]?.nome ?? "Escolher"}</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Rotulado>
          {!agora && <Rotulado rotulo="Observações" className="sm:col-span-2"><textarea className="inp min-h-24" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Rotulado>}
        </div>
      </Dialogo>
      {sessao && <SessaoAtendimento id={sessao} aoFechar={() => setSessao(null)} />}
    </>
  );
}

/** Janela grande para escrever o que acontece no atendimento. Salva sozinha enquanto digita. */
export function SessaoAtendimento({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const db = useDB();
  const a = db.atendimentos.find((x) => x.id === id);
  const [texto, setTexto] = useState(a?.notas ?? "");
  const [salvo, setSalvo] = useState(true);
  const inicio = useRef(0);
  useEffect(() => { inicio.current = Date.now(); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimo = useRef(texto);

  function gravar(valor: string) { if (timer.current) clearTimeout(timer.current); timer.current = null; alterar("atendimentos", id, { notas: valor.trim() || undefined }); ultimo.current = valor; setSalvo(true); }
  function mudar(v: string) { setTexto(v); setSalvo(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => gravar(v), 700); }
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); alterar("atendimentos", id, { notas: ultimo.current.trim() || undefined }); } }, [id]);
  useEffect(() => { ultimo.current = texto; }, [texto]);

  if (!a) return null;
  const fechar = () => { gravar(texto); aoFechar(); };
  function finalizar() {
    const minutos = Math.max(1, Math.round((Date.now() - inicio.current) / 60000));
    alterar("atendimentos", id, { notas: texto.trim() || undefined, status: "realizado", duracao_min: Math.max(minutos, 1) });
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    ultimo.current = texto;
    aoFechar();
  }
  function cancelar() { alterar("atendimentos", id, { status: "cancelado" }); aoFechar(); }

  return (
    <Dialogo aberto aoFechar={fechar} titulo={`Atendimento: ${a.cliente_nome}`} largo
      rodape={<>
        <span role="status" className="mr-auto self-center text-[13px] text-ink-3">{salvo ? "Anotações salvas." : "Salvando…"}</span>
        <button className="btn btn-perigo" onClick={cancelar}>Cancelar atendimento</button>
        <button className="btn btn-g" onClick={fechar}>Continuar depois</button>
        <button className="btn btn-p" onClick={finalizar}>Finalizar atendimento</button>
      </>}>
      <p className="mb-3 text-[13px] text-ink-3">{a.tipo} · {a.duracao_min} min previstos</p>
      <CaixaTexto className="inp min-h-[55vh] w-full" value={texto} aoMudar={mudar} placeholder="Escreva aqui o que está acontecendo no atendimento: relato do cliente, orientações, combinados, próximos passos." />
    </Dialogo>
  );
}
