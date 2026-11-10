"use client";
import { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { AREAS } from "@/novo/lib/areas";
import { data, diasAte, quando } from "@/novo/lib/format";
import { Cabecalho, LinkCaso, Seg, TagArea, Vazio, useMapas } from "@/novo/components/ui";

export default function Andamentos() {
  const db = useDB();
  const { caso } = useMapas(db);
  const [ver, setVer] = useState<"novos" | "todos">("novos");
  const [area, setArea] = useState("");

  const lista = useMemo(() => db.andamentos.filter((a) => (ver === "todos" || !a.lido) && (!area || caso(a.caso_id)?.area === area)).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 120), [db.andamentos, ver, area, caso]);
  const novos = db.andamentos.filter((a) => !a.lido);

  // casos em andamento sem movimentação há mais de 20 dias
  const parados = useMemo(() => {
    const ult = new Map<string, string>();
    db.andamentos.forEach((a) => { if ((ult.get(a.caso_id) ?? "") < a.data) ult.set(a.caso_id, a.data); });
    return db.casos.filter((c) => c.status === "ativo").map((c) => ({ c, dias: ult.get(c.id) ? -diasAte(ult.get(c.id)!) : null })).filter((x) => x.dias === null || x.dias > 20).sort((a, b) => (b.dias ?? 999) - (a.dias ?? 999)).slice(0, 6);
  }, [db.andamentos, db.casos]);

  return (
    <>
      <Cabecalho titulo="Andamentos" sub="Movimentações de todos os casos, das mais recentes para as mais antigas. As novas ficam marcadas até serem lidas.">
        <select className="inp w-auto" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área"><option value="">Todas as áreas</option>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
        <Seg rotulo="Filtro" valor={ver} aoMudar={setVer} opcoes={[["novos", `Não lidos (${novos.length})`], ["todos", "Todos"]] as const} />
        <button className="btn btn-g" disabled={novos.length === 0} onClick={() => novos.forEach((a) => alterar("andamentos", a.id, { lido: true }))}><CheckCheck />Marcar tudo como lido</button>
      </Cabecalho>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="painel">
          {lista.length === 0 ? <Vazio titulo="Nenhum andamento por ler">As movimentações capturadas nos tribunais e as registradas à mão aparecem aqui.</Vazio> : (
            <ul>{lista.map((a) => {
              const c = caso(a.caso_id);
              return (
                <li key={a.id} className={`grid grid-cols-[84px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-b border-line-2 px-4 py-3 last:border-0 md:grid-cols-[84px_minmax(0,1fr)_minmax(0,300px)_auto] ${a.lido ? "" : "nao-lido"}`}>
                  <span className="text-[12.5px] text-ink-3"><span className="block font-semibold text-ink">{data(a.data)}</span>{quando(a.data)}</span>
                  <div className="min-w-0"><p>{a.descricao}</p><p className="text-[12px] text-ink-3">Fonte: {a.fonte}</p></div>
                  <div className="col-start-2 min-w-0 md:col-start-auto"><LinkCaso caso={c} />{c && <TagArea id={c.area} />}</div>
                  <div className="col-start-2 md:col-start-auto">{!a.lido && <button className="btn btn-g btn-sm" onClick={() => alterar("andamentos", a.id, { lido: true })}>Marcar lido</button>}</div>
                </li>
              );
            })}</ul>
          )}
        </div>
        <aside className="space-y-4">
          <section className="painel">
            <div className="painel-cab"><h2>Casos parados</h2></div>
            {parados.length === 0 ? <Vazio titulo="Nenhum caso parado" /> : (
              <ul>{parados.map(({ c, dias }) => (
                <li key={c.id} className="border-b border-line-2 px-4 py-2.5 last:border-0"><LinkCaso caso={c} /><p className="mt-0.5 text-[12.5px] text-ocre">{dias === null ? "Nenhum andamento registrado" : `Sem movimentação há ${dias} dias`}</p></li>
              ))}</ul>
            )}
            <p className="border-t border-line-2 px-4 py-2.5 text-[12.5px] text-ink-3">Processo parado em cartório costuma pedir despacho com o juízo ou petição de impulso.</p>
          </section>
          <section className="painel p-4 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">De onde vêm os andamentos</p>
            <p className="mt-1">Tribunais (consulta automática pelo número do processo), diários, cartórios e registros feitos à mão. A busca automática roda todo dia às 6h30.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
