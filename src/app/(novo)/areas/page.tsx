"use client";
import Link from "next/link";
import { AREAS } from "@/novo/lib/areas";
import { useDB } from "@/novo/lib/store";
import { Azulejo } from "@/novo/components/azulejo";
import { Cabecalho } from "@/novo/components/ui";

export default function Areas() {
  const db = useDB();
  const grupo = (g: "judicial" | "extrajudicial") => AREAS.filter((a) => a.grupo === g);
  const conta = (id: string) => db.casos.filter((c) => c.area === id && c.status === "ativo").length;

  return (
    <>
      <Cabecalho titulo="Áreas de atuação" sub="Cada área tem ficha própria, fases próprias e tabela de prazos. A sigla da área acompanha o caso em todas as telas: preta nas judiciais, com contorno nas extrajudiciais." />
      {(["judicial", "extrajudicial"] as const).map((g) => (
        <section key={g} className="mb-8">
          <h2 className="titulo mb-3 text-[20px]">{g === "judicial" ? "Judicial" : "Extrajudicial"} <span className="font-normal text-ink-3">· {grupo(g).length} áreas</span></h2>
          <ul className="grid gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-2">
            {grupo(g).map((a) => {
              const ativa = db.config.areasAtivas.includes(a.id); const n = conta(a.id);
              return (
                <li key={a.id} className="bg-surface">
                  <Link href={`/areas/${a.id}`} className={`group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 p-4 pr-5 transition-colors hover:bg-porcelana ${ativa ? "" : "opacity-55"}`}>
                    <Azulejo area={a} tamanho={48} />
                    <span className="min-w-0">
                      <span className="titulo block text-[16px] group-hover:underline">{a.nome}</span>
                      <span className="line-clamp-2 text-[13px] text-ink-2">{a.resumo}</span>
                    </span>
                    <span className="text-right">{ativa ? <><span className="titulo block text-[24px]">{n}</span><span className="text-[12px] text-ink-3">{n === 1 ? "caso" : "casos"}</span></> : <span className="tag">Desativada</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[13px] text-ink-2">Para esconder as áreas em que o escritório não atua, use <Link href="/configuracoes" className="font-semibold text-cobalto underline">Configurações</Link>.</p>
    </>
  );
}
