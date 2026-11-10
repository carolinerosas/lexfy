"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Printer, Save, Trash2 } from "lucide-react";
import { alterar, excluir, incluir, useDB } from "@/novo/lib/store";
import { MODELOS } from "@/novo/lib/modelos";
import { data, hojeISO } from "@/novo/lib/format";
import { Cabecalho, LinkCaso, Rotulado, Vazio, useMapas } from "@/novo/components/ui";
import type { DocumentoGerado } from "@/novo/lib/types";

const PROX: Record<DocumentoGerado["assinatura"], DocumentoGerado["assinatura"] | null> = { rascunho: "enviado para assinatura", "enviado para assinatura": "assinado", assinado: null };

function imprimir(titulo: string, texto: string) {
  const j = window.open("", "_blank", "width=820,height=1000");
  if (!j) return false;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  j.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{margin:3cm 2cm 2cm 3cm}body{font:12pt/1.5 "Times New Roman",serif;color:#000;white-space:pre-wrap;text-align:justify;max-width:16cm;margin:2cm auto}</style></head><body>${esc(texto)}</body></html>`);
  j.document.close(); j.focus(); j.print();
  return true;
}

function Gerador() {
  const db = useDB();
  const { caso: casoDe } = useMapas(db);
  const params = useSearchParams();
  const [casoId, setCasoId] = useState(params.get("caso") ?? "");
  const [clienteId, setClienteId] = useState(params.get("cliente") ?? "");
  const [modeloId, setModeloId] = useState("procuracao");
  const [valor, setValor] = useState("");
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");

  const caso = casoDe(casoId);
  const cliente = db.clientes.find((c) => c.id === (caso?.cliente_id ?? clienteId));
  const modelo = MODELOS.find((m) => m.id === modeloId) ?? MODELOS[0];
  const casosDoCliente = clienteId && !casoId ? db.casos.filter((c) => c.cliente_id === clienteId) : db.casos;
  const base = useMemo(() => modelo.texto({ caso, cliente, cfg: db.config, advogado: db.equipe.find((e) => e.id === caso?.responsavel_id) ?? db.equipe[0], valor: valor ? Number(valor) : undefined }), [modelo, caso, cliente, db.config, db.equipe, valor]);
  useEffect(() => { setTexto(base); setAviso(""); }, [base]);
  const faltam = (texto.match(/\[[^\]]+\]/g) ?? []).length;
  const titulo = `${modelo.nome}: ${cliente?.nome ?? "sem cliente"}`;

  return (
    <>
      <Cabecalho titulo="Documentos" sub="Procuração, contrato de honorários e declarações preenchidos com os dados do cliente e do caso. Revise o texto antes de imprimir ou enviar para assinatura." />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Rotulado rotulo="Caso"><select className="inp" value={casoId} onChange={(e) => setCasoId(e.target.value)}><option value="">Sem caso (só o cliente)</option>{casosDoCliente.map((c) => <option key={c.id} value={c.id}>{c.cliente_nome}: {c.titulo}</option>)}</select></Rotulado>
          {!casoId && <Rotulado rotulo="Cliente"><select className="inp" value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">Escolher</option>{[...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Rotulado>}
          <fieldset>
            <legend className="rotulo">Modelo</legend>
            <ul className="space-y-1">{MODELOS.map((m) => { const indicado = caso && m.areas?.includes(caso.area); return (
              <li key={m.id}><label className={`flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-3 transition-colors ${modeloId === m.id ? "border-ink bg-porcelana" : "border-line hover:border-[#bdbdbd]"}`}>
                <input type="radio" name="modelo" className="mt-1" checked={modeloId === m.id} onChange={() => setModeloId(m.id)} />
                <span><span className="block font-semibold">{m.nome}{indicado && <span className="tag tag-info ml-2">Indicado para a área</span>}</span><span className="block text-[12.5px] text-ink-3">{m.para}</span></span>
              </label></li>
            ); })}</ul>
          </fieldset>
          {(modeloId === "contrato" || modeloId === "recibo") && <Rotulado rotulo="Valor (R$)"><input type="number" className="inp" value={valor} onChange={(e) => setValor(e.target.value)} /></Rotulado>}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`tag ${faltam ? "tag-alerta" : "tag-ok"}`}>{faltam ? `${faltam} ${faltam === 1 ? "campo" : "campos"} entre colchetes para completar` : "Sem campos pendentes"}</span>
            <span className="flex-1" />
            <button className="btn btn-g btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(texto); setAviso("Texto copiado."); } catch { setAviso("O navegador bloqueou a cópia. Selecione o texto e copie à mão."); } }}><Copy />Copiar</button>
            <button className="btn btn-g btn-sm" onClick={() => { if (!imprimir(titulo, texto)) setAviso("O navegador bloqueou a janela de impressão. Permita pop-ups para este endereço."); }}><Printer />Imprimir ou salvar em PDF</button>
            <button className="btn btn-p btn-sm" onClick={() => { incluir("documentos", { caso_id: caso?.id, cliente_nome: cliente?.nome ?? "", modelo: modelo.id, titulo, texto, criado_em: hojeISO(), assinatura: "rascunho" }); setAviso("Documento guardado na lista abaixo."); }}><Save />Guardar</button>
          </div>
          <textarea className="inp min-h-[460px] font-serif text-[14.5px] leading-relaxed" aria-label="Texto do documento" value={texto} onChange={(e) => setTexto(e.target.value)} />
          {aviso && <p role="status" className="mt-2 text-[13px] font-semibold">{aviso}</p>}
        </div>
      </div>

      <section className="painel mt-8">
        <div className="painel-cab"><h2>Documentos guardados</h2><span className="text-[12.5px] text-ink-3">{db.documentos.length}</span></div>
        {db.documentos.length === 0 ? <Vazio titulo="Nenhum documento guardado">Gere um documento acima e clique em “Guardar” para acompanhar a assinatura.</Vazio> : (
          <div className="overflow-x-auto"><table className="tb min-w-[720px]"><thead><tr><th>Documento</th><th>Caso</th><th>Criado em</th><th>Assinatura</th><th /></tr></thead>
            <tbody>{db.documentos.map((d) => (
              <tr key={d.id}><td className="font-semibold">{d.titulo}</td><td className="max-w-[260px]">{d.caso_id ? <LinkCaso caso={casoDe(d.caso_id)} /> : <span className="text-ink-3">—</span>}</td><td>{data(d.criado_em)}</td>
                <td><span className={`tag ${d.assinatura === "assinado" ? "tag-ok" : d.assinatura === "rascunho" ? "" : "tag-alerta"}`}>{d.assinatura}</span>{d.assinado_em && <span className="ml-2 text-[12.5px] text-ink-3">{data(d.assinado_em)}</span>}</td>
                <td className="num whitespace-nowrap">
                  {PROX[d.assinatura] && <button className="btn btn-g btn-sm" onClick={() => alterar("documentos", d.id, { assinatura: PROX[d.assinatura]!, assinado_em: PROX[d.assinatura] === "assinado" ? hojeISO() : undefined })}><Check />{d.assinatura === "rascunho" ? "Marcar como enviado" : "Marcar como assinado"}</button>}
                  <button className="btn btn-q btn-icone btn-sm" aria-label="Imprimir" onClick={() => imprimir(d.titulo, d.texto)}><Printer /></button>
                  <button className="btn btn-perigo btn-icone btn-sm" aria-label="Excluir documento" onClick={() => excluir("documentos", d.id)}><Trash2 /></button>
                </td></tr>
            ))}</tbody></table></div>
        )}
        <p className="border-t border-line-2 px-5 py-2.5 text-[12.5px] text-ink-3">Aqui o sistema só acompanha a situação da assinatura. O envio para assinatura eletrônica com validade jurídica depende de contratar um serviço de assinatura.</p>
      </section>
    </>
  );
}

export default function Documentos() {
  return <Suspense fallback={null}><Gerador /></Suspense>;
}
