"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AREAS, areaDe } from "@/novo/lib/areas";
import { useDB } from "@/novo/lib/store";
import { brlCurto, dataCurta, semAcento } from "@/novo/lib/format";
import { Azulejo } from "./azulejo";
import { Avatar, Cabecalho, Seg, Vazio, valorCampo, useMapas } from "./ui";

export function CasosLista({ natureza }: { natureza: "judicial" | "extrajudicial" }) {
  const db = useDB();
  const { pessoa } = useMapas(db);
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [resp, setResp] = useState("");
  const [status, setStatus] = useState<"ativo" | "todos" | "encerrado">("ativo");
  const areas = AREAS.filter((a) => a.grupo === natureza && db.config.areasAtivas.includes(a.id));

  const ultimo = useMemo(() => {
    const m = new Map<string, string>();
    db.andamentos.forEach((a) => { if ((m.get(a.caso_id) ?? "") < a.data) m.set(a.caso_id, a.data); });
    return m;
  }, [db.andamentos]);
  const naoLidos = useMemo(() => new Set(db.andamentos.filter((a) => !a.lido).map((a) => a.caso_id)), [db.andamentos]);

  const lista = useMemo(() => {
    const t = semAcento(q.trim());
    return db.casos.filter((c) => c.natureza === natureza
      && (!area || c.area === area) && (!resp || c.responsavel_id === resp)
      && (status === "todos" || (status === "ativo" ? c.status === "ativo" || c.status === "suspenso" : c.status === "encerrado" || c.status === "arquivado"))
      && (!t || [c.titulo, c.numero, c.cliente_nome, c.parte_contraria, c.orgao, c.comarca].some((s) => s && semAcento(s).includes(t))))
      .sort((a, b) => (ultimo.get(b.id) ?? "").localeCompare(ultimo.get(a.id) ?? ""));
  }, [db.casos, natureza, area, resp, status, q, ultimo]);

  const judicial = natureza === "judicial";
  return (
    <>
      <Cabecalho titulo={judicial ? "Processos" : "Extrajudicial"}
        sub={judicial ? "Casos em juízo, em inquérito ou ainda a ajuizar. A ficha de cada um segue a área de atuação." : "Cartórios, contratos, consultivo, societário e demais trabalhos fora do Judiciário."} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[340px]">
          <Search className="pointer-events-none absolute left-2.5 top-[9px] size-4 text-ink-3" />
          <input className="inp pl-8" placeholder="Título, número, cliente, parte contrária" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar casos" />
        </label>
        <select className="inp w-auto" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
          <option value="">Todas as áreas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <select className="inp w-auto" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="">Toda a equipe</option>
          {db.equipe.filter((e) => e.areas.length).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <Seg rotulo="Situação" valor={status} aoMudar={setStatus} opcoes={[["ativo", "Em andamento"], ["encerrado", "Encerrados"], ["todos", "Todos"]] as const} />
        <span className="ml-auto text-[12.5px] text-ink-3">{lista.length} {lista.length === 1 ? "caso" : "casos"}</span>
      </div>

      <div className="painel overflow-x-auto">
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum caso com esses filtros">Limpe a busca ou troque a situação. Para cadastrar, use “Novo caso” no topo da tela.</Vazio>
        ) : (
          <table className="tb min-w-[860px]">
            <thead><tr><th>Caso</th><th>Cliente</th><th>Fase</th><th>{judicial ? "Vara e comarca" : "Órgão e cidade"}</th><th>Dado da área</th><th className="num">Valor</th><th>Últ. andamento</th><th>Resp.</th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const a = areaDe(c.area);
                const campoDestaque = a.secoes.flatMap((s) => s.campos).find((f) => a.destaque.includes(f.k) && c.dados[f.k] !== undefined && c.dados[f.k] !== "" && f.k !== a.destaque[0]) ?? a.secoes.flatMap((s) => s.campos).find((f) => a.destaque.includes(f.k) && c.dados[f.k] !== undefined);
                return (
                  <tr key={c.id} className={naoLidos.has(c.id) ? "[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-ocre-v)]" : ""}>
                    <td className="max-w-[320px]">
                      <Link href={`/casos/${c.id}`} className="group flex items-center gap-2.5">
                        <Azulejo area={a} tamanho={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold group-hover:text-cobalto group-hover:underline">{c.titulo}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">{a.nome}{c.numero ? ` · ${c.numero}` : judicial ? " · a ajuizar" : ""}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-[190px] truncate">{c.cliente_nome}</td>
                    <td>
                      <span className="block max-w-[170px] truncate">{a.fases[c.fase]}</span>
                      <span className="mt-1.5 flex gap-0.5" aria-hidden>{a.fases.map((_, i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= c.fase ? "var(--color-cobalto)" : "var(--color-line)" }} />)}</span>
                    </td>
                    <td className="max-w-[180px]"><span className="block truncate">{c.orgao ?? "—"}</span><span className="block truncate text-[12.5px] text-ink-3">{c.comarca}</span></td>
                    <td className="max-w-[200px]">{campoDestaque ? <><span className="block truncate text-[12px] text-ink-3">{campoDestaque.rotulo}</span><span className="block truncate">{valorCampo(campoDestaque, c.dados[campoDestaque.k])}</span></> : "—"}</td>
                    <td className="num">{c.valor ? brlCurto(c.valor) : "—"}</td>
                    <td className="whitespace-nowrap">{ultimo.get(c.id) ? dataCurta(ultimo.get(c.id)) : "—"}{naoLidos.has(c.id) && <span className="tag tag-alerta ml-2">novo</span>}</td>
                    <td><Avatar pessoa={pessoa(c.responsavel_id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
