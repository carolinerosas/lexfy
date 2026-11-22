"use client";
// Orçamento para casos ainda não iniciados (processo não proposto) e para contatos da captação.
import { useState } from "react";
import { CaixaTexto } from "@/novo/components/ditado";
import { addMonths, format } from "date-fns";
import { Check, FileText, MessageCircle, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { brl, data, hojeISO, iso, uid } from "@/novo/lib/format";
import { linkWhatsApp } from "@/novo/lib/whatsapp";
import type { Caso, Orcamento } from "@/novo/lib/types";
import { lancarParcelas } from "./honorario";
import { CampoLista, Copiar, Dialogo, Rotulado, Vazio } from "./ui";

export const totalOrcamento = (o: Orcamento) => o.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
const NOME_STATUS: Record<Orcamento["status"], string> = { rascunho: "Rascunho", enviado: "Enviado", aceito: "Aceito", recusado: "Recusado" };

export function novoOrcamento(acoes: string[] = []): Orcamento {
  return {
    id: uid(), criado_em: hojeISO(), acoes, itens: acoes.length ? acoes.map((a) => ({ id: uid(), descricao: a, valor: 0 })) : [{ id: uid(), descricao: "Honorários", valor: 0 }],
    parcelas: 1, primeiro_vencimento: iso(addMonths(new Date(), 1)), validade: iso(addMonths(new Date(), 1)).slice(0, 10), status: "rascunho",
  };
}

/** Parcelas do restante depois da entrada. */
function condicoes(o: Orcamento): string[] {
  const total = totalOrcamento(o);
  const entrada = Math.min(total, o.entrada || 0);
  const n = Math.max(1, o.parcelas || 1);
  const resto = total - entrada;
  const l: string[] = [];
  if (entrada > 0) l.push(`Entrada de ${brl(entrada)}`);
  if (resto > 0) {
    if (n === 1) l.push(`${entrada > 0 ? "Saldo" : "Pagamento"} de ${brl(resto)}${o.primeiro_vencimento ? ` em ${data(o.primeiro_vencimento)}` : ""}`);
    else l.push(`${entrada > 0 ? "Saldo em" : "Em"} ${n} parcelas mensais de ${brl(resto / n)}${o.primeiro_vencimento ? `, a primeira em ${data(o.primeiro_vencimento)}` : ""}`);
  }
  return l;
}

/** Texto do orçamento, para copiar, mandar no WhatsApp ou imprimir. */
export function textoOrcamento(o: Orcamento, quem: { cliente: string; escritorio: string; responsavel?: string }): string {
  const l = [`ORÇAMENTO DE HONORÁRIOS`, ``, `Cliente: ${quem.cliente}`, `Data: ${data(o.criado_em)}`];
  if (o.acoes.length) l.push(``, `Serviço${o.acoes.length > 1 ? "s" : ""}:`, ...o.acoes.map((a) => `• ${a}`));
  l.push(``, `Valores:`, ...o.itens.filter((i) => i.descricao || i.valor).map((i) => `• ${i.descricao}: ${brl(i.valor)}`), `Total: ${brl(totalOrcamento(o))}`);
  const c = condicoes(o);
  if (c.length) l.push(``, `Forma de pagamento:`, ...c.map((x) => `• ${x}`));
  if (o.exito) l.push(``, `Honorários de êxito: ${o.exito}`);
  if (o.observacoes) l.push(``, o.observacoes);
  l.push(``, `Custas, taxas e despesas do processo não estão incluídas.`);
  if (o.validade) l.push(`Proposta válida até ${data(o.validade)}.`);
  l.push(``, quem.responsavel ? `${quem.responsavel} · ${quem.escritorio}` : quem.escritorio);
  return l.join("\n");
}

function imprimir(texto: string, titulo: string) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font:15px/1.6 Georgia,serif;color:#111;max-width:640px;margin:48px auto;padding:0 24px}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>${esc(texto)}</pre><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

/** Janela de edição do orçamento. */
export function EditorOrcamento({ aberto, aoFechar, inicial, aoSalvar }: { aberto: boolean; aoFechar: () => void; inicial: Orcamento; aoSalvar: (o: Orcamento) => void }) {
  const [o, setO] = useState<Orcamento>(inicial);
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (aberto !== abertoAntes) { setAbertoAntes(aberto); if (aberto) setO(inicial); }
  const muda = (m: Partial<Orcamento>) => setO({ ...o, ...m });
  const num = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Orçamento" largo
      rodape={<><span className="mr-auto self-center font-semibold">Total {brl(totalOrcamento(o))}</span><button className="btn btn-g" onClick={aoFechar}>Cancelar</button><button className="btn btn-p" onClick={() => { aoSalvar(o); aoFechar(); }}>Salvar orçamento</button></>}>
      <div className="space-y-4">
        <div>
          <span className="rotulo">Tipos de ação ou serviços</span>
          <CampoLista valor={o.acoes.join("\n")} aoMudar={(v) => muda({ acoes: v.split("\n").filter(Boolean) })} rotulo="Tipos de ação" lista="acoes" />
        </div>
        <div>
          <span className="rotulo">Valores</span>
          <ul className="space-y-2">{o.itens.map((it, n) => (
            <li key={it.id} className="flex gap-2">
              <input className="inp" placeholder="Descrição" aria-label="Descrição do item" value={it.descricao} onChange={(e) => muda({ itens: o.itens.map((x, k) => (k === n ? { ...x, descricao: e.target.value } : x)) })} />
              <input className="inp w-32 shrink-0" type="number" step="0.01" placeholder="R$" aria-label="Valor do item" value={it.valor || ""} onChange={(e) => muda({ itens: o.itens.map((x, k) => (k === n ? { ...x, valor: Number(e.target.value) || 0 } : x)) })} />
              <button type="button" className="btn btn-q btn-icone shrink-0" aria-label="Tirar item" onClick={() => muda({ itens: o.itens.filter((_, k) => k !== n) })}><X /></button>
            </li>
          ))}</ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-g btn-sm" onClick={() => muda({ itens: [...o.itens, { id: uid(), descricao: "", valor: 0 }] })}><Plus />Incluir item</button>
            {o.acoes.filter((a) => !o.itens.some((i) => i.descricao === a)).map((a) => <button key={a} type="button" className="btn btn-q btn-sm" onClick={() => muda({ itens: [...o.itens, { id: uid(), descricao: a, valor: 0 }] })}><Plus />{a}</button>)}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Entrada (R$)"><input className="inp" type="number" step="0.01" value={o.entrada ?? ""} onChange={(e) => muda({ entrada: num(e.target.value) })} /></Rotulado>
          <Rotulado rotulo="Parcelas do restante"><input className="inp" type="number" min={1} value={o.parcelas ?? ""} onChange={(e) => muda({ parcelas: num(e.target.value) })} /></Rotulado>
          <Rotulado rotulo="Vencimento da primeira parcela"><input className="inp" type="date" value={o.primeiro_vencimento ?? ""} onChange={(e) => muda({ primeiro_vencimento: e.target.value || undefined })} /></Rotulado>
          <Rotulado rotulo="Proposta válida até"><input className="inp" type="date" value={o.validade ?? ""} onChange={(e) => muda({ validade: e.target.value || undefined })} /></Rotulado>
          <Rotulado rotulo="Honorários de êxito (se houver)" className="sm:col-span-2"><input className="inp" placeholder="Ex.: 20% do proveito econômico" value={o.exito ?? ""} onChange={(e) => muda({ exito: e.target.value || undefined })} /></Rotulado>
          <Rotulado rotulo="Observações" className="sm:col-span-2"><CaixaTexto rows={3} value={o.observacoes ?? ""} aoMudar={(t) => muda({ observacoes: t || undefined })} /></Rotulado>
        </div>
        {condicoes(o).length > 0 && <p className="rounded-[10px] bg-porcelana px-3 py-2 text-[13px] text-ink-2">{condicoes(o).join(" · ")}</p>}
      </div>
    </Dialogo>
  );
}

