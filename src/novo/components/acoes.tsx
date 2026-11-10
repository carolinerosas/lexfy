"use client";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { alterar } from "@/novo/lib/store";
import { data, hojeISO } from "@/novo/lib/format";
import { FormRapido, type CampoF, type Valores } from "./form-rapido";
import type { Caso, DocPendente } from "@/novo/lib/types";

/** Lápis e lixeira de uma linha: edita em janela e exclui com confirmação. */
export function Acoes({ oQue, campos, inicial, aoSalvar, aoExcluir }: {
  oQue: string; campos?: readonly CampoF[]; inicial?: Valores; aoSalvar?: (v: Valores) => void; aoExcluir?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="inline-flex shrink-0 items-center">
      {campos && aoSalvar && <>
        <button className="btn btn-q btn-icone btn-sm" aria-label={`Editar ${oQue}`} title="Editar" onClick={() => setAberto(true)}><Pencil /></button>
        <FormRapido aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Editar ${oQue}`} campos={campos} inicial={inicial} aoSalvar={aoSalvar} />
      </>}
      {aoExcluir && <button className="btn btn-perigo btn-icone btn-sm" aria-label={`Excluir ${oQue}`} title="Excluir" onClick={() => { if (window.confirm(`Excluir ${oQue}? Isso não pode ser desfeito.`)) aoExcluir(); }}><Trash2 /></button>}
    </span>
  );
}

const SUGESTOES = ["RG e CPF", "Comprovante de residência", "Procuração assinada", "Contrato de honorários assinado", "Declaração de hipossuficiência", "Certidão de casamento ou nascimento", "Comprovante de renda", "Carteira de trabalho", "Laudos e exames médicos", "Boletim de ocorrência", "Matrícula do imóvel", "Extratos bancários"];

/** Documentos que o cliente ainda precisa entregar para o caso andar. */
export function DocsPendentes({ caso }: { caso: Caso }) {
  const [novo, setNovo] = useState("");
  const docs = caso.docs_pendentes ?? [];
  const gravar = (lista: DocPendente[]) => alterar("casos", caso.id, { docs_pendentes: lista });
  const incluir = (nome: string) => { const n = nome.trim(); if (n && !docs.some((d) => d.nome.toLowerCase() === n.toLowerCase())) gravar([...docs, { id: crypto.randomUUID(), nome: n, pedido_em: hojeISO(), recebido: false }]); };
  const faltam = docs.filter((d) => !d.recebido);
  const livres = SUGESTOES.filter((s) => !docs.some((d) => d.nome === s));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="painel">
        <div className="painel-cab"><h2>Documentos pendentes</h2><span className={`tag ${faltam.length ? "tag-alerta" : docs.length ? "tag-ok" : ""}`}>{docs.length === 0 ? "Nenhum pedido" : faltam.length ? `${faltam.length} a receber` : "Tudo recebido"}</span></div>
        {docs.length === 0 && <p className="px-5 py-8 text-center text-ink-2">Liste aqui o que o cliente ainda precisa entregar. Cada item fica pendente até você marcar como recebido.</p>}
        <ul>{[...faltam, ...docs.filter((d) => d.recebido)].map((d) => (
          <li key={d.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
            <button className={`btn btn-icone btn-sm ${d.recebido ? "btn-p" : "btn-g"}`} aria-label={d.recebido ? `Voltar ${d.nome} para pendente` : `Marcar ${d.nome} como recebido`} title={d.recebido ? "Voltar para pendente" : "Marcar como recebido"}
              onClick={() => gravar(docs.map((x) => (x.id === d.id ? { ...x, recebido: !x.recebido, recebido_em: !x.recebido ? hojeISO() : undefined } : x)))}><Check /></button>
            <span className={`min-w-0 flex-1 ${d.recebido ? "text-ink-3 line-through" : "font-semibold"}`}>{d.nome}{d.obs && <span className="block text-[12.5px] font-normal text-ink-3 no-underline">{d.obs}</span>}</span>
            <span className="whitespace-nowrap text-[12.5px] text-ink-3">{d.recebido ? `recebido em ${data(d.recebido_em)}` : `pedido em ${data(d.pedido_em)}`}</span>
            <Acoes oQue="o documento" campos={[{ k: "nome", rotulo: "Documento", obrig: true, largo: true }, { k: "obs", rotulo: "Observação", largo: true }]} inicial={{ nome: d.nome, obs: d.obs ?? "" }}
              aoSalvar={(v) => gravar(docs.map((x) => (x.id === d.id ? { ...x, nome: String(v.nome), obs: v.obs ? String(v.obs) : undefined } : x)))}
              aoExcluir={() => gravar(docs.filter((x) => x.id !== d.id))} />
          </li>
        ))}</ul>
        <form className="flex gap-2 border-t border-line-2 p-3" onSubmit={(e) => { e.preventDefault(); incluir(novo); setNovo(""); }}>
          <input className="inp" placeholder="Outro documento" aria-label="Documento a pedir" value={novo} onChange={(e) => setNovo(e.target.value)} />
          <button className="btn btn-g" disabled={!novo.trim()}><Plus />Incluir</button>
        </form>
      </section>
      <aside className="painel h-fit p-4">
        <h3 className="text-[13px] font-semibold">Pedidos comuns</h3>
        <p className="mt-1 text-[12.5px] text-ink-3">Clique para incluir na lista.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{livres.map((s) => <button key={s} className="btn btn-g btn-sm" onClick={() => incluir(s)}><Plus />{s}</button>)}</div>
      </aside>
    </div>
  );
}
