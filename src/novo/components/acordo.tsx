"use client";
// Aba "Acordo" do caso: termos do acordo (campos comuns + os da área, em caso.dados) e as
// parcelas, que ficam na tabela acordo_parcelas, a mesma do Justio antigo.
import { useCallback, useEffect, useState } from "react";
import { Link2, Pencil } from "lucide-react";
import { alterar } from "@/novo/lib/store";
import { areaDe, secoesAcordo } from "@/novo/lib/areas";
import { semAcento, brl } from "@/novo/lib/format";
import { CampoArea, Copiar, itensDe, valorCampo } from "@/novo/components/ui";
import { AcordosPanel } from "@/components/ui/acordos-panel";
import { getAcordoParcelas, vincularAcordoAoProcesso } from "@/lib/store";
import type { AcordoParcela } from "@/types";
import type { Caso } from "@/novo/lib/types";

type Grupo = { grupoId: string; titulo: string; total: number; parcelas: number; cliente?: string };

/** Acordos lançados sem processo cujo nome bate com o cliente ou a parte contrária deste caso. */
function soltosDoCaso(todas: AcordoParcela[], caso: Caso): Grupo[] {
    const nomes = [caso.cliente_nome, caso.parte_contraria].filter(Boolean).map((n) => semAcento(String(n)).trim());
    const grupos = new Map<string, Grupo>();
    for (const p of todas) {
      if (p.processo_id) continue;
      const alvo = semAcento(`${p.cliente_nome ?? ""} ${p.titulo ?? ""}`);
      // nome inteiro ou o primeiro nome (o antigo costuma usar "Acordo do Almir")
      const bate = (n: string) => alvo.includes(n) || new RegExp(`\\b${n.split(/\s+/)[0]}\\b`).test(alvo);
      if (!nomes.some((n) => n.length > 3 && bate(n))) continue;
      const g = grupos.get(p.grupo_id) ?? { grupoId: p.grupo_id, titulo: p.titulo || "Acordo", total: 0, parcelas: 0, cliente: p.cliente_nome };
      g.total += Number(p.valor) || 0;
      g.parcelas += 1;
      grupos.set(p.grupo_id, g);
    }
    return [...grupos.values()];
}

function useAcordosSoltos(caso: Caso) {
  const [soltos, setSoltos] = useState<Grupo[]>([]);
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    let vivo = true;
    getAcordoParcelas().catch(() => [] as AcordoParcela[]).then((todas) => { if (vivo) setSoltos(soltosDoCaso(todas, caso)); });
    return () => { vivo = false; };
  }, [caso, rodada]);
  const carregar = useCallback(() => setRodada((r) => r + 1), []);
  return { soltos, carregar };
}

export function AbaAcordo({ caso }: { caso: Caso }) {
  const area = areaDe(caso.area);
  const secoes = secoesAcordo(area);
  const [edit, setEdit] = useState(false);
  const [dados, setDados] = useState(caso.dados);
  const [versao, setVersao] = useState(0);
  const { soltos, carregar } = useAcordosSoltos(caso);
  const [vinculando, setVinculando] = useState("");

  const preenchidos = secoes.flatMap((s) => s.campos).filter((c) => caso.dados[c.k] !== undefined && caso.dados[c.k] !== "").length;

  function salvar() {
    alterar("casos", caso.id, { dados });
    setEdit(false);
  }

  async function vincular(g: Grupo) {
    setVinculando(g.grupoId);
    try {
      await vincularAcordoAoProcesso(g.grupoId, caso.id);
      await carregar();
      setVersao((v) => v + 1);
    } finally {
      setVinculando("");
    }
  }

  return (
    <div className="space-y-4">
      {soltos.map((g) => (
        <div key={g.grupoId} role="status" className="painel flex flex-wrap items-center gap-3 px-4 py-3 text-[13.5px] nao-lido">
          <span className="min-w-0 flex-1">
            Há um acordo lançado no JUSTIO antigo sem processo: <strong>{g.titulo}</strong>
            {g.cliente ? ` (${g.cliente})` : ""}, {g.parcelas} parcela{g.parcelas === 1 ? "" : "s"}, {brl(g.total)}.
          </span>
          <button className="btn btn-p btn-sm" disabled={vinculando === g.grupoId} onClick={() => vincular(g)}>
            <Link2 />{vinculando === g.grupoId ? "Trazendo..." : "Trazer para este caso"}
          </button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {secoes.map((s) => (
            <section key={s.titulo} className="painel">
              <div className="painel-cab"><h2>{s.titulo}</h2></div>
              {edit ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {s.campos.map((c) => <CampoArea key={c.k} campo={c} valor={dados[c.k]} aoMudar={(v) => setDados({ ...dados, [c.k]: v })} />)}
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {s.campos.map((c) => {
                    const v = valorCampo(c, caso.dados[c.k]);
                    const largo = c.tipo === "l" || c.tipo === "m";
                    return (
                      <div key={c.k} className={`min-w-0 border-b border-line-2 px-4 py-2.5 ${largo ? "sm:col-span-2" : ""}`}>
                        <dt className="text-[12px] font-semibold text-ink-3">{c.rotulo}</dt>
                        {!v ? <dd className="text-ink-3">Não informado</dd> : c.tipo === "m" ? (
                          <dd><ul className="mt-0.5 space-y-0.5">{itensDe(caso.dados[c.k]).map((it, n) => <li key={n} className="break-words">• {it}</li>)}</ul></dd>
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
        <aside className="min-w-0">
          <section className="painel p-4">
            <p className="text-[12.5px] text-ink-2">Acordo em {area.nome}: {preenchidos} de {secoes.flatMap((s) => s.campos).length} campos preenchidos.</p>
            {edit ? (
              <div className="mt-3 flex gap-2"><button className="btn btn-p flex-1" onClick={salvar}>Salvar acordo</button><button className="btn btn-g" onClick={() => { setDados(caso.dados); setEdit(false); }}>Cancelar</button></div>
            ) : <button className="btn btn-g mt-3 w-full" onClick={() => { setDados(caso.dados); setEdit(true); }}><Pencil />Editar termos</button>}
          </section>
        </aside>
      </div>

      <section className="painel">
        <div className="painel-cab"><h2>Parcelas</h2></div>
        <div className="p-4">
          <AcordosPanel key={versao} processoId={caso.id} clienteNome={caso.cliente_nome} onChanged={carregar} />
        </div>
      </section>
    </div>
  );
}
