"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, Check, Loader2, Plus, Search, Server } from "lucide-react";
import { aguardarGravacoes, alterar, incluir, lerDB, recarregar, useDB } from "@/novo/lib/store";
import { data, hojeISO, quando } from "@/novo/lib/format";
import { areaDe } from "@/novo/lib/areas";
import { dadosDaPublicacao, detectarAudiencia, detectarPrazo, ePenal, extrairCNJ, soDigitos, vencimentoDaPublicacao, type DadosPublicacao } from "@/lib/prazo-publicacao";
import { semAcento } from "@/novo/lib/format";
import { Cabecalho, Copiar, Dialogo, LinkCaso, Seg, TagArea, Vazio, useMapas } from "@/novo/components/ui";
import { BotaoNovo } from "@/novo/components/form-rapido";
import { NovoCaso } from "@/novo/components/novo-caso";
import type { Caso, DB, Publicacao } from "@/novo/lib/types";

/** Prazo (e audiência) a partir do texto da publicação, para um caso já cadastrado. */
function lancarDaPublicacao(p: Publicacao, c: Caso, db: DB): string | null {
  const lido = detectarPrazo(p.texto) ?? (p.prazo_sugerido ? detectarPrazo(`prazo de ${p.prazo_sugerido}`) : null);
  let msg: string | null = null;
  if (lido) {
    const conta = vencimentoDaPublicacao(p.data, lido, c.area);
    incluir("prazos", { caso_id: c.id, titulo: `${lido.ato} (${lido.dias} dias${conta.uteis ? " úteis" : ""})`, data: conta.vencimento, fatal: true, concluido: false, prioridade: "alta", responsavel_id: c.responsavel_id,
      base: `Publicação de ${data(p.data)} (${p.diario}): “${lido.trecho}”. Contagem a partir de ${data(conta.inicio)}. Confira feriados locais.` });
    msg = `Prazo lançado: ${lido.ato}, vence ${data(conta.vencimento)}.`;
  }
  const aud = detectarAudiencia(p.texto);
  if (aud && !db.audiencias.some((a) => a.caso_id === c.id && a.data_hora.slice(0, 16) === aud.data_hora.slice(0, 16))) {
    incluir("audiencias", { caso_id: c.id, titulo: "Audiência (da publicação)", data_hora: aud.data_hora.slice(0, 19), modalidade: "presencial", realizada: false, responsavel_id: c.responsavel_id, observacoes: `Marcada pela publicação de ${data(p.data)}: “${aud.trecho}”. Confira local e modalidade.` });
    msg = `${msg ?? ""} Audiência de ${data(aud.data_hora)} na agenda.`.trim();
  }
  return msg;
}

/** Campos do formulário de caso novo a partir do que a publicação traz. */
function preencherCaso(d: DadosPublicacao) {
  const classe = d.classe ? d.classe.charAt(0) + d.classe.slice(1).toLowerCase() : "";
  return { numero: d.numero ?? "", titulo: classe, cliente: d.cliente, contraria: d.contraria, orgao: d.orgao, comarca: d.comarca };
}

/** Prazo já lançado a partir desta publicação (pelo texto de origem). */
const prazoDaPublicacao = (db: DB, p: Publicacao) => (p.caso_id ? db.prazos.find((z) => z.caso_id === p.caso_id && (z.base ?? "").includes(`ublicação de ${data(p.data)}`)) : undefined);

export default function PaginaPublicacoes() {
  return <Suspense fallback={null}><Publicacoes /></Suspense>;
}

