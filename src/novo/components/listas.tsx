"use client";
import { NotaInfo } from "@/novo/components/ui";
// Gerência das listas que a advogada alimenta (opções dos campos da ficha, tipos de ação, crimes…).
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { AREAS } from "@/novo/lib/areas";
import { guardarNaLista, tirarDaLista, useDB } from "@/novo/lib/store";
import { semAcento } from "@/novo/lib/format";

const ESPECIAIS: Record<string, string> = {
  acoes: "Tipos de ação (captação e orçamento)", canal: "Canal de chegada do contato",
  exec_crime: "Execução: crimes", exec_vara: "Execução: vara de origem", exec_natureza: "Execução: natureza do crime", exec_condicao: "Execução: condição",
  exec_fracao_prog: "Execução: frações de progressão", exec_fracao_lc: "Execução: frações de livramento",
  exec_motivo_remicao: "Execução: motivos de remição", exec_motivo_interrupcao: "Execução: motivos de interrupção ou suspensão",
};

/** Nome legível de cada lista: campos das fichas (por área), tipos de processo e listas especiais. */
function nomesDasListas(): Record<string, string> {
  const m: Record<string, string> = { ...ESPECIAIS };
  for (const a of AREAS) {
    m[`tipo_caso.${a.id}`] = `${a.nome}: tipos de processo ou assuntos`;
    for (const s of a.secoes) for (const c of s.campos) {
      if (c.tipo !== "o" && c.tipo !== "t" && c.tipo !== "m") continue;
      m[c.k] = m[c.k] && !m[c.k].includes(c.rotulo) ? `${m[c.k]} / ${c.rotulo}` : m[c.k] ?? `${c.rotulo} (${a.nome})`;
    }
  }
  return m;
}

export function GerenciarListas() {
  const db = useDB();
  const listas = db.config.listas ?? {};
  const nomes = useMemo(() => nomesDasListas(), []);
  const chaves = useMemo(() => Object.keys(nomes).sort((a, b) => nomes[a].localeCompare(nomes[b])), [nomes]);
  const [chave, setChave] = useState("acoes");
  const [novo, setNovo] = useState("");
  const [filtro, setFiltro] = useState("");
  const usadas = chaves.filter((k) => (listas[k] ?? []).length);
  const visiveis = chaves.filter((k) => !filtro || semAcento(nomes[k]).includes(semAcento(filtro)));
  const itens = listas[chave] ?? [];
  const incluir = () => { if (novo.trim()) { guardarNaLista(chave, novo); setNovo(""); } };

  return (
    <section className="painel">
      <div className="painel-cab"><h2>Listas que você alimenta</h2><span className="text-[12.5px] text-ink-3">{usadas.length} com itens</span></div>
      <div className="space-y-3 p-5">
        <NotaInfo className="">Todo campo de escolha tem “Cadastrar outra opção”, e os campos de lista guardam o que você digita. Aqui você vê, inclui e tira itens de cada lista.</NotaInfo>
        <input className="inp" placeholder="Procurar campo" aria-label="Procurar campo" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <select className="inp" value={chave} aria-label="Lista" onChange={(e) => setChave(e.target.value)}>
          {usadas.length > 0 && <optgroup label="Com itens">{usadas.filter((k) => visiveis.includes(k)).map((k) => <option key={k} value={k}>{nomes[k]} ({listas[k].length})</option>)}</optgroup>}
          <optgroup label="Todas">{visiveis.map((k) => <option key={k} value={k}>{nomes[k]}</option>)}</optgroup>
        </select>
        {itens.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum item próprio nesta lista ainda.</p> : (
          <ul className="flex flex-wrap gap-1.5">{itens.map((it) => (
            <li key={it} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-porcelana py-1 pl-3 pr-1 text-[13px]">
              <span className="min-w-0 break-words">{it}</span>
              <button type="button" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-line-2 hover:text-ink" aria-label={`Tirar ${it}`} onClick={() => tirarDaLista(chave, it)}><X className="size-3.5" /></button>
            </li>
          ))}</ul>
        )}
        <div className="flex gap-2">
          <input className="inp" placeholder="Novo item" aria-label="Novo item" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); incluir(); } }} />
          <button type="button" className="btn btn-g shrink-0" disabled={!novo.trim()} onClick={incluir}><Plus />Incluir</button>
        </div>
      </div>
    </section>
  );
}
