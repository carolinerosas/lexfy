"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { alterar, areaParaTipoAntigo, excluir, incluir, useDB } from "@/novo/lib/store";
import { PecasPanel } from "@/components/ui/pecas-panel";
import { AutosPanel } from "@/components/ui/autos-panel";
import { areaDe } from "@/novo/lib/areas";
import { brl, data, diasAte, hojeISO, hora, horas, quando } from "@/novo/lib/format";
import { Azulejo, estiloTinta } from "@/novo/components/azulejo";
import { Abas, Avatar, CampoArea, Rotulado, Vazio, valorCampo, useMapas } from "@/novo/components/ui";
import type { Caso, Custa } from "@/novo/lib/types";
import { Cobrar, NovoHonorario } from "@/novo/components/honorario";
import { BotaoNovo } from "@/novo/components/form-rapido";

type Aba = "ficha" | "andamentos" | "prazos" | "financeiro" | "trabalho" | "pecas" | "autos" | "referencia";

export default function PaginaCaso() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const { pessoa } = useMapas(db);
  const [aba, setAba] = useState<Aba>("ficha");
  const caso = db.casos.find((c) => c.id === id);
  if (!caso) return <div className="painel"><Vazio titulo="Caso não encontrado">Ele pode ter sido excluído. <Link className="font-semibold text-cobalto underline" href="/processos">Voltar para os processos</Link></Vazio></div>;

  const area = areaDe(caso.area);
  const andamentos = db.andamentos.filter((a) => a.caso_id === id).sort((a, b) => b.data.localeCompare(a.data));
  const prazos = db.prazos.filter((p) => p.caso_id === id).sort((a, b) => a.data.localeCompare(b.data));
  const audiencias = db.audiencias.filter((a) => a.caso_id === id).sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  const honorarios = db.honorarios.filter((h) => h.caso_id === id).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const custas = db.custas.filter((k) => k.caso_id === id);
  const tarefas = db.tarefas.filter((t) => t.caso_id === id);
  const anotacoes = db.anotacoes.filter((n) => n.caso_id === id);
  const tempo = db.horas.filter((h) => h.caso_id === id);
  const voltar = caso.natureza === "judicial" ? "/processos" : "/extrajudicial";

  return (
    <div style={estiloTinta(area.tinta)}>
      <Link href={voltar} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-cobalto"><ChevronLeft className="size-4" />{caso.natureza === "judicial" ? "Processos" : "Extrajudicial"}</Link>

      <header className="painel overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
          <Azulejo area={area} tamanho={56} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <Link href={`/areas/${area.id}`} className="tag tag-tinta hover:underline">{area.nome}</Link>
              <span className="tag">{caso.natureza === "judicial" ? "Judicial" : "Extrajudicial"}</span>
              {caso.status !== "ativo" && <span className="tag tag-alerta">{caso.status}</span>}
              {typeof caso.dados.situacao === "string" && /pris/i.test(caso.dados.situacao) && <span className="tag tag-perigo">Cliente preso</span>}
            </p>
            <h1 className="titulo mt-2 text-[28px]">{caso.titulo}</h1>
            <p className="mt-1 text-ink-2">
              <Link href={`/clientes/${caso.cliente_id}`} className="font-semibold text-ink hover:text-cobalto hover:underline">{caso.cliente_nome}</Link>
              {caso.parte_contraria && <> <span className="text-ink-3">×</span> {caso.parte_contraria}</>}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-3">{[caso.numero || (caso.natureza === "judicial" ? "Ainda sem número" : null), caso.orgao, caso.comarca && `${caso.comarca}/${caso.uf ?? ""}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/documentos?caso=${caso.id}`} className="btn btn-g">Gerar documento</Link>
            <Avatar pessoa={pessoa(caso.responsavel_id)} tamanho={30} />
            <select className="inp w-auto" aria-label="Situação do caso" value={caso.status} onChange={(e) => alterar("casos", caso.id, { status: e.target.value as Caso["status"] })}>
              <option value="ativo">Em andamento</option><option value="suspenso">Suspenso</option><option value="arquivado">Arquivado</option><option value="encerrado">Encerrado</option>
            </select>
          </div>
        </div>
        <ol className="flex gap-px overflow-x-auto border-t border-line-2 bg-line-2" aria-label="Fases do caso">
          {area.fases.map((f, i) => (
            <li key={f} className="min-w-[104px] flex-1">
              <button onClick={() => alterar("casos", caso.id, { fase: i })} aria-current={i === caso.fase ? "step" : undefined} title={`Mover para: ${f}`}
                className={`flex h-full w-full flex-col gap-1 px-2.5 py-2 text-left text-[12px] leading-tight transition-colors ${i === caso.fase ? "bg-ink font-bold text-white" : i < caso.fase ? "bg-surface text-ink-2 hover:bg-porcelana" : "bg-porcelana text-ink-3 hover:bg-surface"}`}>
                <span className="h-1 w-full rounded-full" style={{ background: i === caso.fase ? "var(--color-ocre-v)" : i < caso.fase ? "#0a0a0a" : "var(--color-line)" }} />
                {f}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="mt-4">
        <Abas valor={aba} aoMudar={setAba} abas={[["ficha", `Ficha de ${area.nome}`], ["andamentos", `Andamentos (${andamentos.length})`], ["prazos", `Prazos e audiências (${prazos.filter((p) => !p.concluido).length + audiencias.filter((a) => !a.realizada).length})`], ["financeiro", "Financeiro"], ["trabalho", "Tarefas e anotações"], ["pecas", "Peças com IA"], ["autos", "Autos"], ["referencia", "Prazos da área"]] as const} />
      </div>

      <div className="mt-4">
        {aba === "ficha" && <Ficha caso={caso} />}

        {aba === "andamentos" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="painel">
              {andamentos.length === 0 ? <Vazio titulo="Sem andamentos">Registre o primeiro ao lado. Os que vierem do tribunal aparecem aqui marcados como novos.</Vazio> : (
                <ol>{andamentos.map((a) => (
                  <li key={a.id} className={`flex items-start gap-3 border-b border-line-2 px-4 py-3 last:border-0 ${a.lido ? "" : "nao-lido"}`}>
                    <span className="w-[76px] shrink-0 text-[12.5px] text-ink-3">{data(a.data)}</span>
                    <div className="min-w-0 flex-1">
                      <p>{a.descricao}</p>
                      {a.texto_cliente && <p className="mt-1 border-l-2 border-line pl-2 text-[13px] text-ink-2">Para o cliente: {a.texto_cliente}</p>}
                      <p className="mt-0.5 text-[12px] text-ink-3">Fonte: {a.fonte}</p>
                    </div>
                    {!a.lido && <button className="btn btn-g btn-sm" onClick={() => alterar("andamentos", a.id, { lido: true })}>Marcar lido</button>}
                    <button className="btn btn-perigo btn-icone btn-sm" aria-label="Excluir andamento" onClick={() => excluir("andamentos", a.id)}><Trash2 /></button>
                  </li>
                ))}</ol>
              )}
            </section>
            <NovoAndamento casoId={caso.id} />
          </div>
        )}

        {aba === "prazos" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="painel">
                <div className="painel-cab"><h2>Prazos</h2></div>
                {prazos.length === 0 ? <Vazio titulo="Nenhum prazo lançado" /> : (
                  <ul>{prazos.map((p) => {
                    const n = diasAte(p.data);
                    return (
                      <li key={p.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                        <button className={`btn btn-icone btn-sm ${p.concluido ? "btn-p" : "btn-g"}`} aria-label={p.concluido ? "Reabrir prazo" : "Marcar como cumprido"} onClick={() => alterar("prazos", p.id, { concluido: !p.concluido })}><Check /></button>
                        <div className={`min-w-0 flex-1 ${p.concluido ? "text-ink-3 line-through" : ""}`}><span className="font-semibold">{p.titulo}</span>{p.base && <span className="block text-[12.5px] text-ink-3">{p.base}</span>}</div>
                        <span className={`tag ${p.concluido ? "tag-ok" : n < 0 ? "tag-perigo" : n <= 2 ? "tag-alerta" : ""}`}>{p.concluido ? "Cumprido" : `${data(p.data)} · ${quando(p.data)}`}</span>
                        <button className="btn btn-perigo btn-icone btn-sm" aria-label="Excluir prazo" onClick={() => excluir("prazos", p.id)}><Trash2 /></button>
                      </li>
                    );
                  })}</ul>
                )}
              </section>
              <section className="painel">
                <div className="painel-cab"><h2>Audiências e sessões</h2></div>
                {audiencias.length === 0 ? <Vazio titulo="Nenhuma audiência marcada" /> : (
                  <ul>{audiencias.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                      <span className="w-[112px] shrink-0"><span className="block font-semibold">{data(a.data_hora)}</span><span className="text-[12.5px] text-ink-3">{hora(a.data_hora)} · {a.modalidade}</span></span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{a.titulo}</span><span className="block truncate text-[12.5px] text-ink-3">{a.local}</span></span>
                      <button className={`btn btn-sm ${a.realizada ? "btn-p" : "btn-g"}`} onClick={() => alterar("audiencias", a.id, { realizada: !a.realizada })}>{a.realizada ? "Realizada" : "Marcar realizada"}</button>
                    </li>
                  ))}</ul>
                )}
              </section>
            </div>
            <NovoPrazo caso={caso} />
          </div>
        )}

        {aba === "financeiro" && (
          <><div className="mb-3 flex flex-wrap gap-2">
            <NovoHonorario casoId={caso.id} />
            <BotaoNovo rotulo="Lançar custa ou repasse" classe="btn btn-g" aoSalvar={(v) => incluir("custas", { caso_id: caso.id, descricao: String(v.descricao), tipo: (v.tipo ?? "custas") as Custa["tipo"], valor: Number(v.valor) || 0, data: String(v.data ?? hojeISO()), reembolsavel: !!v.reembolsavel, reembolsado: false })}
              campos={[{ k: "descricao", rotulo: "Descrição", obrig: true, largo: true }, { k: "tipo", rotulo: "Tipo", tipo: "opcoes", inicial: "custas", opcoes: ["custas", "depósito recursal", "depósito judicial", "perícia", "diligência", "emolumentos", "alvará a repassar"] }, { k: "valor", rotulo: "Valor (R$)", tipo: "numero", obrig: true }, { k: "data", rotulo: "Data", tipo: "data", inicial: hojeISO() }, { k: "reembolsavel", rotulo: "O cliente reembolsa", tipo: "check", inicial: true }]} />
          </div><div className="grid gap-4 lg:grid-cols-2">
            <section className="painel overflow-x-auto">
              <div className="painel-cab"><h2>Honorários</h2><span className="text-[12.5px] text-ink-3">Recebido {brl(honorarios.filter((h) => h.status === "recebido").reduce((s, h) => s + h.valor, 0))} de {brl(honorarios.filter((h) => h.tipo !== "êxito").reduce((s, h) => s + h.valor, 0))}</span></div>
              <table className="tb"><thead><tr><th>Descrição</th><th>Vencimento</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{honorarios.map((h) => (
                  <tr key={h.id}><td>{h.descricao}<span className="block text-[12px] text-ink-3">{h.tipo}</span></td><td>{data(h.vencimento)}</td><td className="num">{brl(h.valor)}</td>
                    <td className="num">{h.status === "recebido" ? <span className="tag tag-ok">Recebido</span> : <span className="inline-flex items-center gap-1"><Cobrar honorario={h} /><button className="btn btn-g btn-sm" onClick={() => alterar("honorarios", h.id, { status: "recebido", recebido_em: hojeISO() })}>Dar baixa</button></span>}</td></tr>
                ))}</tbody></table>
            </section>
            <section className="painel overflow-x-auto">
              <div className="painel-cab"><h2>Custas, depósitos e repasses</h2></div>
              {custas.length === 0 ? <Vazio titulo="Nada lançado">Custas adiantadas pelo escritório, depósitos recursais e alvarás a repassar ficam aqui.</Vazio> : (
                <table className="tb"><thead><tr><th>Descrição</th><th>Data</th><th className="num">Valor</th><th /></tr></thead>
                  <tbody>{custas.map((k) => (
                    <tr key={k.id}><td>{k.descricao}<span className="block text-[12px] text-ink-3">{k.tipo}</span></td><td>{data(k.data)}</td><td className="num">{brl(k.valor)}</td>
                      <td className="num">{k.reembolsavel ? (k.reembolsado ? <span className="tag tag-ok">Reembolsado</span> : <button className="btn btn-g btn-sm" onClick={() => alterar("custas", k.id, { reembolsado: true })}>Cobrar reembolso</button>) : k.tipo === "alvará a repassar" ? <span className="tag tag-alerta">Repassar ao cliente</span> : null}</td></tr>
                  ))}</tbody></table>
              )}
              <p className="border-t border-line-2 px-4 py-2.5 text-[12.5px] text-ink-3">Tempo lançado neste caso: <strong className="text-ink">{horas(tempo.reduce((s, h) => s + h.minutos, 0))}</strong> ({horas(tempo.filter((h) => h.faturavel).reduce((s, h) => s + h.minutos, 0))} faturáveis).</p>
            </section>
          </div></>
        )}

        {aba === "trabalho" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="painel">
              <div className="painel-cab"><h2>Tarefas</h2></div>
              {tarefas.length === 0 && <Vazio titulo="Nenhuma tarefa neste caso" />}
              <ul>{tarefas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5">
                  <button className={`btn btn-icone btn-sm ${t.estado === "feito" ? "btn-p" : "btn-g"}`} aria-label="Concluir tarefa" onClick={() => alterar("tarefas", t.id, { estado: t.estado === "feito" ? "a fazer" : "feito" })}><Check /></button>
                  <span className={`min-w-0 flex-1 ${t.estado === "feito" ? "text-ink-3 line-through" : ""}`}>{t.titulo}</span>
                  {t.limite && <span className="text-[12.5px] text-ink-3">{data(t.limite)}</span>}<Avatar pessoa={pessoa(t.responsavel_id)} />
                </li>
              ))}</ul>
              <Rapido rotulo="Nova tarefa" aoIncluir={(titulo) => incluir("tarefas", { caso_id: caso.id, titulo, estado: "a fazer", prioridade: "media", responsavel_id: caso.responsavel_id })} />
            </section>
            <section className="painel">
              <div className="painel-cab"><h2>Anotações</h2></div>
              {anotacoes.length === 0 && <Vazio titulo="Nenhuma anotação" />}
              <ul>{anotacoes.map((n) => (
                <li key={n.id} className="border-b border-line-2 px-4 py-2.5"><p>{n.texto}</p><p className="mt-0.5 text-[12px] text-ink-3">{data(n.data)} · {pessoa(n.autor_id)?.nome}</p></li>
              ))}</ul>
              <Rapido rotulo="Nova anotação" aoIncluir={(texto) => incluir("anotacoes", { caso_id: caso.id, texto, data: hojeISO(), autor_id: caso.responsavel_id })} />
            </section>
          </div>
        )}

        {aba === "pecas" && <div className="painel p-4"><PecasPanel processoId={caso.id} tipoProcesso={areaParaTipoAntigo(caso.area)} /></div>}
        {aba === "autos" && <div className="painel p-4"><AutosPanel processoId={caso.id} /></div>}

        {aba === "referencia" && (
          <section className="painel overflow-x-auto">
            <div className="painel-cab"><h2>Prazos de referência: {area.nome}</h2></div>
            <table className="tb"><thead><tr><th>Ato</th><th>Prazo</th><th>Base legal</th></tr></thead>
              <tbody>{area.prazos.map((p) => <tr key={p.nome}><td className="font-semibold">{p.nome}</td><td>{p.prazo}</td><td className="text-ink-2">{p.base}</td></tr>)}</tbody></table>
            <p className="border-t border-line-2 px-4 py-2.5 text-[12.5px] text-ink-3">Tabela de consulta. Confira a contagem no caso concreto (dias úteis ou corridos, feriados locais, prazo em dobro).</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Ficha({ caso }: { caso: Caso }) {
  const area = areaDe(caso.area);
  const [edit, setEdit] = useState(false);
  const [dados, setDados] = useState(caso.dados);
  const [geral, setGeral] = useState({ titulo: caso.titulo, numero: caso.numero, orgao: caso.orgao ?? "", comarca: caso.comarca ?? "", parte_contraria: caso.parte_contraria ?? "", valor: caso.valor ?? "" });
  const salvar = () => { alterar("casos", caso.id, { ...geral, valor: geral.valor === "" ? undefined : Number(geral.valor), dados }); setEdit(false); };
  const preenchidos = area.secoes.flatMap((s) => s.campos).filter((c) => caso.dados[c.k] !== undefined && caso.dados[c.k] !== "").length;
  const total = area.secoes.flatMap((s) => s.campos).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        {area.secoes.map((s) => (
          <section key={s.titulo} className="painel">
            <div className="painel-cab"><h2>{s.titulo}</h2></div>
            {edit ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">{s.campos.map((c) => <CampoArea key={c.k} campo={c} valor={dados[c.k]} aoMudar={(v) => setDados({ ...dados, [c.k]: v })} />)}</div>
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {s.campos.map((c) => {
                  const v = valorCampo(c, caso.dados[c.k]);
                  return (
                    <div key={c.k} className={`border-b border-line-2 px-4 py-2.5 ${c.tipo === "l" ? "sm:col-span-2" : ""}`}>
                      <dt className="text-[12px] font-semibold text-ink-3">{c.rotulo}</dt>
                      <dd className={`whitespace-pre-line ${v ? "" : "text-ink-3"}`}>{v || "Não informado"}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        ))}
      </div>
      <aside className="space-y-4">
        <section className="painel p-4">
          <p className="text-[12.5px] text-ink-2">Ficha de {area.nome}: {preenchidos} de {total} campos preenchidos.</p>
          <div className="mt-2 h-1.5 rounded-full bg-cobalto-f"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${(preenchidos / total) * 100}%` }} /></div>
          {edit ? (
            <div className="mt-3 flex gap-2"><button className="btn btn-p flex-1" onClick={salvar}>Salvar ficha</button><button className="btn btn-g" onClick={() => { setDados(caso.dados); setEdit(false); }}>Cancelar</button></div>
          ) : <button className="btn btn-g mt-3 w-full" onClick={() => { setDados(caso.dados); setEdit(true); }}><Pencil />Editar ficha</button>}
        </section>
        <section className="painel">
          <div className="painel-cab"><h2>Dados gerais</h2></div>
          {edit ? (
            <div className="space-y-3 p-4">
              <Rotulado rotulo="Título"><input className="inp" value={geral.titulo} onChange={(e) => setGeral({ ...geral, titulo: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Número"><input className="inp" value={geral.numero} onChange={(e) => setGeral({ ...geral, numero: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Vara ou órgão"><input className="inp" value={geral.orgao} onChange={(e) => setGeral({ ...geral, orgao: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Comarca"><input className="inp" value={geral.comarca} onChange={(e) => setGeral({ ...geral, comarca: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Parte contrária"><input className="inp" value={geral.parte_contraria} onChange={(e) => setGeral({ ...geral, parte_contraria: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Valor (R$)"><input className="inp" type="number" value={geral.valor} onChange={(e) => setGeral({ ...geral, valor: e.target.value })} /></Rotulado>
            </div>
          ) : (
            <dl className="divide-y divide-line-2 text-[13.5px]">
              {([["Valor", caso.valor ? brl(caso.valor) : "—"], ["Distribuído em", data(caso.distribuido_em)], ["Cadastrado em", data(caso.criado_em)]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-3 px-4 py-2"><dt className="text-ink-3">{k}</dt><dd>{v}</dd></div>)}
              <div className="flex items-center justify-between gap-3 px-4 py-2"><dt className="text-ink-3">Chance de êxito</dt>
                <dd><select className="inp h-7 w-auto text-[13px]" aria-label="Chance de êxito" value={caso.risco ?? ""} onChange={(e) => alterar("casos", caso.id, { risco: (e.target.value || undefined) as Caso["risco"] })}><option value="">Não avaliada</option><option value="provavel">Provável</option><option value="possivel">Possível</option><option value="remoto">Remota</option></select></dd></div>
            </dl>
          )}
        </section>
      </aside>
    </div>
  );
}

function Rapido({ rotulo, aoIncluir }: { rotulo: string; aoIncluir: (texto: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { aoIncluir(t.trim()); setT(""); } }}>
      <input className="inp" placeholder={rotulo} aria-label={rotulo} value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn btn-g" disabled={!t.trim()}><Plus />Incluir</button>
    </form>
  );
}

function NovoAndamento({ casoId }: { casoId: string }) {
  const [f, setF] = useState({ data: hojeISO(), descricao: "", texto_cliente: "" });
  return (
    <form className="painel h-fit space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (!f.descricao.trim()) return; incluir("andamentos", { caso_id: casoId, data: f.data, descricao: f.descricao.trim(), texto_cliente: f.texto_cliente.trim() || undefined, fonte: "manual", lido: true }); setF({ data: hojeISO(), descricao: "", texto_cliente: "" }); }}>
      <h2 className="font-semibold">Registrar andamento</h2>
      <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
      <Rotulado rotulo="O que aconteceu"><textarea className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Rotulado>
      <Rotulado rotulo="Versão em linguagem simples para o cliente (opcional)"><textarea className="inp" value={f.texto_cliente} onChange={(e) => setF({ ...f, texto_cliente: e.target.value })} /></Rotulado>
      <button className="btn btn-p w-full" disabled={!f.descricao.trim()}>Registrar</button>
    </form>
  );
}

function NovoPrazo({ caso }: { caso: Caso }) {
  const area = areaDe(caso.area);
  const [f, setF] = useState({ titulo: "", data: "", base: "", fatal: caso.natureza === "judicial" });
  return (
    <form className="painel h-fit space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (!f.titulo.trim() || !f.data) return; incluir("prazos", { caso_id: caso.id, titulo: f.titulo.trim(), data: f.data, base: f.base || undefined, fatal: f.fatal, concluido: false, prioridade: diasAte(f.data) <= 3 ? "alta" : "media", responsavel_id: caso.responsavel_id }); setF({ titulo: "", data: "", base: "", fatal: f.fatal }); }}>
      <h2 className="font-semibold">Lançar prazo</h2>
      <Rotulado rotulo={`Prazos típicos de ${area.nome}`}>
        <select className="inp" value="" onChange={(e) => { const p = area.prazos.find((x) => x.nome === e.target.value); if (p) setF({ ...f, titulo: p.nome, base: `${p.base} (${p.prazo})` }); }}>
          <option value="">Escolher da tabela da área</option>
          {area.prazos.map((p) => <option key={p.nome} value={p.nome}>{p.nome} ({p.prazo})</option>)}
        </select>
      </Rotulado>
      <Rotulado rotulo="Prazo"><input className="inp" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Rotulado>
      <Rotulado rotulo="Vence em"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
      {f.base && <p className="text-[12.5px] text-ink-3">{f.base}</p>}
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={f.fatal} onChange={(e) => setF({ ...f, fatal: e.target.checked })} />Prazo fatal</label>
      <button className="btn btn-p w-full" disabled={!f.titulo.trim() || !f.data}>Lançar prazo</button>
      <p className="text-[12.5px] text-ink-3">Para contar dias úteis a partir da intimação, use <Link href="/ferramentas" className="font-semibold text-cobalto underline">Calculadoras</Link>.</p>
    </form>
  );
}