/** Um orçamento em cartão, com ações de enviar, imprimir, aceitar e recusar. */
export function CartaoOrcamento({ o, cliente, celular, aoMudar, aoExcluir, aoAceitar }: {
  o: Orcamento; cliente: string; celular?: string; aoMudar: (o: Orcamento) => void; aoExcluir: () => void; aoAceitar?: () => void;
}) {
  const db = useDB();
  const [editar, setEditar] = useState(false);
  const texto = textoOrcamento(o, { cliente, escritorio: db.config.escritorio, responsavel: db.config.responsavel });
  return (
    <div className="rounded-[12px] border border-line p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{brl(totalOrcamento(o))}<span className={`tag ml-2 ${o.status === "aceito" ? "tag-ok" : o.status === "recusado" ? "tag-perigo" : o.status === "enviado" ? "tag-alerta" : ""}`}>{NOME_STATUS[o.status]}</span></p>
          <p className="break-words text-[13px] text-ink-2">{o.acoes.join(" · ") || "Sem tipo de ação"}</p>
          <p className="text-[12.5px] text-ink-3">{condicoes(o).join(" · ")}{o.validade ? ` · válido até ${data(o.validade)}` : ""}</p>
        </div>
        <span className="flex shrink-0 items-center">
          <button className="btn btn-q btn-icone btn-sm" aria-label="Editar orçamento" title="Editar" onClick={() => setEditar(true)}><Pencil /></button>
          <button className="btn btn-perigo btn-icone btn-sm" aria-label="Excluir orçamento" title="Excluir" onClick={() => { if (window.confirm("Excluir este orçamento?")) aoExcluir(); }}><Trash2 /></button>
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <a className="btn btn-g btn-sm" href={linkWhatsApp(texto, celular)} target="_blank" rel="noreferrer" onClick={() => { if (o.status === "rascunho") aoMudar({ ...o, status: "enviado" }); }}><MessageCircle />WhatsApp</a>
        <Copiar texto={texto} rotulo="Copiar texto" comTexto />
        <button className="btn btn-g btn-sm" onClick={() => imprimir(texto, `Orçamento ${cliente}`)}><Printer />Imprimir ou PDF</button>
        {o.status !== "aceito" && aoAceitar && <button className="btn btn-p btn-sm" onClick={aoAceitar}><Check />Cliente aceitou</button>}
        {o.status !== "aceito" && o.status !== "recusado" && <button className="btn btn-q btn-sm" onClick={() => aoMudar({ ...o, status: "recusado" })}>Recusou</button>}
      </div>
      <EditorOrcamento aberto={editar} aoFechar={() => setEditar(false)} inicial={o} aoSalvar={aoMudar} />
    </div>
  );
}

