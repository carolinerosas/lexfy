"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { incluir, useDB } from "@/novo/lib/store";
import { brl, hojeISO, semAcento } from "@/novo/lib/format";
import { Cabecalho, Dialogo, Rotulado, Seg, TagArea, Vazio } from "@/novo/components/ui";

export default function Clientes() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"todos" | "pf" | "pj">("todos");
  const [novo, setNovo] = useState(false);
  const [letra, setLetra] = useState("");
  const comCliente = useMemo(() => new Set(db.clientes.map((c) => semAcento(c.nome)[0]?.toUpperCase())), [db.clientes]);
  const [f, setF] = useState({ nome: "", tipo: "pf" as "pf" | "pj", documento: "", celular: "", email: "", cidade: "", origem: "" });
  const hoje = hojeISO();

  const linhas = useMemo(() => {
    const t = semAcento(q.trim());
    return db.clientes.filter((c) => (!letra || semAcento(c.nome)[0]?.toUpperCase() === letra) && (tipo === "todos" || c.tipo === tipo) && (!t || semAcento(c.nome).includes(t) || (c.documento ?? "").includes(t))).map((c) => {
      const casos = db.casos.filter((x) => x.cliente_id === c.id);
      const ids = new Set(casos.map((x) => x.id));
      const aberto = db.honorarios.filter((h) => ids.has(h.caso_id) && h.status === "pendente" && h.tipo !== "êxito");
      return { c, casos, aberto: aberto.reduce((s, h) => s + h.valor, 0), atraso: aberto.some((h) => h.vencimento < hoje) };
    }).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
  }, [db.clientes, db.casos, db.honorarios, q, tipo, hoje, letra]);

  return (
    <>
      <Cabecalho titulo="Clientes" sub="Pessoas e empresas atendidas, com os casos e o que cada uma tem a pagar.">
        <button className="btn btn-p" onClick={() => setNovo(true)}><Plus />Novo cliente</button>
      </Cabecalho>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[340px]"><Search className="pointer-events-none absolute left-2.5 top-[9px] size-4 text-ink-3" /><input className="inp pl-8" placeholder="Nome, CPF ou CNPJ" aria-label="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Seg rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={[["todos", "Todos"], ["pf", "Pessoas"], ["pj", "Empresas"]] as const} />
        <span className="ml-auto text-[12.5px] text-ink-3">{linhas.length} clientes</span>
      </div>
      <nav aria-label="Clientes por letra inicial" className="mb-3 flex flex-wrap gap-1">
        <button aria-pressed={letra === ""} onClick={() => setLetra("")} className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${letra === "" ? "bg-ink text-white" : "bg-cobalto-f hover:bg-[#e2e2e2]"}`}>Todos</button>
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
          <button key={l} aria-pressed={letra === l} disabled={!comCliente.has(l)} onClick={() => setLetra(letra === l ? "" : l)} aria-label={`Clientes com a letra ${l}`}
            className={`size-8 rounded-full text-[13px] font-semibold transition-colors ${letra === l ? "bg-ink text-white" : comCliente.has(l) ? "hover:bg-cobalto-f" : "text-[#c4c4c4]"}`}>{l}</button>
        ))}
      </nav>
      <div className="painel overflow-x-auto">
        {linhas.length === 0 ? <Vazio titulo="Nenhum cliente encontrado">Confira a grafia ou cadastre em “Novo cliente”.</Vazio> : (
          <table className="tb min-w-[760px]">
            <thead><tr><th>Cliente</th><th>Contato</th><th>Cidade</th><th>Casos</th><th>Origem</th><th className="num">Em aberto</th></tr></thead>
            <tbody>{linhas.map(({ c, casos, aberto, atraso }) => (
              <tr key={c.id}>
                <td><Link href={`/clientes/${c.id}`} className="font-semibold hover:text-cobalto hover:underline">{c.nome}</Link><span className="block text-[12.5px] text-ink-3">{c.tipo === "pj" ? "Empresa" : "Pessoa física"} · {c.documento ?? "sem documento"}</span></td>
                <td><span className="block">{c.celular ?? "—"}</span><span className="block max-w-[200px] truncate text-[12.5px] text-ink-3">{c.email}</span></td>
                <td>{c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "—"}</td>
                <td><span className="flex flex-wrap items-center gap-1.5">{casos.slice(0, 4).map((x) => <Link key={x.id} href={`/casos/${x.id}`} title={x.titulo}><TagArea id={x.area} curto /></Link>)}<span className="text-[12.5px] text-ink-3">{casos.length}</span></span></td>
                <td>{c.origem ?? "—"}</td>
                <td className="num">{aberto ? <span className={atraso ? "font-semibold text-perigo" : ""}>{brl(aberto)}</span> : "—"}{atraso && <span className="block text-[12px] text-perigo">com atraso</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <Dialogo aberto={novo} aoFechar={() => setNovo(false)} titulo="Novo cliente" rodape={<><button className="btn btn-g" onClick={() => setNovo(false)}>Cancelar</button><button className="btn btn-p" disabled={!f.nome.trim()} onClick={() => { incluir("clientes", { ...f, nome: f.nome.trim(), uf: "RJ", criado_em: hoje }); setNovo(false); setF({ nome: "", tipo: "pf", documento: "", celular: "", email: "", cidade: "", origem: "" }); }}>Cadastrar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Nome ou razão social" className="sm:col-span-2"><input className="inp" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Tipo"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as "pf" | "pj" })}><option value="pf">Pessoa física</option><option value="pj">Empresa</option></select></Rotulado>
          <Rotulado rotulo={f.tipo === "pj" ? "CNPJ" : "CPF"}><input className="inp" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Celular"><input className="inp" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} /></Rotulado>
          <Rotulado rotulo="E-mail"><input className="inp" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Cidade"><input className="inp" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Rotulado>
          <Rotulado rotulo="Como chegou ao escritório"><input className="inp" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} /></Rotulado>
        </div>
      </Dialogo>
    </>
  );
}
