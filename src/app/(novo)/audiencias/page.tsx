"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MapPin, Plus, Video } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { data, diaSemana, diasAte, hora, quando } from "@/novo/lib/format";
import { Avatar, Cabecalho, Dialogo, LinkCaso, Rotulado, Seg, TagArea, Vazio, useMapas } from "@/novo/components/ui";
import type { Audiencia } from "@/novo/lib/types";

export default function Audiencias() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [ver, setVer] = useState<"proximas" | "realizadas">("proximas");
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ caso_id: "", titulo: "Audiência de instrução e julgamento", data: "", hora: "14:00", local: "", modalidade: "presencial" as Audiencia["modalidade"] });

  const lista = useMemo(() => db.audiencias.filter((a) => (ver === "proximas" ? !a.realizada : a.realizada)).sort((a, b) => (ver === "proximas" ? a.data_hora.localeCompare(b.data_hora) : b.data_hora.localeCompare(a.data_hora))), [db.audiencias, ver]);
  const grupos = useMemo(() => {
    const m = new Map<string, typeof lista>();
    lista.forEach((a) => { const d = a.data_hora.slice(0, 10); m.set(d, [...(m.get(d) ?? []), a]); });
    return [...m.entries()];
  }, [lista]);

  function salvar() {
    const c = caso(f.caso_id);
    if (!c || !f.data) return;
    incluir("audiencias", { caso_id: c.id, titulo: f.titulo, data_hora: `${f.data}T${f.hora}:00`, local: f.local || c.orgao, modalidade: f.modalidade, realizada: false, responsavel_id: c.responsavel_id });
    setNovo(false);
  }

  return (
    <>
      <Cabecalho titulo="Audiências" sub="Pauta de audiências, sessões do júri e perícias com data marcada.">
        <Seg rotulo="Situação" valor={ver} aoMudar={setVer} opcoes={[["proximas", "A realizar"], ["realizadas", "Realizadas"]] as const} />
        <button className="btn btn-p" onClick={() => setNovo(true)}><Plus />Marcar audiência</button>
      </Cabecalho>
      {grupos.length === 0 && <div className="painel"><Vazio titulo="Nenhuma audiência aqui">Use “Marcar audiência” para incluir a próxima da pauta.</Vazio></div>}
      <div className="space-y-4">
        {grupos.map(([d, itens]) => {
          const n = diasAte(d);
          return (
            <section key={d} className="painel">
              <div className="painel-cab"><h2><span className="first-letter:uppercase">{diaSemana(d)}</span>, {data(d)}</h2><span className={`tag ${n === 0 ? "tag-alerta" : n < 0 ? "tag-perigo" : ""}`}>{quando(d)}</span></div>
              <ul>{itens.map((a) => {
                const c = caso(a.caso_id);
                return (
                  <li key={a.id} className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-line-2 px-4 py-3 last:border-0 md:grid-cols-[58px_minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                    <span className="titulo text-[22px]">{hora(a.data_hora)}</span>
                    <div className="min-w-0"><p className="font-semibold">{a.titulo}</p><p className="flex items-center gap-1 truncate text-[12.5px] text-ink-3">{a.modalidade === "presencial" ? <MapPin className="size-3.5 shrink-0" /> : <Video className="size-3.5 shrink-0" />}{a.local} · {a.modalidade}</p></div>
                    <div className="col-start-2 min-w-0 md:col-start-auto"><LinkCaso caso={c} />{c && <span className="mt-0.5 block"><TagArea id={c.area} /></span>}</div>
                    <div className="col-start-2 flex items-center gap-2 md:col-start-auto"><Avatar pessoa={pessoa(a.responsavel_id)} />
                      {!a.realizada && <Link href={`/audiencias/${a.id}/ao-vivo`} className="btn btn-p btn-sm">Ao vivo</Link>}
                      <button className="btn btn-g btn-sm" onClick={() => alterar("audiencias", a.id, { realizada: !a.realizada })}>{a.realizada ? "Reabrir" : "Marcar realizada"}</button></div>
                  </li>
                );
              })}</ul>
            </section>
          );
        })}
      </div>

      <Dialogo aberto={novo} aoFechar={() => setNovo(false)} titulo="Marcar audiência" rodape={<><button className="btn btn-g" onClick={() => setNovo(false)}>Cancelar</button><button className="btn btn-p" disabled={!f.caso_id || !f.data} onClick={salvar}>Marcar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Caso" className="sm:col-span-2"><select className="inp" value={f.caso_id} onChange={(e) => setF({ ...f, caso_id: e.target.value })}><option value="">Escolha o caso</option>{db.casos.filter((c) => c.status === "ativo").map((c) => <option key={c.id} value={c.id}>{c.cliente_nome}: {c.titulo}</option>)}</select></Rotulado>
          <Rotulado rotulo="Tipo" className="sm:col-span-2"><input className="inp" list="tipos-aud" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
            <datalist id="tipos-aud">{["Audiência de custódia", "Audiência de conciliação", "Audiência de mediação", "Audiência de instrução e julgamento", "Audiência inicial", "Audiência una", "Sessão plenária do júri", "Sessão de julgamento (sustentação oral)", "Perícia"].map((t) => <option key={t} value={t} />)}</datalist></Rotulado>
          <Rotulado rotulo="Data"><input type="date" className="inp" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Hora"><input type="time" className="inp" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Local ou link"><input className="inp" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Em branco: usa a vara do caso" /></Rotulado>
          <Rotulado rotulo="Modalidade"><select className="inp" value={f.modalidade} onChange={(e) => setF({ ...f, modalidade: e.target.value as Audiencia["modalidade"] })}><option>presencial</option><option>virtual</option><option>híbrida</option></select></Rotulado>
        </div>
      </Dialogo>
    </>
  );
}