function Publicacoes() {
  const db = useDB();
  const { caso } = useMapas(db);
  const params = useSearchParams();
  const [ver, setVer] = useState<"novas" | "todas" | "sem">(params.get("ver") === "sem" ? "sem" : "novas");
  const [feito, setFeito] = useState<Record<string, string>>({});
  const [incluirPara, setIncluirPara] = useState<Publicacao | null>(null);

  const lista = useMemo(() => db.publicacoes.filter((p) => ver === "todas" || (ver === "novas" ? !p.lida : !p.caso_id)).sort((a, b) => b.data.localeCompare(a.data)), [db.publicacoes, ver]);
  const judiciais = db.casos.filter((c) => c.natureza === "judicial");

  function lancar(p: Publicacao, c: Caso) {
    const msg = lancarDaPublicacao(p, c, db);
    alterar("publicacoes", p.id, { lida: true });
    setFeito({ ...feito, [p.id]: msg ?? "Não achei prazo em dias no texto. Lance o prazo à mão no caso." });
  }
  function vincular(p: Publicacao, casoId: string) {
    const atual = lerDB();
    const c = atual.casos.find((x) => x.id === casoId);
    if (!c) return;
    alterar("publicacoes", p.id, { caso_id: c.id });
    const msg = lancarDaPublicacao({ ...p, caso_id: c.id }, c, atual);
    setFeito({ ...feito, [p.id]: msg ? `Vinculada. ${msg}` : "Vinculada. Não achei prazo em dias no texto." });
  }

  return (
    <>
      <Cabecalho titulo="Publicações" sub="Intimações dos diários eletrônicos em nome da advogada. Quando o processo está cadastrado, o prazo entra sozinho na agenda e você recebe aviso no celular.">
        <BuscarPublicacoes />
        <BotaoNovo rotulo="Registrar à mão" classe="btn btn-g" aoSalvar={(v) => incluir("publicacoes", { caso_id: v.caso_id ? String(v.caso_id) : undefined, data: String(v.data ?? hojeISO()), diario: String(v.diario ?? "DJEN"), orgao: String(v.orgao ?? ""), texto: String(v.texto), lida: false, prazo_sugerido: v.prazo ? String(v.prazo) : undefined })}
          campos={[{ k: "caso_id", rotulo: "Caso", tipo: "opcoes", largo: true, opcoes: judiciais.map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }, { k: "data", rotulo: "Disponibilizada em", tipo: "data", inicial: hojeISO() }, { k: "diario", rotulo: "Diário", tipo: "opcoes", inicial: "DJEN", opcoes: ["DJEN", "DEJT", "DJe estadual", "DOU"] }, { k: "orgao", rotulo: "Vara ou órgão", largo: true }, { k: "texto", rotulo: "Texto da publicação", tipo: "longo", obrig: true }, { k: "prazo", rotulo: "Prazo (ex.: Réplica: 15 dias úteis)", largo: true, dica: "Se o texto já disser o prazo, não precisa preencher." }]} />
      </Cabecalho>
      <div className="mb-4"><Seg rotulo="Filtro" valor={ver} aoMudar={setVer} opcoes={[["novas", `Não lidas (${db.publicacoes.filter((p) => !p.lida).length})`], ["sem", `Sem caso (${db.publicacoes.filter((p) => !p.caso_id).length})`], ["todas", "Todas"]] as const} /></div>

      <section className="painel mb-4 flex items-start gap-3 p-4">
        <Server className="mt-0.5 size-5 shrink-0" />
        <div className="text-[13.5px] text-ink-2"><p className="font-semibold text-ink">Busca diária no servidor, pela OAB</p><p>Roda todo dia de manhã no DJEN (todos os tribunais integrados) e no diário do TJRJ, com o computador desligado. Use “Buscar agora” para consultar na hora e escolher o que entra no Justio.</p></div>
      </section>

      <div className="painel">
        {lista.length === 0 ? <Vazio titulo={ver === "novas" ? "Nenhuma publicação por ler" : "Nenhuma publicação neste filtro"}>Quando a busca encontrar algo em nome da OAB cadastrada, a publicação aparece aqui.</Vazio> : (
          <ul>{lista.map((p) => {
            const c = caso(p.caso_id);
            const numero = extrairCNJ(p.orgao, p.texto);
            const lido = detectarPrazo(p.texto);
            const ja = prazoDaPublicacao(db, p);
            return (
              <li key={p.id} className={`grid gap-x-4 gap-y-2 border-b border-line-2 px-4 py-3.5 last:border-0 lg:grid-cols-[minmax(0,1fr)_280px] ${p.lida ? "" : "nao-lido"}`}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3"><span className="tag tag-info">{p.diario}</span><span>{data(p.data)} · {quando(p.data)}</span>{numero && <span className="inline-flex items-center gap-0.5"><span className="break-all font-mono text-ink-2">{numero}</span><Copiar texto={numero} rotulo="Copiar número do processo" /></span>}</p>
                  <p className="mt-1.5 max-w-[78ch] whitespace-pre-line break-words">{p.texto}</p>
                  {ja ? <p className="mt-1.5 text-[13px]"><span className="font-semibold">Prazo lançado:</span> {ja.titulo}, vence {data(ja.data)}</p>
                    : lido ? <p className="mt-1.5 text-[13px]"><span className="font-semibold">Prazo no texto:</span> {lido.ato}, {lido.dias} dias{lido.uteis === false ? " corridos" : lido.uteis ? " úteis" : ""}</p>
                    : p.prazo_sugerido && <p className="mt-1.5 text-[13px]"><span className="font-semibold">Prazo informado:</span> {p.prazo_sugerido}</p>}
                  {feito[p.id] && <p role="status" className="mt-1.5 text-[13px] font-semibold text-ok">{feito[p.id]}</p>}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  {c ? <div><LinkCaso caso={c} /><TagArea id={c.area} /></div> : (
                    <>
                      <p className="text-[13px] font-semibold text-perigo">Processo não cadastrado. Quer incluir o caso?</p>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-p btn-sm" onClick={() => setIncluirPara(p)}><Plus />Incluir caso</button>
                        <select className="inp h-8 w-auto max-w-full text-[13px]" aria-label="Vincular a um caso já cadastrado" value="" onChange={(e) => e.target.value && vincular(p, e.target.value)}>
                          <option value="">Vincular a caso existente</option>
                          {judiciais.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome}: {x.titulo}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {c && !ja && !feito[p.id] && (lido || p.prazo_sugerido) && <button className="btn btn-p btn-sm" onClick={() => lancar(p, c)}><CalendarPlus />Lançar prazo</button>}
                    {!p.lida && <button className="btn btn-g btn-sm" onClick={() => alterar("publicacoes", p.id, { lida: true })}><Check />Marcar lida</button>}
                  </div>
                </div>
              </li>
            );
          })}</ul>
        )}
      </div>

      {incluirPara && (() => {
        const d = dadosDaPublicacao(incluirPara.texto, { titulo: incluirPara.orgao });
        return (
          <NovoCaso aberto aoFechar={() => setIncluirPara(null)} areaInicial={d.area} partes={d.partes} preenchido={preencherCaso(d)}
            aoCriar={(id) => { const p = incluirPara; setIncluirPara(null); vincular(p, id); }} />
        );
      })()}
    </>
  );
}

// ───────────── busca na hora, com escolha ─────────────

interface Achada {
  titulo: string; conteudo?: string; data_publicacao: string; diario: string; url?: string; hash: string;
  numero_processo?: string; classe?: string; orgao?: string; ja_salva: boolean; processo_id?: string; partes?: { nome: string; polo: string }[];
}

function BuscarPublicacoes() {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [achadas, setAchadas] = useState<Achada[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [procMarcados, setProcMarcados] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const [detalhar, setDetalhar] = useState<DadosPublicacao | null>(null);

  const casoPeloNumero = (n?: string) => (n ? db.casos.find((c) => c.numero && soDigitos(c.numero) === soDigitos(n)) : undefined);
  const novas = (achadas ?? []).filter((a) => !a.ja_salva);
  const jaSalvas = (achadas ?? []).length - novas.length;
  const foraDoJustio = useMemo(() => {
    const m = new Map<string, { numero: string; classe?: string; orgao?: string; qtd: number; dados: DadosPublicacao }>();
    for (const a of achadas ?? []) {
      const n = a.numero_processo;
      if (!n || soDigitos(n).length !== 20 || casoPeloNumero(n)) continue;
      const x = m.get(soDigitos(n));
      if (x) x.qtd++;
      else m.set(soDigitos(n), { numero: extrairCNJ(n) ?? n, classe: a.classe, orgao: a.orgao, qtd: 1, dados: dadosDaPublicacao(a.conteudo ?? "", { titulo: a.titulo, classe: a.classe, orgao: a.orgao, numero: n, partes: a.partes }) });
    }
    return [...m.values()];
  }, [achadas, db.casos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buscar() {
    setRodando(true); setAviso(""); setErros([]); setAchadas(null);
    try {
      const r = await fetch("/api/publicacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apenasBuscar: true }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `erro ${r.status}`);
      const lista = (j.resultados ?? []) as Achada[];
      setAchadas(lista);
      setErros(j.erros ?? []);
      setMarcadas(new Set(lista.filter((a) => !a.ja_salva).map((a) => a.hash)));
      setProcMarcados(new Set());
    } catch (e) {
      setErros([e instanceof Error ? e.message : "A busca falhou."]);
    } finally { setRodando(false); }
  }

  async function gravar() {
    const sel = novas.filter((a) => marcadas.has(a.hash));
    if (!sel.length) return;
    setRodando(true);
    try {
      await aguardarGravacoes(); // casos recém-cadastrados precisam estar no banco para a publicação vincular
      const r = await fetch("/api/publicacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resultados: sel }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `erro ${r.status}`);
      setAviso(`${j.imported} publicação${j.imported === 1 ? "" : "ões"} gravada${j.imported === 1 ? "" : "s"}. Nas de processo cadastrado, o prazo já foi lançado e o aviso foi para o celular.`);
      setAchadas((achadas ?? []).map((a) => (marcadas.has(a.hash) ? { ...a, ja_salva: true } : a)));
      setMarcadas(new Set());
      recarregar();
    } catch (e) {
      setAviso(`Não gravou: ${e instanceof Error ? e.message : "erro"}`);
    } finally { setRodando(false); }
  }

  function cadastrarEmLote() {
    const resp = db.equipe[0]?.id ?? "e1";
    const lista = foraDoJustio.filter((p) => procMarcados.has(p.numero));
    let semCliente = 0;
    for (const p of lista) {
      const d = p.dados;
      const area = areaDe(d.area);
      const f = preencherCaso(d);
      let clienteId: string | undefined, clienteNome = "Cliente a identificar";
      if (d.cliente) {
        const ja = lerDB().clientes.find((c) => semAcento(c.nome) === semAcento(d.cliente));
        clienteId = ja?.id ?? incluir("clientes", { nome: d.cliente, tipo: "pf", criado_em: hojeISO() });
        clienteNome = ja?.nome ?? d.cliente;
      } else semCliente++;
      incluir("casos", { natureza: "judicial", area: area.id, numero: p.numero, titulo: f.titulo || "Processo encontrado pela OAB", status: "ativo", fase: 0, orgao: f.orgao || undefined, comarca: f.comarca || undefined, uf: "RJ",
        cliente_id: clienteId as unknown as string, cliente_nome: clienteNome, parte_contraria: f.contraria || undefined, responsavel_id: resp, dados: {}, criado_em: hojeISO() });
    }
    setProcMarcados(new Set());
    setAviso(`${lista.length} caso${lista.length === 1 ? "" : "s"} cadastrado${lista.length === 1 ? "" : "s"}${semCliente ? ` (${semCliente} sem nome de cliente na publicação: ficou “a identificar”)` : ""}. Grave as publicações agora para elas já entrarem vinculadas e com prazo.`);
    aguardarGravacoes().then(() => recarregar());
  }

  const alternar = (s: Set<string>, k: string) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; };

  return (
    <>
      <button className="btn btn-p" onClick={() => { setAberto(true); if (!achadas && !rodando) buscar(); }}><Search />Buscar agora</button>
      <Dialogo aberto={aberto} aoFechar={() => { if (!rodando) setAberto(false); }} titulo="Buscar publicações pela OAB" largo
        rodape={<>
          {aviso && <p role="status" className="mr-auto self-center text-[13px] font-semibold">{aviso}</p>}
          <button className="btn btn-g" disabled={rodando} onClick={buscar}>{rodando ? <Loader2 className="animate-spin" /> : <Search />}Buscar de novo</button>
          <button className="btn btn-p" disabled={rodando || marcadas.size === 0} onClick={gravar}>Gravar {marcadas.size} selecionada{marcadas.size === 1 ? "" : "s"}</button>
        </>}>
        {rodando && !achadas && <p className="flex items-center gap-2 py-6 text-ink-2"><Loader2 className="size-4 animate-spin" />Consultando os diários. Pode levar até um minuto.</p>}
        {erros.length > 0 && <div role="alert" className="mb-3 rounded-[12px] bg-perigo-f p-3 text-[13px] text-perigo"><p className="font-semibold">Alguns diários não responderam:</p><ul className="mt-1 list-disc pl-5">{erros.map((e) => <li key={e} className="break-words">{e}</li>)}</ul></div>}

        {achadas && (
          <>
            {foraDoJustio.length > 0 && (
              <section className="mb-4 rounded-[12px] border border-line">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-3 py-2.5">
                  <h3 className="font-semibold">Processos em seu nome que não estão no Justio ({foraDoJustio.length})</h3>
                  <span className="flex gap-2">
                    <button className="btn btn-g btn-sm" onClick={() => setProcMarcados(new Set(foraDoJustio.map((p) => p.numero)))}>Marcar todos</button>
                    <button className="btn btn-p btn-sm" disabled={procMarcados.size === 0} onClick={cadastrarEmLote}>Cadastrar {procMarcados.size || ""} selecionado{procMarcados.size === 1 ? "" : "s"}</button>
                  </span>
                </div>
                <ul className="divide-y divide-line-2">{foraDoJustio.map((p) => (
                  <li key={p.numero} className="flex items-start gap-3 px-3 py-2.5">
                    <input type="checkbox" className="mt-1 size-4 shrink-0" aria-label={`Selecionar ${p.numero}`} checked={procMarcados.has(p.numero)} onChange={() => setProcMarcados(alternar(procMarcados, p.numero))} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1"><span className="break-all font-mono text-[13px] font-semibold">{p.numero}</span><Copiar texto={p.numero} rotulo="Copiar número" /></span>
                      {p.dados.cliente && <span className="block text-[13px]">{p.dados.cliente}{p.dados.contraria ? <span className="text-ink-3"> × {p.dados.contraria}</span> : null}</span>}
                      <span className="block text-[12.5px] text-ink-3">{[p.classe, p.dados.orgao || p.orgao, `${p.qtd} publicação${p.qtd > 1 ? "ões" : ""}`].filter(Boolean).join(" · ")} · área provável: {areaDe(p.dados.area).nome}</span>
                    </span>
                    <button className="btn btn-g btn-sm shrink-0" onClick={() => setDetalhar(p.dados)}>Com detalhes</button>
                  </li>
                ))}</ul>
                <p className="border-t border-line-2 px-3 py-2 text-[12.5px] text-ink-3">“Cadastrar” cria o caso com o número, a classe e o órgão, e cliente a identificar. “Com detalhes” abre o formulário completo.</p>
              </section>
            )}

            <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-semibold">{novas.length} nova{novas.length === 1 ? "" : "s"}</span>{jaSalvas > 0 && <span className="text-ink-3">· {jaSalvas} já estava{jaSalvas === 1 ? "" : "m"} no Justio</span>}
              {novas.length > 0 && <><button className="btn btn-g btn-sm" onClick={() => setMarcadas(new Set(novas.map((a) => a.hash)))}>Marcar todas</button><button className="btn btn-g btn-sm" onClick={() => setMarcadas(new Set())}>Desmarcar</button></>}
            </div>
            {novas.length === 0 ? <p className="py-4 text-ink-2">Nada novo nos últimos 45 dias além do que já está no Justio.</p> : (
              <ul className="divide-y divide-line-2 rounded-[12px] border border-line">{novas.map((a) => {
                const c = casoPeloNumero(a.numero_processo) ?? db.casos.find((x) => x.id === a.processo_id);
                const lido = detectarPrazo(`${a.titulo}\n${a.conteudo ?? ""}`);
                const venc = lido && c ? vencimentoDaPublicacao(a.data_publicacao, lido, c.area).vencimento : null;
                return (
                  <li key={a.hash}>
                    <label className="flex items-start gap-3 px-3 py-2.5">
                      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={marcadas.has(a.hash)} onChange={() => setMarcadas(alternar(marcadas, a.hash))} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] text-ink-3">{data(a.data_publicacao)} · {a.diario}{a.numero_processo ? ` · ${a.numero_processo}` : ""}</span>
                        <span className="block font-semibold">{c ? `${c.cliente_nome}: ${c.titulo}` : <span className="text-perigo">Processo não cadastrado</span>}</span>
                        <span className="line-clamp-3 block break-words text-[13px] text-ink-2">{a.conteudo || a.titulo}</span>
                        {lido && <span className="mt-0.5 block text-[12.5px]"><span className="font-semibold">Prazo:</span> {lido.ato}, {lido.dias} dias{venc ? `, vence ${data(venc)}` : ""}{!c ? " (entra quando o caso for cadastrado)" : ""}{c && ePenal(c.area) && lido.uteis === null ? " corridos" : ""}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}</ul>
            )}
          </>
        )}
      </Dialogo>
      {detalhar && (
        <NovoCaso aberto aoFechar={() => setDetalhar(null)} areaInicial={detalhar.area} partes={detalhar.partes} preenchido={preencherCaso(detalhar)}
          aoCriar={() => { setDetalhar(null); setAviso("Caso cadastrado. Grave as publicações para elas entrarem vinculadas e com prazo."); aguardarGravacoes().then(() => recarregar()); }} />
      )}
    </>
  );
}
