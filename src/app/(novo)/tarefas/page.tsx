"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { dataCurta, diasAte } from "@/novo/lib/format";
import { Avatar, Cabecalho, TagArea, useMapas } from "@/novo/components/ui";
import type { Tarefa } from "@/novo/lib/types";

const COLUNAS: Tarefa["estado"][] = ["a fazer", "fazendo", "feito"];
const NOME = { "a fazer": "A fazer", fazendo: "Em andamento", feito: "Concluídas" } as const;

export default function Tarefas() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [resp, setResp] = useState("");
  const [nova, setNova] = useState("");
  const [quem, setQuem] = useState("");
  const lista = db.tarefas.filter((t) => !resp || t.responsavel_id === resp);
  const mover = (t: Tarefa, d: 1 | -1) => alterar("tarefas", t.id, { estado: COLUNAS[COLUNAS.indexOf(t.estado) + d] });

  return (
    <>
      <Cabecalho titulo="Tarefas" sub="Trabalho interno do escritório, por responsável. Prazos processuais ficam em Prazos.">
        <select className="inp w-auto" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável"><option value="">Toda a equipe</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
      </Cabecalho>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!nova.trim()) return; incluir("tarefas", { titulo: nova.trim(), estado: "a fazer", prioridade: "media", responsavel_id: quem || resp || db.equipe[0].id }); setNova(""); }}>
        <input className="inp min-w-[220px] flex-1 sm:max-w-[420px]" placeholder="Nova tarefa" aria-label="Nova tarefa" value={nova} onChange={(e) => setNova(e.target.value)} />
        <select className="inp w-auto" value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Atribuir a"><option value="">Atribuir a…</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
        <button className="btn btn-p" disabled={!nova.trim()}><Plus />Incluir</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUNAS.map((col, ci) => {
          const itens = lista.filter((t) => t.estado === col).sort((a, b) => (a.limite ?? "9").localeCompare(b.limite ?? "9"));
          return (
            <section key={col} className="rounded-[16px] bg-porcelana">
              <h2 className="flex items-center justify-between px-4 pb-1 pt-3.5 text-[13.5px] font-semibold">{NOME[col]}<span className="tag bg-white">{itens.length}</span></h2>
              <ul className="space-y-2 p-2">
                {itens.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-ink-3">{col === "feito" ? "Nada concluído ainda." : "Sem tarefas nesta coluna."}</li>}
                {itens.map((t) => {
                  const c = caso(t.caso_id); const n = t.limite ? diasAte(t.limite) : null;
                  return (
                    <li key={t.id} className="rounded-[12px] border border-line bg-surface p-3.5">
                      <p className={`font-semibold ${col === "feito" ? "text-ink-3 line-through" : ""}`}>{t.titulo}</p>
                      {c && <Link href={`/casos/${c.id}`} className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-cobalto"><TagArea id={c.area} curto /><span className="truncate">{c.cliente_nome}</span></Link>}
                      <div className="mt-2 flex items-center gap-2">
                        <Avatar pessoa={pessoa(t.responsavel_id)} tamanho={22} />
                        {t.prioridade === "alta" && col !== "feito" && <span className="tag tag-perigo">Urgente</span>}
                        {t.limite && <span className={`text-[12.5px] ${n !== null && n < 0 && col !== "feito" ? "font-semibold text-perigo" : "text-ink-3"}`}>{dataCurta(t.limite)}</span>}
                        <span className="ml-auto flex gap-1">
                          {ci > 0 && <button className="btn btn-g btn-icone btn-sm" aria-label={`Voltar para ${NOME[COLUNAS[ci - 1]]}`} onClick={() => mover(t, -1)}><ArrowLeft /></button>}
                          {ci < 2 && <button className="btn btn-g btn-icone btn-sm" aria-label={`Mover para ${NOME[COLUNAS[ci + 1]]}`} onClick={() => mover(t, 1)}><ArrowRight /></button>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
