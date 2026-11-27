"use client";
// Documentos com os modelos da Carol (procuração, recibo e os .docx enviados em /modelos),
// preenchidos pelo formulário do JUSTIO antigo com os dados do cliente e do processo.
import { useEffect, useState } from "react";
import Link from "next/link";
import { GerarDocumentoPanel } from "@/components/ui/gerar-documento-panel";
import { getCliente, getProcesso } from "@/lib/store";
import type { Cliente, Processo } from "@/types";
import { alterar, lerDB, useDB } from "@/novo/lib/store";
import { marcadoresDoCaso, PREFIXO_DOC } from "@/novo/lib/marcadores";
import { areaDe } from "@/novo/lib/areas";

export function MeusModelos({ casoId, clienteId }: { casoId?: string; clienteId: string }) {
  const [cliente, setCliente] = useState<Cliente | null | undefined>(undefined);
  const [processo, setProcesso] = useState<Processo | undefined>(undefined);
  const db = useDB();
  const caso = casoId ? db.casos.find((c) => c.id === casoId) : undefined;
  const dadosCaso = caso ? marcadoresDoCaso(caso) : undefined;
  /** O que foi digitado e não é campo da ficha fica guardado no caso como doc_<marcador>. */
  function guardar(valores: Record<string, string>) {
    const atual = lerDB().casos.find((c) => c.id === casoId);
    if (!atual) return;
    const daFicha = new Set(areaDe(atual.area).secoes.flatMap((s) => s.campos.map((c) => c.k)));
    const novos = Object.fromEntries(Object.entries(valores).filter(([k, v]) => v && k !== "processo" && !daFicha.has(k)).map(([k, v]) => [`${PREFIXO_DOC}${k}`, v]));
    const daFichaMudados = Object.fromEntries(Object.entries(valores).filter(([k, v]) => v && daFicha.has(k) && !atual.dados[k]));
    if (Object.keys(novos).length || Object.keys(daFichaMudados).length) alterar("casos", atual.id, { dados: { ...atual.dados, ...daFichaMudados, ...novos } });
  }

  useEffect(() => {
    let vivo = true;
    Promise.all([clienteId ? getCliente(clienteId) : Promise.resolve(undefined), casoId ? getProcesso(casoId) : Promise.resolve(undefined)])
      .then(([c, p]) => { if (vivo) { setCliente(c ?? null); setProcesso(p); } })
      .catch(() => { if (vivo) setCliente(null); });
    return () => { vivo = false; };
  }, [casoId, clienteId]);

  return (
    <section className="painel">
      <div className="painel-cab"><h2>Documentos com os meus modelos</h2><Link href="/modelos" className="link text-[13px]">Enviar ou trocar modelos</Link></div>
      <div className="p-4">
        {cliente === undefined ? <p className="text-[13px] text-ink-3">Carregando cadastro do cliente...</p>
          : cliente === null ? <p className="text-[13px] text-ink-3">Vincule um cliente cadastrado para gerar documentos com os dados dele.</p>
          : <GerarDocumentoPanel key={cliente.id} cliente={cliente} processoAtual={processo} dadosCaso={dadosCaso} aoGuardar={caso ? guardar : undefined} />}
      </div>
    </section>
  );
}
