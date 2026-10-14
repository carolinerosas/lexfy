"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Entrada do Portal do Cliente: CPF + senha.
export default function ClienteEntrarPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const res = await fetch("/api/cliente/entrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cpf, senha }),
    });
    setEnviando(false);
    if (res.ok) router.push("/cliente/painel");
    else setErro(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível entrar.");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Área do Cliente</h1>
      <p className="mt-2 text-sm text-gray-600">Acompanhe o andamento do seu processo.</p>
      <form onSubmit={entrar} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <label className="block text-sm text-gray-700">
          CPF
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            inputMode="numeric"
            autoComplete="username"
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </label>
        <label className="block text-sm text-gray-700">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button disabled={enviando} className="w-full rounded-lg bg-[#21181d] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-xs text-gray-500">
          Primeiro acesso ou esqueceu a senha? Peça um link ao escritório.
        </p>
      </form>
    </div>
  );
}
