"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Plus, X } from "lucide-react";
import { copiarTexto } from "@/novo/lib/whatsapp";
import { areaDe, type Campo } from "@/novo/lib/areas";
import { Azulejo } from "./azulejo";
import { brl, data, iniciais } from "@/novo/lib/format";
import type { Caso, Colaborador, DB } from "@/novo/lib/types";

export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="titulo text-[34px]">{titulo}</h1>
        {sub && <p className="mt-1 max-w-[70ch] text-ink-2">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Dialogo({ aberto, aoFechar, titulo, children, rodape, largo }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dlg" style={largo ? { width: "min(880px, calc(100vw - 24px))" } : undefined} onClose={aoFechar}
      onClick={(e) => { if (e.target === ref.current) aoFechar(); }}>
      {aberto && (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line-2 px-5 py-3.5">
            <h2 className="titulo text-[20px]">{titulo}</h2>
            <button className="btn btn-g btn-icone btn-sm" onClick={aoFechar} aria-label="Fechar"><X /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-line-2 bg-porcelana px-5 py-3">{rodape}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-[52ch] text-ink-2">{children}</div>}
    </div>
  );
}

export function Avatar({ pessoa, tamanho = 24 }: { pessoa?: Pick<Colaborador, "nome" | "cor">; tamanho?: number }) {
  if (!pessoa) return null;
  return (
    <span title={pessoa.nome} aria-label={pessoa.nome} className="inline-flex shrink-0 items-center justify-center rounded-full bg-cobalto-f font-bold text-ink ring-1 ring-line"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}>
      {iniciais(pessoa.nome)}
    </span>
  );
}

export function TagArea({ id, curto }: { id: string; curto?: boolean }) {
  const a = areaDe(id);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink-2">
      <Azulejo area={a} tamanho={20} />
      {!curto && a.nome}
    </span>
  );
}

export function Seg<T extends string>({ opcoes, valor, aoMudar, rotulo }: { opcoes: readonly (readonly [T, string])[]; valor: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="seg max-w-full overflow-x-auto" role="group" aria-label={rotulo}>
      {opcoes.map(([v, r]) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => aoMudar(v)}>{r}</button>
      ))}
    </div>
  );
}

export function Abas<T extends string>({ abas, valor, aoMudar }: { abas: readonly (readonly [T, string])[]; valor: T; aoMudar: (v: T) => void }) {
  return (
    <div className="abas" role="tablist">
      {abas.map(([v, r]) => (
        <button key={v} role="tab" aria-selected={valor === v} onClick={() => aoMudar(v)}>{r}</button>
      ))}
    </div>
  );
}

export function Rotulado({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

/** Itens de um campo de lista (guardados um por linha). */
export const itensDe = (v: string | number | undefined): string[] => String(v ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** Botão pequeno de copiar, com confirmação. */
export function Copiar({ texto, rotulo = "Copiar", comTexto }: { texto: string; rotulo?: string; comTexto?: boolean }) {
  const [ok, setOk] = useState<"" | "sim" | "nao">("");
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 1800); return () => clearTimeout(t); }, [ok]);
  return (
    <button type="button" className={`btn btn-q btn-sm ${comTexto ? "" : "btn-icone"}`} title={rotulo} aria-label={rotulo}
      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); setOk((await copiarTexto(texto)) ? "sim" : "nao"); }}>
      {ok === "sim" ? <Check /> : <Copy />}{comTexto && (ok === "sim" ? "Copiado" : ok === "nao" ? "Não copiou" : rotulo)}
      {!comTexto && ok && <span role="status" className="sr-only">{ok === "sim" ? "Copiado" : "Não foi possível copiar"}</span>}
    </button>
  );
}

