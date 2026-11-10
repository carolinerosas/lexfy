"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, Server } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { data, quando } from "@/novo/lib/format";
import { contarPrazo, lerPrazo } from "@/novo/lib/prazo";
import { Cabecalho, LinkCaso, Seg, TagArea, Vazio, useMapas } from "@/novo/components/ui";
import { BotaoNovo } from "@/novo/components/form-rapido";
import { hojeISO } from "@/novo/lib/format";

export default function Publicacoes() {
  const db = useDB();
  const { caso } = useMapas(db);
  const [ver, setVer] = useState<"novas" | "todas" | "sem">("novas");
  const [feito, setFeito] = useState<Record<string, string>>({});

  const lista = useMemo(() => db.publicacoes.filter((p) => ver === "todas" || (ver === "novas" ? !p.lida : !p.caso_id)).sort((a, b) => b.data.localeCompare(a.data)), [db.publicacoes, ver]);

  function lancarPrazo(id: string) {
    const p = db.publicacoes.find((x) => x.id === id);
    const c = caso(p?.caso_id);
    const lido = lerPrazo(p?.prazo_sugerido);
    if (!p || !c || !lido) return;
    const criminal = ["criminal", "juri", "execucao_penal", "inquerito"].includes(c.area);
    const conta = contarPrazo(p.data, lido.dias, criminal ? false : true, true, true);
    incluir("prazos", { caso_id: c.id, titulo: p.prazo_sugerido!.split(":")[0], data: conta.vencimento, fatal: true, concluido: false, prioridade: "alta", responsavel_id: c.responsavel_id, base: `Publicação de ${data(p.data)} no ${p.diario}; contagem a partir de ${data(conta.inicio)}` });
    alterar("publicacoes", id, { lida: true });
    setFeito({ ...feito, [id]: conta.vencimento });
  }

  return (
    <>
      <Cabecalho titulo="Publicações" sub="Intimações dos diários eletrônicos em nome da advogada. A publicação nova fica marcada até ser lida, e o prazo pode ser lançado daqui.">
        <BotaoNovo rotulo="Registrar publicação" classe="btn btn-g" aoSalvar={(v) => incluir("publicacoes", { caso_id: v.caso_id ? String(v.caso_id) : undefined, data: String(v.data ?? hojeISO()), diario: String(v.diario ?? "DJEN"), orgao: String(v.orgao ?? ""), texto: String(v.texto), lida: false, prazo_sugerido: v.prazo ? String(v.prazo) : undefined })}
          campos={[{ k: "caso_id", rotulo: "Caso", tipo: "opcoes", largo: true, opcoes: db.casos.filter((c) => c.natureza === "judicial").map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }, { k: "data", rotulo: "Disponibilizada em", tipo: "data", inicial: hojeISO() }, { k: "diario", rotulo: "Diário", tipo: "opcoes", inicial: "DJEN", opcoes: ["DJEN", "DEJT", "DJe estadual", "DOU"] }, { k: "orgao", rotulo: "Vara ou órgão", largo: true }, { k: "texto", rotulo: "Texto da publicação", tipo: "longo", obrig: true }, { k: "prazo", rotulo: "Prazo (ex.: Réplica: 15 dias úteis)", largo: true, dica: "Com o número de dias, o botão Lançar prazo faz a contagem." }]} />
        <Seg rotulo="Filtro" valor={ver} aoMudar={setVer} opcoes={[["novas", `Não lidas (${db.publicacoes.filter((p) => !p.lida).length})`], ["sem", "Sem caso vinculado"], ["todas", "Todas"]] as const} />
      </Cabecalho>

      <section className="painel mb-4 grid gap-px overflow-hidden bg-line-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="flex items-start gap-3 bg-surface p-4">
          <Server className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-semibold">Busca feita no servidor</p><p className="text-[13px] text-ink-2">A consulta pela OAB roda na nuvem em horários fixos. O computador do escritório pode ficar desligado.</p></div>
        </div>
        {[["DJEN (CNJ)", "Todos os tribunais integrados"], ["DEJT", "Justiça do Trabalho"], ["Diários estaduais", "Tribunais ainda fora do DJEN"]].map(([nome, det]) => (
          <div key={nome} className="bg-surface p-4"><p className="font-semibold">{nome}</p><p className="text-[13px] text-ink-2">{det}</p><p className="mt-1.5"><span className="tag tag-ok">Busca diária no servidor</span></p></div>
        ))}
      </section>

      <div className="painel">
        {lista.length === 0 ? <Vazio titulo={ver === "novas" ? "Nenhuma publicação por ler" : "Nenhuma publicação neste filtro"}>Quando a busca encontrar algo em nome da OAB cadastrada, a publicação aparece aqui.</Vazio> : (
          <ul>{lista.map((p) => {
            const c = caso(p.caso_id);
            return (
              <li key={p.id} className={`grid gap-x-4 gap-y-2 border-b border-line-2 px-4 py-3.5 last:border-0 lg:grid-cols-[minmax(0,1fr)_260px] ${p.lida ? "" : "nao-lido"}`}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3"><span className="tag tag-info">{p.diario}</span><span>{data(p.data)} · {quando(p.data)}</span><span>{p.orgao}</span></p>
                  <p className="mt-1.5 max-w-[78ch]">{p.texto}</p>
                  {p.prazo_sugerido && <p className="mt-1.5 text-[13px]"><span className="font-semibold text-ink">Prazo identificado no texto:</span> {p.prazo_sugerido}</p>}
                  {feito[p.id] && <p role="status" className="mt-1.5 text-[13px] font-semibold text-ok">Prazo lançado para {data(feito[p.id])}. Confira feriados locais antes de confiar na data.</p>}
                </div>
                <div className="flex flex-col gap-2">
                  {c ? <div><LinkCaso caso={c} /><TagArea id={c.area} /></div> : <p className="text-[13px] text-perigo">Sem caso vinculado. Cadastre o processo ou vincule a um existente.</p>}
                  <div className="flex flex-wrap gap-2">
                    {c && p.prazo_sugerido && !feito[p.id] && <button className="btn btn-p btn-sm" onClick={() => lancarPrazo(p.id)}><CalendarPlus />Lançar prazo</button>}
                    {!p.lida && <button className="btn btn-g btn-sm" onClick={() => alterar("publicacoes", p.id, { lida: true })}><Check />Marcar lida</button>}
                  </div>
                </div>
              </li>
            );
          })}</ul>
        )}
      </div>
    </>
  );
}
