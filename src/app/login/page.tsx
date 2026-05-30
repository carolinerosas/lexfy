"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { JustioHexIcon } from "@/components/ui/justio-logo";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError("Senha incorreta. Tente novamente.");
        setPassword("");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-white/[0.015] rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5">
            <JustioHexIcon size={72} dark={true} />
          </div>
          <h1 className="text-white text-2xl font-black tracking-[0.28em] uppercase">
            JUSTIO
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-gray-600">
            <span className="flex-1 h-px bg-current opacity-40 w-12" />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
              LEGAL TECH
            </span>
            <span className="flex-1 h-px bg-current opacity-40 w-12" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">Acesso restrito</p>
              <p className="text-gray-500 text-xs">Digite sua senha para continuar</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="Usuário"
              autoFocus
              autoComplete="username"
              className="w-full bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all"
            />
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Senha"
                autoComplete="current-password"
                className="w-full bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-600 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs font-medium px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full bg-white text-gray-900 font-semibold rounded-xl py-3 text-sm transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          caroline@justio.com.br
        </p>
      </div>
    </div>
  );
}