/** Lista editável: inclui um item por vez, com sugestões do que já foi usado. */
export function CampoLista({ valor, aoMudar, sugestoes = [], rotulo }: { valor: string | number | undefined; aoMudar: (v: string) => void; sugestoes?: string[]; rotulo: string }) {
  const itens = itensDe(valor);
  const [novo, setNovo] = useState("");
  const idLista = useId();
  const livres = sugestoes.filter((x) => !itens.some((i) => i.toLowerCase() === x.toLowerCase()));
  const incluir = (t: string) => { const x = t.trim(); if (!x || itens.some((i) => i.toLowerCase() === x.toLowerCase())) { setNovo(""); return; } aoMudar([...itens, x].join("\n")); setNovo(""); };
  return (
    <div>
      {itens.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {itens.map((it, n) => (
            <li key={`${it}-${n}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-porcelana py-1 pl-3 pr-1 text-[13px]">
              <span className="min-w-0 break-words">{it}</span>
              <button type="button" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-line-2 hover:text-ink" aria-label={`Tirar ${it}`} onClick={() => aoMudar(itens.filter((_, k) => k !== n).join("\n"))}><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input className="inp" list={idLista} value={novo} placeholder="Digite e tecle Enter" aria-label={`Incluir em ${rotulo}`}
          onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); incluir(novo); } }} />
        <button type="button" className="btn btn-g shrink-0" disabled={!novo.trim()} onClick={() => incluir(novo)}><Plus />Incluir</button>
      </div>
      {livres.length > 0 && <datalist id={idLista}>{livres.slice(0, 200).map((x) => <option key={x} value={x} />)}</datalist>}
    </div>
  );
}

/** Campo da ficha própria da área (texto, lista, data, valor, opções…). */
export function CampoArea({ campo, valor, aoMudar, sugestoes }: { campo: Campo; valor: string | number | undefined; aoMudar: (v: string | number) => void; sugestoes?: string[] }) {
  const v = valor ?? "";
  const idLista = useId();
  const largo = campo.tipo === "l" || campo.tipo === "m";
  if (campo.tipo === "m") {
    return (
      <div className="sm:col-span-2">
        <span className="rotulo">{campo.rotulo}</span>
        <CampoLista valor={valor} aoMudar={aoMudar} sugestoes={sugestoes} rotulo={campo.rotulo} />
      </div>
    );
  }
  return (
    <Rotulado rotulo={campo.rotulo} className={largo ? "sm:col-span-2" : ""}>
      {campo.tipo === "o" || campo.tipo === "s" ? (
        <select className="inp" value={String(v)} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">Não informado</option>
          {(campo.tipo === "s" ? ["Sim", "Não"] : campo.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : campo.tipo === "l" ? (
        <textarea className="inp" rows={3} value={String(v)} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <>
          <input className="inp" list={campo.tipo === "t" && sugestoes?.length ? idLista : undefined} type={campo.tipo === "d" ? "date" : campo.tipo === "v" || campo.tipo === "n" ? "number" : "text"} step={campo.tipo === "v" ? "0.01" : undefined}
            value={String(v)} onChange={(e) => aoMudar(campo.tipo === "v" || campo.tipo === "n" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
          {campo.tipo === "t" && sugestoes?.length ? <datalist id={idLista}>{sugestoes.slice(0, 200).map((x) => <option key={x} value={x} />)}</datalist> : null}
        </>
      )}
    </Rotulado>
  );
}

export function valorCampo(campo: Campo, v: string | number | undefined): string {
  if (v === undefined || v === "") return "";
  if (campo.tipo === "d") return data(String(v));
  if (campo.tipo === "v") return brl(Number(v));
  if (campo.tipo === "m") return itensDe(v).join("; ");
  return String(v);
}

/** Valores já usados num campo, em todos os casos da área (os mais usados primeiro). */
export function valoresUsados(casos: Caso[], area: string, campo: Campo): string[] {
  const conta = new Map<string, number>();
  for (const c of casos) {
    if (c.area !== area) continue;
    const v = c.dados[campo.k];
    const lista = campo.tipo === "m" ? itensDe(v) : v !== undefined && v !== "" ? [String(v).trim()] : [];
    for (const x of lista) conta.set(x, (conta.get(x) ?? 0) + 1);
  }
  return [...conta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x]) => x);
}

/** Atalhos de consulta sobre o banco. */
export function useMapas(db: DB) {
  return useMemo(() => {
    const casos = new Map(db.casos.map((c) => [c.id, c]));
    const pessoas = new Map(db.equipe.map((p) => [p.id, p]));
    return { caso: (id?: string): Caso | undefined => (id ? casos.get(id) : undefined), pessoa: (id?: string) => (id ? pessoas.get(id) : undefined) };
  }, [db.casos, db.equipe]);
}

export function LinkCaso({ caso }: { caso?: Caso }) {
  if (!caso) return <span className="text-ink-3">Sem caso vinculado</span>;
  return (
    <Link href={`/casos/${caso.id}`} className="group block min-w-0">
      <span className="block truncate font-semibold group-hover:text-cobalto group-hover:underline">{caso.titulo}</span>
      <span className="block truncate text-[12.5px] text-ink-3">{caso.cliente_nome}{caso.numero ? ` · ${caso.numero}` : ""}</span>
    </Link>
  );
}

/** Barras horizontais simples para comparar categorias. */
export function Barras({ itens, formato = (n: number) => String(n) }: { itens: { rotulo: string; valor: number; cor?: string }[]; formato?: (n: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2">{i.rotulo}</span>
          <span className="h-2.5 rounded-full bg-cobalto-f"><span className="block h-2.5 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: i.cor ?? "var(--color-cobalto)" }} /></span>
          <span className="w-20 text-right font-semibold">{formato(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
