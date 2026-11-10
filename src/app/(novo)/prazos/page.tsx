"use client";
import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { data, diaSemana, diasAte, quando } from "@/novo/lib/format";
import { Avatar, Cabecalho, LinkCaso, Seg, TagArea, Vazio, useMapas } from "@/novo/components/ui";

type Filtro = "abertos" | "vencidos" | "hoje" | "semana" | "cumpridos";

export default function Prazos() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [resp, setResp] = useState("");
  const [soFatais, setSoFatais] = useState(false);

  const lista = useMemo(() => db.prazos.filter((p) => {
    const n = diasAte(p.data);
    if (resp && p.responsavel_id !== resp) return false;
    if (soFatais && !p.fatal) return false;
    if (filtro === "cumpridos") return p.concluido;
    if (p.concluido) return false;
    if (filtro === "vencidos") return n < 0;
    if (filtro === "hoje") return n === 0;
    if (filtro === "semana") return n >= 0 && n <= 7;
    return true;
  }).sort((a, b) => (filtro === "cumpridos" ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data))), [db.prazos, filtro, resp, soFatais]);

  const abertos = db.prazos.filter((p) => !p.concluido);
  const conta = { vencidos: abertos.filter((p) => diasAte(p.data) < 0).length, hoje: abertos.filter((p) => diasAte(p.data) === 0).length, semana: abertos.filter((p) => { const n = diasAte(p.data); return n >= 0 && n <= 7; }).length };

  return (
    <>
      <Cabecalho titulo="Prazos" sub="Em ordem de vencimento. Para lançar um prazo, abra o caso e use a aba Prazos e audiências." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg rotulo="Período" valor={filtro} aoMudar={setFiltro} opcoes={[["abertos", `Em aberto (${abertos.length})`], ["vencidos", `Vencidos (${conta.vencidos})`], ["hoje", `Hoje (${conta.hoje})`], ["semana", `7 dias (${conta.semana})`], ["cumpridos", "Cumpridos"]] as const} />
        <select className="inp w-auto" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável"><option value="">Toda a equipe</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
        <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={soFatais} onChange={(e) => setSoFatais(e.target.checked)} />Só fatais</label>
      </div>
      <div className="painel overflow-x-auto">
        {lista.length === 0 ? <Vazio titulo={filtro === "vencidos" ? "Nenhum prazo vencido" : "Nenhum prazo neste filtro"}>Troque o período ou o responsável para ver outros prazos.</Vazio> : (
          <table className="tb min-w-[760px]">
            <thead><tr><th className="w-10" /><th>Vencimento</th><th>Prazo</th><th>Caso</th><th>Área</th><th>Resp.</th></tr></thead>
            <tbody>{lista.map((p) => {
              const n = diasAte(p.data); const c = caso(p.caso_id);
              return (
                <tr key={p.id}>
                  <td><button className={`btn btn-icone btn-sm ${p.concluido ? "btn-g" : "btn-g"}`} aria-label={p.concluido ? "Reabrir prazo" : "Marcar como cumprido"} title={p.concluido ? "Reabrir" : "Marcar como cumprido"} onClick={() => alterar("prazos", p.id, { concluido: !p.concluido })}>{p.concluido ? <RotateCcw /> : <Check />}</button></td>
                  <td className="whitespace-nowrap"><span className="font-semibold">{data(p.data)}</span> <span className="text-ink-3">{diaSemana(p.data)}</span>
                    {!p.concluido && <span className={`tag ml-2 ${n < 0 ? "tag-perigo" : n === 0 ? "tag-alerta" : n <= 3 ? "tag-info" : ""}`}>{quando(p.data)}</span>}</td>
                  <td><span className="font-semibold">{p.titulo}</span>{p.fatal && <span className="ml-2 text-[12px] font-semibold text-perigo">fatal</span>}{p.base && <span className="block text-[12.5px] text-ink-3">{p.base}</span>}</td>
                  <td className="max-w-[300px]"><LinkCaso caso={c} /></td>
                  <td>{c && <TagArea id={c.area} />}</td>
                  <td><Avatar pessoa={pessoa(p.responsavel_id)} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
