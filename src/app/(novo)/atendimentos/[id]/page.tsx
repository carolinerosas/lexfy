"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { alterar, useDB } from "@/novo/lib/store";
import { data, hora } from "@/novo/lib/format";
import { Vazio } from "@/novo/components/ui";
import { CaixaTexto } from "@/novo/components/ditado";

const minutosDesde = (inicio: string) => Math.round((Date.now() - new Date(inicio).getTime()) / 60000);

export default function PaginaAtendimento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const db = useDB();
  const a = db.atendimentos.find((x) => x.id === id);
  const caso = a?.caso_id ? db.casos.find((c) => c.id === a.caso_id) : undefined;
  const [texto, setTexto] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimo = useRef("");

  // o texto só é lido do atendimento uma vez, quando ele aparece
  const atual = texto ?? a?.notas ?? "";
  useEffect(() => { ultimo.current = atual; }, [atual]);

  function gravar(valor: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    alterar("atendimentos", id, { notas: valor.trim() || undefined });
    setSalvo(true);
  }
  function mudar(v: string) {
    setTexto(v); setSalvo(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => gravar(v), 700);
  }
  // ao sair da página, grava o que estava pendente
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); alterar("atendimentos", id, { notas: ultimo.current.trim() || undefined }); } }, [id]);

  if (!a) return <div className="painel"><Vazio titulo="Atendimento não encontrado"><Link className="font-semibold text-cobalto underline" href="/atendimentos">Voltar para os atendimentos</Link></Vazio></div>;

  const encerrado = a.status !== "agendado";
  function finalizar() {
    gravar(atual);
    const minutos = minutosDesde(a!.data_hora);
    alterar("atendimentos", id, { status: "realizado", ...(minutos >= 1 && minutos <= 600 ? { duracao_min: minutos } : {}) });
    router.push("/atendimentos?ver=realizado");
  }
  function cancelar() { gravar(atual); alterar("atendimentos", id, { status: "cancelado" }); router.push("/atendimentos"); }

  return (
    <>
      <Link href="/atendimentos" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-cobalto"><ChevronLeft className="size-4" />Atendimentos</Link>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="titulo text-[26px] [overflow-wrap:anywhere] sm:text-[34px]">{a.cliente_nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-2">
            <span className="tag">{a.tipo}</span>
            <span>{data(a.data_hora)} às {hora(a.data_hora)} · {a.duracao_min} min</span>
            {caso && <Link href={`/casos/${caso.id}`} className="font-semibold text-ink hover:text-cobalto hover:underline">{caso.titulo}</Link>}
            {encerrado && <span className={`tag ${a.status === "realizado" ? "tag-ok" : "tag-alerta"}`}>{a.status}</span>}
          </p>
        </div>
        {!encerrado && <div className="flex flex-wrap gap-2">
          <button className="btn btn-perigo" onClick={cancelar}>Cancelar atendimento</button>
          <button className="btn btn-p" onClick={finalizar}>Finalizar atendimento</button>
        </div>}
      </header>
      <section className="painel p-3 sm:p-4">
        <CaixaTexto className="inp min-h-[62dvh] w-full" value={atual} aoMudar={mudar} placeholder="Escreva aqui o que está acontecendo no atendimento: relato do cliente, orientações, combinados, próximos passos." />
        <p role="status" className="mt-2 text-[12.5px] text-ink-3">{salvo ? "Anotações salvas." : "Salvando…"}</p>
      </section>
    </>
  );
}
