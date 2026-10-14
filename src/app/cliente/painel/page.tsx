"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Painel do cliente: só os processos e o que a Carol liberou.

interface ProcessoCliente {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  vara?: string;
  comarca?: string;
  uf?: string;
  andamentos: { id: string; data: string; texto: string }[];
  audiencias: { id: string; titulo: string; data_hora: string; local?: string; realizada: boolean }[];
}

function data(iso: string): string {
  const [d] = (iso ?? "").split("T");
  const [a, m, dia] = d.split("-");
  return dia ? `${dia}/${m}/${a}` : iso;
}

function dataHora(iso: string): string {
  const hora = (iso ?? "").split("T")[1]?.slice(0, 5);
  return `${data(iso)}${hora ? ` às ${hora}` : ""}`;
}

const STATUS: Record<string, string> = { ativo: "Em andamento", suspenso: "Suspenso", arquivado: "Arquivado", encerrado: "Encerrado" };

export default function ClientePainelPage() {
  const router = useRouter();
  const [dados, setDados] = useState<{ nome: string; processos: ProcessoCliente[] } | null>(null);

  useEffect(() => {
    fetch("/api/cliente/dados", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) return router.replace("/cliente");
      setDados(await r.json());
    });
  }, [router]);

  async function sair() {
    await fetch("/api/cliente/sair", { method: "POST" });
    router.replace("/cliente");
  }

  if (!dados) return <p className="text-sm text-gray-500">Carregando…</p>;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Olá, {dados.nome.split(" ")[0]}!</h1>
          <p className="mt-1 text-sm text-gray-600">Aqui está o andamento do que o escritório acompanha para você.</p>
        </div>
        <button onClick={sair} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
          Sair
        </button>
      </div>

      {dados.processos.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-sm text-gray-600 shadow-sm">Ainda não há processos liberados para você.</div>
      )}

      {dados.processos.map((p) => {
        const proximas = p.audiencias.filter((a) => !a.realizada && a.data_hora.slice(0, 10) >= hoje);
        return (
          <section key={p.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{STATUS[p.status] ?? p.status}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">{p.titulo}</h2>
            <p className="text-sm text-gray-500">
              {p.numero}
              {p.vara || p.comarca ? ` · ${[p.vara, p.comarca, p.uf].filter(Boolean).join(" · ")}` : ""}
            </p>

            {proximas.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Próximas audiências</p>
                {proximas.map((a) => (
                  <p key={a.id} className="mt-1 text-sm text-amber-900">
                    {a.titulo}: {dataHora(a.data_hora)}
                    {a.local ? ` · ${a.local}` : ""}
                  </p>
                ))}
              </div>
            )}

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Andamentos</h3>
            {p.andamentos.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Ainda não há andamentos liberados.</p>
            ) : (
              <ol className="mt-2 space-y-3 border-l-2 border-gray-200 pl-4">
                {p.andamentos.map((m) => (
                  <li key={m.id}>
                    <p className="text-xs text-gray-500">{data(m.data)}</p>
                    <p className="whitespace-pre-line text-sm text-gray-800">{m.texto}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