/** Lança os honorários do orçamento aceito: entrada e parcelas mensais. */
export function lancarOrcamento(casoId: string, o: Orcamento) {
  const total = totalOrcamento(o);
  if (total <= 0) return;
  lancarParcelas({ casoId, descricao: `Honorários contratuais${o.acoes.length ? ` (${o.acoes.join(", ")})` : ""}`, total, entrada: o.entrada, parcelas: o.parcelas, vencimento: o.primeiro_vencimento || format(addMonths(new Date(), 1), "yyyy-MM-dd"), tipo: "contratual" });
}

/** Orçamentos de um caso (pensado para casos ainda não iniciados). */
export function Orcamentos({ caso }: { caso: Caso }) {
  const db = useDB();
  const [novo, setNovo] = useState(false);
  const lista = caso.orcamentos ?? [];
  const cliente = db.clientes.find((c) => c.id === caso.cliente_id);
  const gravar = (l: Orcamento[]) => alterar("casos", caso.id, { orcamentos: l });
  const tipos = String(caso.dados.tipo_caso ?? "").split("\n").filter(Boolean);
  return (
    <section className="painel">
      <div className="painel-cab"><h2>Orçamentos</h2><button className="btn btn-g btn-sm" onClick={() => setNovo(true)}><FileText />Novo orçamento</button></div>
      {lista.length === 0 ? <Vazio titulo="Nenhum orçamento">Monte a proposta de honorários antes de propor a ação. Quando o cliente aceitar, a entrada e as parcelas viram honorários do caso.</Vazio> : (
        <div className="space-y-2 p-3">{lista.map((o) => (
          <CartaoOrcamento key={o.id} o={o} cliente={caso.cliente_nome} celular={cliente?.celular}
            aoMudar={(x) => gravar(lista.map((y) => (y.id === o.id ? x : y)))}
            aoExcluir={() => gravar(lista.filter((y) => y.id !== o.id))}
            aoAceitar={() => {
              if (!window.confirm(`Lançar ${brl(totalOrcamento(o))} em honorários deste caso (entrada e parcelas)?`)) return;
              lancarOrcamento(caso.id, o);
              gravar(lista.map((y) => (y.id === o.id ? { ...y, status: "aceito", aceito_em: hojeISO() } : y)));
            }} />
        ))}</div>
      )}
      <EditorOrcamento aberto={novo} aoFechar={() => setNovo(false)} inicial={novoOrcamento(tipos)} aoSalvar={(o) => gravar([o, ...lista])} />
    </section>
  );
}
