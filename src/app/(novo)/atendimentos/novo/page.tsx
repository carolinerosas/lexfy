"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useDB } from "@/novo/lib/store";
import { CamposAtendimento, criarAtendimento, formVazio } from "@/novo/components/atendimento";

export default function PaginaNovoAtendimento() {
  return <Suspense fallback={null}><NovoAtendimentoPagina /></Suspense>;
}

function NovoAtendimentoPagina() {
  const db = useDB();
  const router = useRouter();
  const clienteId = useSearchParams().get("cliente") ?? undefined;
  const [f, setF] = useState(() => formVazio(db, clienteId));
  const pronto = !!f.cliente.trim() && !!f.data;

  function iniciar() {
    if (!pronto) return;
    const id = criarAtendimento(db, f);
    router.replace(`/atendimentos/${id}`);
  }

  return (
    <>
      <Link href={clienteId ? `/clientes/${clienteId}` : "/atendimentos"} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-cobalto"><ChevronLeft className="size-4" />{clienteId ? "Cliente" : "Atendimentos"}</Link>
      <h1 className="titulo mb-1 text-[28px] sm:text-[34px]">Iniciar atendimento</h1>
      <p className="mb-5 text-ink-2">Confirme os dados e comece. As anotações abrem em seguida, na tela inteira.</p>
      <section className="painel max-w-[760px] p-4 sm:p-5">
        <CamposAtendimento f={f} setF={setF} clienteId={clienteId} />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link href={clienteId ? `/clientes/${clienteId}` : "/atendimentos"} className="btn btn-g">Cancelar</Link>
          <button className="btn btn-p" disabled={!pronto} onClick={iniciar}>Iniciar atendimento</button>
        </div>
      </section>
    </>
  );
}
