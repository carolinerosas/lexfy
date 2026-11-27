"use client";
import { NotaInfo } from "@/novo/components/ui";
// Orçamentos na tela do cliente: os feitos nos casos e na captação (novo) e os feitos
// pela própria tela do cliente (tabela orcamentos, a mesma do JUSTIO antigo).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDB } from "@/novo/lib/store";
import { brl, data } from "@/novo/lib/format";
import { totalOrcamento } from "@/novo/components/orcamento";
import { OrcamentosPanel } from "@/components/ui/orcamentos-panel";
import { getCliente, getOrcamentos, getProcessosByCliente } from "@/lib/store";
import type { Cliente, Processo } from "@/types";

const SITUACAO: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", aceito: "Aceito", recusado: "Recusado" };

export function OrcamentosDoCliente({ clienteId }: { clienteId: string }) {
  const db = useDB();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);

  useEffect(() => {
    let vivo = true;
    Promise.all([getCliente(clienteId), getProcessosByCliente(clienteId)]).then(([c, ps]) => {
      if (vivo) { setCliente(c ?? null); setProcessos(ps); }
    });
    return () => { vivo = false; };
  }, [clienteId]);

  const casos = db.casos.filter((c) => c.cliente_id === clienteId);
  const doCaso = casos.flatMap((c) => (c.orcamentos ?? []).map((o) => ({ o, origem: c.titulo || c.numero || "Caso", href: `/casos/${c.id}` })));
  const daCaptacao = db.leads
    .filter((l) => l.orcamento && l.convertido_caso_id && casos.some((c) => c.id === l.convertido_caso_id))
    .map((l) => ({ o: l.orcamento!, origem: `Captação: ${l.nome}`, href: "/captacao" }));
  const outros = [...doCaso, ...daCaptacao].sort((a, b) => b.o.criado_em.localeCompare(a.o.criado_em));

  return (
    <section className="painel">
      <div className="painel-cab"><h2>Orçamentos</h2></div>
      {outros.length > 0 && (
        <ul className="border-b border-line-2">
          {outros.map(({ o, origem, href }) => (
            <li key={o.id} className="border-b border-line-2 last:border-0">
              <Link href={href} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-porcelana">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.acoes.join(", ") || "Orçamento"}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">{origem} · {data(o.criado_em)}</span>
                </span>
                <span className="font-semibold">{brl(totalOrcamento(o))}</span>
                <span className={`tag ${o.status === "aceito" ? "tag-ok" : o.status === "recusado" ? "tag-perigo" : ""}`}>{SITUACAO[o.status] ?? o.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="p-4">
        {outros.length > 0 && <NotaInfo className="mb-3">Acima, os orçamentos feitos nos casos e na captação. Abaixo, os feitos por esta tela.</NotaInfo>}
        {cliente ? <OrcamentosPanel cliente={cliente} processos={processos} /> : <p className="text-[13px] text-ink-3">Carregando orçamentos...</p>}
      </div>
    </section>
  );
}

/** No caso: orçamentos feitos pela tela do cliente (ligados a este caso ou ainda sem caso). */
export function OrcamentosDaTelaDoCliente({ clienteId, casoId }: { clienteId: string; casoId: string }) {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof getOrcamentos>>>([]);
  useEffect(() => {
    let vivo = true;
    if (clienteId) getOrcamentos(clienteId).then((os) => { if (vivo) setLista(os.filter((o) => !o.processo_id || o.processo_id === casoId)); }).catch(() => {});
    return () => { vivo = false; };
  }, [clienteId, casoId]);
  if (!lista.length) return null;
  return (
    <section className="painel mb-4">
      <div className="painel-cab"><h2>Orçamentos feitos pela tela do cliente</h2><Link href={`/clientes/${clienteId}`} className="link text-[13px]">Abrir cliente</Link></div>
      <ul>
        {lista.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 px-4 py-2.5 last:border-0">
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{o.descricao}</span><span className="block text-[12.5px] text-ink-3">{data(o.created_at)}{o.processo_id ? "" : " · sem caso"}</span></span>
            <span className="font-semibold">{brl(Number(o.valor_total) || 0)}</span>
            <span className={`tag ${o.status === "aceito" ? "tag-ok" : o.status === "recusado" ? "tag-perigo" : ""}`}>{SITUACAO[o.status] ?? o.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
