"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { useDB } from "@/novo/lib/store";
import { AREA_POR_ID } from "@/novo/lib/areas";
import { brlCurto, diasAte } from "@/novo/lib/format";
import { Azulejo, estiloTinta } from "@/novo/components/azulejo";
import { Abas, Avatar, Vazio, valorCampo, useMapas } from "@/novo/components/ui";
import { NovoCaso } from "@/novo/components/novo-caso";

const TIPO = { t: "Texto", l: "Texto longo", d: "Data", v: "Valor", n: "Número", s: "Sim ou não", o: "Opções" } as const;

export default function PaginaArea() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const { pessoa } = useMapas(db);
  const [aba, setAba] = useState<"quadro" | "ficha" | "prazos">("quadro");
  const [novo, setNovo] = useState(false);
  const area = AREA_POR_ID[id];
  if (!area) return <div className="painel"><Vazio titulo="Área não encontrada"><Link className="font-semibold text-cobalto underline" href="/areas">Ver todas as áreas</Link></Vazio></div>;

  const casos = db.casos.filter((c) => c.area === id && c.status !== "arquivado");
  const ids = new Set(casos.map((c) => c.id));
  const recebido = db.honorarios.filter((h) => ids.has(h.caso_id) && h.status === "recebido").reduce((s, h) => s + h.valor, 0);
  const prazosAbertos = db.prazos.filter((p) => ids.has(p.caso_id) && !p.concluido);
  const equipe = db.equipe.filter((e) => e.areas.includes(id));
  const campos = area.secoes.flatMap((s) => s.campos);

  return (
    <div style={estiloTinta(area.tinta)}>
      <Link href="/areas" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-cobalto"><ChevronLeft className="size-4" />Áreas de atuação</Link>
      <header className="painel overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-3"><Azulejo area={area} tamanho={44} /><span className="tag tag-tinta">{area.grupo === "judicial" ? "Judicial" : "Extrajudicial"}</span></p>
            <h1 className="titulo mt-3 text-[38px]">{area.nome}</h1>
            <p className="mt-1 max-w-[70ch] text-ink-2">{area.resumo}</p>
          </div>
          <button className="btn btn-p" onClick={() => setNovo(true)}><Plus />Novo caso nesta área</button>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-line-2 bg-line-2 md:grid-cols-4">
          {([["Casos em andamento", String(casos.filter((c) => c.status === "ativo").length)], ["Prazos em aberto", `${prazosAbertos.length}${prazosAbertos.some((p) => diasAte(p.data) < 0) ? " (há vencido)" : ""}`], ["Valor em discussão", casos.some((c) => c.valor) ? brlCurto(casos.reduce((s, c) => s + (c.valor ?? 0), 0)) : "Sem valor de causa"], ["Honorários recebidos", brlCurto(recebido)]] as const).map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3"><dt className="text-[12px] font-semibold text-ink-3">{k}</dt><dd className="titulo text-[22px]">{v}</dd></div>
          ))}
        </dl>
      </header>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <Abas valor={aba} aoMudar={setAba} abas={[["quadro", "Casos por fase"], ["ficha", `Ficha da área (${campos.length} campos)`], ["prazos", "Prazos de referência"]] as const} />
        <p className="flex items-center gap-2 pb-2 text-[12.5px] text-ink-3">Equipe da área {equipe.map((e) => <Avatar key={e.id} pessoa={e} tamanho={22} />)}</p>
      </div>

      <div className="mt-4">
        {aba === "quadro" && (casos.length === 0 ? <div className="painel"><Vazio titulo="Nenhum caso nesta área ainda">Cadastre o primeiro em “Novo caso nesta área”. A ficha já abre com os campos de {area.nome}.</Vazio></div> : (
          <div className="overflow-x-auto pb-2">
            <ol className="flex min-w-max gap-3">
              {area.fases.map((f, i) => {
                const itens = casos.filter((c) => c.fase === i);
                return (
                  <li key={f} className="w-[236px] shrink-0 rounded-[16px] bg-porcelana">
                    <h2 className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-3 text-[12.5px] font-semibold"><span className="truncate">{f}</span><span className="tag">{itens.length}</span></h2>
                    <ul className="min-h-[72px] space-y-2 p-2">
                      {itens.map((c) => {
                        const d = campos.find((x) => area.destaque.slice(1).includes(x.k) && c.dados[x.k] !== undefined && c.dados[x.k] !== "");
                        return (
                          <li key={c.id}><Link href={`/casos/${c.id}`} className="block rounded-[12px] border border-line bg-surface p-3 transition-colors hover:border-ink">
                            <span className="block text-[13px] font-semibold leading-snug">{c.titulo}</span>
                            <span className="mt-1 block truncate text-[12.5px] text-ink-3">{c.cliente_nome}</span>
                            {d && <span className="mt-1.5 block truncate text-[12px] text-ink-2"><span className="text-ink-3">{d.rotulo}:</span> {valorCampo(d, c.dados[d.k])}</span>}
                            <span className="mt-2 flex items-center justify-between"><Avatar pessoa={pessoa(c.responsavel_id)} tamanho={20} />{c.valor ? <span className="text-[12px] text-ink-3">{brlCurto(c.valor)}</span> : null}</span>
                          </Link></li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}

        {aba === "ficha" && (
          <div className="grid gap-4 md:grid-cols-2">
            {area.secoes.map((s) => (
              <section key={s.titulo} className="painel">
                <div className="painel-cab"><h2>{s.titulo}</h2><span className="text-[12.5px] text-ink-3">{s.campos.length} campos</span></div>
                <ul>{s.campos.map((c) => (
                  <li key={c.k} className="flex items-baseline justify-between gap-3 border-b border-line-2 px-4 py-2 last:border-0">
                    <span>{c.rotulo}{c.opcoes && <span className="block text-[12.5px] text-ink-3">{c.opcoes.join(" · ")}</span>}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{TIPO[c.tipo]}</span>
                  </li>
                ))}</ul>
              </section>
            ))}
          </div>
        )}

        {aba === "prazos" && (
          <section className="painel overflow-x-auto">
            <table className="tb"><thead><tr><th>Ato</th><th>Prazo</th><th>Base legal</th></tr></thead>
              <tbody>{area.prazos.map((p) => <tr key={p.nome}><td className="font-semibold">{p.nome}</td><td>{p.prazo}</td><td className="text-ink-2">{p.base}</td></tr>)}</tbody></table>
            <p className="border-t border-line-2 px-4 py-2.5 text-[12.5px] text-ink-3">Tabela de consulta rápida. A lei pode ter mudado e o caso concreto pode ter regra própria: confira antes de contar.</p>
          </section>
        )}
      </div>
      <NovoCaso key={id} aberto={novo} aoFechar={() => setNovo(false)} areaInicial={id} />
    </div>
  );
}
