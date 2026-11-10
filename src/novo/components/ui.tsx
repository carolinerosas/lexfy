"use client";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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

/** Campo da ficha própria da área (texto, data, valor, opções…). */
export function CampoArea({ campo, valor, aoMudar }: { campo: Campo; valor: string | number | undefined; aoMudar: (v: string | number) => void }) {
  const v = valor ?? "";
  const largo = campo.tipo === "l";
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
        <input className="inp" type={campo.tipo === "d" ? "date" : campo.tipo === "v" || campo.tipo === "n" ? "number" : "text"} step={campo.tipo === "v" ? "0.01" : undefined}
          value={String(v)} onChange={(e) => aoMudar(campo.tipo === "v" || campo.tipo === "n" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
      )}
    </Rotulado>
  );
}

export function valorCampo(campo: Campo, v: string | number | undefined): string {
  if (v === undefined || v === "") return "";
  if (campo.tipo === "d") return data(String(v));
  if (campo.tipo === "v") return brl(Number(v));
  return String(v);
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
