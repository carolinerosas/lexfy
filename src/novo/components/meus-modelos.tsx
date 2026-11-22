"use client";
// Documentos com os modelos da Carol (procuração, recibo e os .docx enviados em /modelos),
// preenchidos pelo formulário do JUSTIO antigo com os dados do cliente e do processo.
import { useEffect, useState } from "react";
import Link from "next/link";
import { GerarDocumentoPanel } from "@/components/ui/gerar-documento-panel";
import { getCliente, getProcesso } from "@/lib/store";
import type { Cliente, Processo } from "@/types";

export function MeusModelos({ casoId, clienteId }: { casoId?: string; clienteId: string }) {
  const [cliente, setCliente] = useState<Cliente | null | undefined>(undefined);
  const [processo, setProcesso] = useState<Processo | undefined>(undefined);

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
          : <GerarDocumentoPanel key={cliente.id} cliente={cliente} processoAtual={processo} />}
      </div>
    </section>
  );
}
