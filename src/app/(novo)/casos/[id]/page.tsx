"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { alterar, areaParaTipoAntigo, excluir, incluir, useDB } from "@/novo/lib/store";
import { PecasPanel } from "@/components/ui/pecas-panel";
import { AutosPanel } from "@/components/ui/autos-panel";
import { areaDe, secaoVisivel, SUGESTOES_FIXAS, tipoDoCaso } from "@/novo/lib/areas";
import { brl, data, diasAte, hojeISO, hora, horas, quando } from "@/novo/lib/format";
import { Azulejo, estiloTinta } from "@/novo/components/azulejo";
import { Abas, Avatar, CampoArea, Copiar, Rotulado, Vazio, itensDe, valorCampo, valoresUsados, useMapas } from "@/novo/components/ui";
import { BuscarAndamentos, MensagemCliente, Vinculados, resumoDoCaso } from "@/novo/components/caso-extras";
import { semAcento } from "@/novo/lib/format";
import type { Caso, Custa } from "@/novo/lib/types";
import { Cobrar, Receber, NovoHonorario } from "@/novo/components/honorario";
import { BotaoNovo } from "@/novo/components/form-rapido";
import { Acoes, DocsPendentes } from "@/novo/components/acoes";

type Aba = "ficha" | "andamentos" | "prazos" | "financeiro" | "trabalho" | "docs" | "pecas" | "autos" | "referencia";

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
            <h1 className="titulo mt-2 break-words text-[24px] sm:text-[28px]">{caso.titulo}</h1>
            <p className="mt-1 text-ink-2">
              <Link href={`/clientes/${caso.cliente_id}`} className="font-semibold text-ink hover:text-cobalto hover:underline">{caso.cliente_nome}</Link>
              {caso.parte_contraria && <> <span className="text-ink-3">×</span> {caso.parte_contraria}</>}
            </p>
            {caso.numero ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[13px] text-ink-2"><span className="break-all font-mono font-semibold text-ink">{caso.numero}</span><Copiar texto={caso.numero} rotulo="Copiar número do processo" /></p>
            ) : caso.natureza === "judicial" ? <p className="mt-1 text-[13px] text-ink-3">Ainda sem número</p> : null}
            <p className="mt-0.5 text-[13px] text-ink-3">{[caso.orgao, caso.comarca && `${caso.comarca}/${caso.uf ?? ""}`].filter(Boolean).join(" · ")}</p>
            {(caso.vinculados ?? []).length > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">{caso.vinculados!.map((v) => <span key={v.id} className="inline-flex items-center gap-1"><span className="text-ink-3">{v.tipo}:</span><span className="break-all font-mono">{v.numero}</span><Copiar texto={v.numero} rotulo={`Copiar número do ${v.tipo.toLowerCase()}`} /></span>)}</p>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <MensagemCliente caso={caso} />
            <Copiar texto={resumoDoCaso(caso)} rotulo="Copiar dados do caso" comTexto />
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
        <Abas valor={aba} aoMudar={setAba} abas={[["ficha", `Ficha de ${area.nome}`], ["andamentos", `Andamentos (${andamentos.length})`], ["prazos", `Prazos e audiências (${prazos.filter((p) => !p.concluido).length + audiencias.filter((a) => !a.realizada).length})`], ["financeiro", "Financeiro"], ["trabalho", "Tarefas e anotações"], ["docs", `Documentos pendentes (${(caso.docs_pendentes ?? []).filter((d) => !d.recebido).length})`], ["pecas", "Peças com IA"], ["autos", "Autos"], ["referencia", "Prazos da área"]] as const} />
      </div>

      <div className="mt-4">
        {aba === "ficha" && <Ficha caso={caso} />}

        {aba === "andamentos" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="painel">
              <div className="painel-cab"><h2>Andamentos</h2><span className="flex flex-wrap gap-2"><BuscarAndamentos casos={[caso]} rotulo="Buscar no tribunal" classe="btn btn-g btn-sm" /><MensagemCliente caso={caso} modeloInicial="andamento" rotulo="Avisar cliente" classe="btn btn-g btn-sm" /></span></div>
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
                    <Acoes oQue="o andamento" campos={[{ k: "data", rotulo: "Data", tipo: "data", obrig: true }, { k: "descricao", rotulo: "O que aconteceu", tipo: "longo", obrig: true }, { k: "texto_cliente", rotulo: "Versão em linguagem simples para o cliente", tipo: "longo" }]} inicial={{ data: a.data, descricao: a.descricao, texto_cliente: a.texto_cliente ?? "" }}
                      aoSalvar={(v) => alterar("andamentos", a.id, { data: String(v.data), descricao: String(v.descricao), texto_cliente: v.texto_cliente ? String(v.texto_cliente) : undefined })} aoExcluir={() => excluir("andamentos", a.id)} />
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
                        <Acoes oQue="o prazo" campos={[{ k: "titulo", rotulo: "Prazo", obrig: true, largo: true }, { k: "data", rotulo: "Vence em", tipo: "data", obrig: true }, { k: "base", rotulo: "Base legal ou observação", largo: true }, { k: "fatal", rotulo: "Prazo fatal", tipo: "check" }]} inicial={{ titulo: p.titulo, data: p.data, base: p.base ?? "", fatal: p.fatal }}
                          aoSalvar={(v) => alterar("prazos", p.id, { titulo: String(v.titulo), data: String(v.data), base: v.base ? String(v.base) : undefined, fatal: !!v.fatal })} aoExcluir={() => excluir("prazos", p.id)} />
                      </li>
                    );
                  })}</ul>
                )}
              </section>
              <section className="painel">
                <div className="painel-cab"><h2>Audiências e sessões</h2>{audiencias.some((a) => !a.realizada) && <MensagemCliente caso={caso} modeloInicial="audiencia" rotulo="Lembrar cliente" classe="btn btn-g btn-sm" />}</div>
                {audiencias.length === 0 ? <Vazio titulo="Nenhuma audiência marcada" /> : (
                  <ul>{audiencias.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                      <span className="w-[112px] shrink-0"><span className="block font-semibold">{data(a.data_hora)}</span><span className="text-[12.5px] text-ink-3">{hora(a.data_hora)} · {a.modalidade}</span></span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{a.titulo}</span><span className="block truncate text-[12.5px] text-ink-3">{a.local}</span></span>
                      <button className={`btn btn-sm ${a.realizada ? "btn-p" : "btn-g"}`} onClick={() => alterar("audiencias", a.id, { realizada: !a.realizada })}>{a.realizada ? "Realizada" : "Marcar realizada"}</button>
                      <Acoes oQue="a audiência" campos={[{ k: "titulo", rotulo: "Tipo", obrig: true, largo: true }, { k: "dia", rotulo: "Data", tipo: "data", obrig: true }, { k: "hora", rotulo: "Hora", tipo: "hora", obrig: true }, { k: "local", rotulo: "Local ou link", largo: true }, { k: "modalidade", rotulo: "Modalidade", tipo: "opcoes", opcoes: ["presencial", "virtual", "híbrida"] }]}
                        inicial={{ titulo: a.titulo, dia: a.data_hora.slice(0, 10), hora: a.data_hora.slice(11, 16), local: a.local ?? "", modalidade: a.modalidade }}
                        aoSalvar={(v) => alterar("audiencias", a.id, { titulo: String(v.titulo), data_hora: `${v.dia}T${v.hora}:00`, local: v.local ? String(v.local) : undefined, modalidade: (v.modalidade ?? a.modalidade) as typeof a.modalidade })} aoExcluir={() => excluir("audiencias", a.id)} />
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
            {honorarios.some((h) => h.status === "pendente") && <MensagemCliente caso={caso} modeloInicial="honorarios" rotulo="Lembrar honorários" />}
            <BotaoNovo rotulo="Lançar custa ou repasse" classe="btn btn-g" aoSalvar={(v) => incluir("custas", { caso_id: caso.id, descricao: String(v.descricao), tipo: (v.tipo ?? "custas") as Custa["tipo"], valor: Number(v.valor) || 0, data: String(v.data ?? hojeISO()), reembolsavel: !!v.reembolsavel, reembolsado: false })}
              campos={[{ k: "descricao", rotulo: "Descrição", obrig: true, largo: true }, { k: "tipo", rotulo: "Tipo", tipo: "opcoes", inicial: "custas", opcoes: ["custas", "depósito recursal", "depósito judicial", "perícia", "diligência", "emolumentos", "alvará a repassar"] }, { k: "valor", rotulo: "Valor (R$)", tipo: "numero", obrig: true }, { k: "data", rotulo: "Data", tipo: "data", inicial: hojeISO() }, { k: "reembolsavel", rotulo: "O cliente reembolsa", tipo: "check", inicial: true }]} />
          </div><div className="grid gap-4 lg:grid-cols-2">
            <section className="painel overflow-x-auto">
              <div className="painel-cab"><h2>Honorários</h2><span className="text-[12.5px] text-ink-3">Recebido {brl(honorarios.filter((h) => h.status === "recebido").reduce((s, h) => s + h.valor, 0))} de {brl(honorarios.filter((h) => h.tipo !== "êxito").reduce((s, h) => s + h.valor, 0))}</span></div>
              <table className="tb"><thead><tr><th>Descrição</th><th>Vencimento</th><th className="num">Valor</th><th /></tr></thead>
                <tbody>{honorarios.map((h) => (
                  <tr key={h.id}><td>{h.descricao}<span className="block text-[12px] text-ink-3">{h.tipo}</span></td><td>{data(h.vencimento)}</td><td className="num">{brl(h.valor)}</td>
                    <td className="num">{h.status === "recebido" ? <span className="tag tag-ok">Recebido</span> : <span className="inline-flex items-center gap-1"><Cobrar honorario={h} /><Receber honorario={h} />
                      <Acoes oQue="o honorário" campos={[{ k: "descricao", rotulo: "Descrição", obrig: true, largo: true }, { k: "valor", rotulo: "Valor (R$)", tipo: "numero", obrig: true }, { k: "vencimento", rotulo: "Vencimento", tipo: "data", obrig: true }]} inicial={{ descricao: h.descricao, valor: h.valor, vencimento: h.vencimento }}
                        aoSalvar={(v) => alterar("honorarios", h.id, { descricao: String(v.descricao), valor: Number(v.valor) || h.valor, vencimento: String(v.vencimento) })} aoExcluir={() => excluir("honorarios", h.id)} /></span>}</td></tr>
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
                  <Acoes oQue="a tarefa" campos={[{ k: "titulo", rotulo: "Tarefa", obrig: true, largo: true }, { k: "limite", rotulo: "Data limite", tipo: "data" }, { k: "prioridade", rotulo: "Prioridade", tipo: "opcoes", opcoes: [["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]] }]} inicial={{ titulo: t.titulo, limite: t.limite ?? "", prioridade: t.prioridade }}
                    aoSalvar={(v) => alterar("tarefas", t.id, { titulo: String(v.titulo), limite: v.limite ? String(v.limite) : undefined, prioridade: (v.prioridade ?? t.prioridade) as typeof t.prioridade })} aoExcluir={() => excluir("tarefas", t.id)} />
                </li>
              ))}</ul>
              <Rapido rotulo="Nova tarefa" aoIncluir={(titulo) => incluir("tarefas", { caso_id: caso.id, titulo, estado: "a fazer", prioridade: "media", responsavel_id: caso.responsavel_id })} />
            </section>
            <section className="painel">
              <div className="painel-cab"><h2>Anotações</h2></div>
              {anotacoes.length === 0 && <Vazio titulo="Nenhuma anotação" />}
              <ul>{anotacoes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 border-b border-line-2 px-4 py-2.5"><div className="min-w-0 flex-1"><p className="whitespace-pre-line">{n.texto}</p><p className="mt-0.5 text-[12px] text-ink-3">{data(n.data)} · {pessoa(n.autor_id)?.nome}</p></div>
                  <Acoes oQue="a anotação" campos={[{ k: "texto", rotulo: "Anotação", tipo: "longo", obrig: true }]} inicial={{ texto: n.texto }} aoSalvar={(v) => alterar("anotacoes", n.id, { texto: String(v.texto) })} aoExcluir={() => excluir("anotacoes", n.id)} /></li>
              ))}</ul>
              <Rapido rotulo="Nova anotação" aoIncluir={(texto) => incluir("anotacoes", { caso_id: caso.id, texto, data: hojeISO(), autor_id: caso.responsavel_id })} />
            </section>
          </div>
        )}

        {aba === "docs" && <><div className="mb-3 flex justify-end">{(caso.docs_pendentes ?? []).some((d) => !d.recebido) && <MensagemCliente caso={caso} modeloInicial="documentos" rotulo="Pedir documentos ao cliente" />}</div><DocsPendentes caso={caso} /></>}

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
  const db = useDB();
  const area = areaDe(caso.area);
  const [edit, setEdit] = useState(false);
  const [dados, setDados] = useState(caso.dados);
  const geralDe = (c: Caso) => ({ titulo: c.titulo, numero: c.numero, orgao: c.orgao ?? "", comarca: c.comarca ?? "", uf: c.uf ?? "", parte_contraria: c.parte_contraria ?? "", valor: c.valor ?? "", cliente: c.cliente_nome ?? "" });
  const [geral, setGeral] = useState(geralDe(caso));
  const base = edit ? dados : caso.dados;
  const tipo = tipoDoCaso(area, base);
  const secoes = area.secoes.filter((s) => secaoVisivel(s, tipo, base));
  const campos = secoes.flatMap((s) => s.campos);
  const preenchidos = campos.filter((c) => caso.dados[c.k] !== undefined && caso.dados[c.k] !== "").length;
  const sugestoes = (k: string) => { const c = campos.find((x) => x.k === k)!; return [...new Set([...valoresUsados(db.casos, area.id, c), ...(SUGESTOES_FIXAS[k] ?? [])])].filter((x) => x); };
  const distintos = (f: (c: Caso) => string | undefined) => [...new Set(db.casos.map(f).filter((x): x is string => !!x))].sort();

  function salvar() {
    const nomeCli = geral.cliente.trim();
    let cliente_id = caso.cliente_id, cliente_nome = caso.cliente_nome;
    if (nomeCli && semAcento(nomeCli) !== semAcento(caso.cliente_nome ?? "")) {
      const achado = db.clientes.find((c) => semAcento(c.nome) === semAcento(nomeCli));
      cliente_id = achado?.id ?? incluir("clientes", { nome: nomeCli, tipo: "pf", criado_em: hojeISO() });
      cliente_nome = achado?.nome ?? nomeCli;
    }
    const { cliente: _c, ...resto } = geral; // eslint-disable-line @typescript-eslint/no-unused-vars
    alterar("casos", caso.id, { ...resto, uf: resto.uf || undefined, valor: geral.valor === "" ? undefined : Number(geral.valor), dados, cliente_id, cliente_nome });
    setEdit(false);
  }
  const mudarTipo = (t: string) => {
    if (edit) setDados({ ...dados, tipo_caso: t });
    else alterar("casos", caso.id, { dados: { ...caso.dados, tipo_caso: t } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {area.tipos && (
          <section className="painel p-4">
            <Rotulado rotulo={`Tipo de processo em ${area.nome}`}>
              <select className="inp" value={tipo} onChange={(e) => mudarTipo(e.target.value)}>
                <option value="">Escolher</option>
                {area.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Rotulado>
            <p className="mt-1.5 text-[12.5px] text-ink-3">{tipo ? "A ficha mostra só o que cabe neste tipo. Seções de outros tipos voltam a aparecer se já tiverem algo preenchido." : "Escolha o tipo para a ficha mostrar os campos próprios dele."}</p>
          </section>
        )}
        <Vinculados caso={caso} />
        {secoes.map((s) => (
          <section key={s.titulo} className="painel">
            <div className="painel-cab"><h2>{s.titulo}</h2></div>
            {edit ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">{s.campos.map((c) => <CampoArea key={c.k} campo={c} valor={dados[c.k]} sugestoes={c.tipo === "m" || c.tipo === "t" ? sugestoes(c.k) : undefined} aoMudar={(v) => setDados({ ...dados, [c.k]: v })} />)}</div>
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {s.campos.map((c) => {
                  const v = valorCampo(c, caso.dados[c.k]);
                  const largo = c.tipo === "l" || c.tipo === "m";
                  return (
                    <div key={c.k} className={`min-w-0 border-b border-line-2 px-4 py-2.5 ${largo ? "sm:col-span-2" : ""}`}>
                      <dt className="text-[12px] font-semibold text-ink-3">{c.rotulo}</dt>
                      {!v ? <dd className="text-ink-3">Não informado</dd> : c.tipo === "m" ? (
                        <dd><ul className="mt-0.5 space-y-0.5">{itensDe(caso.dados[c.k]).map((it, n) => <li key={n} className="flex items-start gap-1"><span className="min-w-0 flex-1 break-words">• {it}</span><Copiar texto={it} rotulo={`Copiar ${it}`} /></li>)}</ul></dd>
                      ) : (
                        <dd className="flex items-start gap-1"><span className="min-w-0 flex-1 whitespace-pre-line break-words">{v}</span><Copiar texto={v} rotulo={`Copiar ${c.rotulo.toLowerCase()}`} /></dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        ))}
      </div>
      <aside className="min-w-0 space-y-4">
        <section className="painel p-4">
          <p className="text-[12.5px] text-ink-2">Ficha de {area.nome}{tipo ? ` (${tipo})` : ""}: {preenchidos} de {campos.length} campos preenchidos.</p>
          <div className="mt-2 h-1.5 rounded-full bg-cobalto-f"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${campos.length ? (preenchidos / campos.length) * 100 : 0}%` }} /></div>
          {edit ? (
            <div className="mt-3 flex gap-2"><button className="btn btn-p flex-1" onClick={salvar}>Salvar ficha</button><button className="btn btn-g" onClick={() => { setDados(caso.dados); setEdit(false); }}>Cancelar</button></div>
          ) : <button className="btn btn-g mt-3 w-full" onClick={() => { setDados(caso.dados); setGeral(geralDe(caso)); setEdit(true); }}><Pencil />Editar ficha</button>}
        </section>
        <section className="painel">
          <div className="painel-cab"><h2>Dados gerais</h2></div>
          {edit ? (
            <div className="space-y-3 p-4">
              <Rotulado rotulo="Título"><input className="inp" value={geral.titulo} onChange={(e) => setGeral({ ...geral, titulo: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Cliente"><input className="inp" list="ficha-clientes" value={geral.cliente} onChange={(e) => setGeral({ ...geral, cliente: e.target.value })} /></Rotulado>
              <datalist id="ficha-clientes">{db.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
              <Rotulado rotulo="Número"><input className="inp" inputMode="numeric" value={geral.numero} onChange={(e) => setGeral({ ...geral, numero: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Vara ou órgão"><input className="inp" list="ficha-orgaos" value={geral.orgao} onChange={(e) => setGeral({ ...geral, orgao: e.target.value })} /></Rotulado>
              <datalist id="ficha-orgaos">{distintos((c) => c.orgao).map((x) => <option key={x} value={x} />)}</datalist>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <Rotulado rotulo="Comarca"><input className="inp" list="ficha-comarcas" value={geral.comarca} onChange={(e) => setGeral({ ...geral, comarca: e.target.value })} /></Rotulado>
                <Rotulado rotulo="UF"><input className="inp" maxLength={2} value={geral.uf} onChange={(e) => setGeral({ ...geral, uf: e.target.value.toUpperCase() })} /></Rotulado>
              </div>
              <datalist id="ficha-comarcas">{distintos((c) => c.comarca).map((x) => <option key={x} value={x} />)}</datalist>
              <Rotulado rotulo="Parte contrária"><input className="inp" list="ficha-contrarias" value={geral.parte_contraria} onChange={(e) => setGeral({ ...geral, parte_contraria: e.target.value })} /></Rotulado>
              <datalist id="ficha-contrarias">{distintos((c) => c.parte_contraria).map((x) => <option key={x} value={x} />)}</datalist>
              <Rotulado rotulo="Valor (R$)"><input className="inp" type="number" value={geral.valor} onChange={(e) => setGeral({ ...geral, valor: e.target.value })} /></Rotulado>
            </div>
          ) : (
            <dl className="divide-y divide-line-2 text-[13.5px]">
              {caso.numero && <div className="flex items-center justify-between gap-3 px-4 py-2"><dt className="text-ink-3">Número</dt><dd className="flex min-w-0 items-center gap-1"><span className="break-all font-mono text-[12.5px]">{caso.numero}</span><Copiar texto={caso.numero} rotulo="Copiar número do processo" /></dd></div>}
              {caso.orgao && <div className="flex items-center justify-between gap-3 px-4 py-2"><dt className="text-ink-3">Juízo</dt><dd className="flex min-w-0 items-center gap-1 text-right"><span className="break-words">{caso.orgao}{caso.comarca ? `, ${caso.comarca}` : ""}</span><Copiar texto={`${caso.orgao}${caso.comarca ? `, ${caso.comarca}` : ""}${caso.uf ? `/${caso.uf}` : ""}`} rotulo="Copiar juízo" /></dd></div>}
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
