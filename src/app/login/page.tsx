"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { CascaAcesso, classeBotao, classeCampo, classeErro, classeLink } from "./casca";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [lembrar, setLembrar] = useState(false);
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
        body: JSON.stringify({ username, password, lembrar }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(res.status === 429 && corpo?.error ? corpo.error : "Usuário ou senha não conferem. Confira e tente de novo.");
        setPassword("");
      }
    } catch {
      setError("Sem conexão com o servidor. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CascaAcesso titulo="Acesse o escritório" subtitulo="Entre com seu usuário e senha.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="usuario" className="mb-1.5 block text-[13px] font-semibold text-grafite">Usuário</label>
          <input
            id="usuario"
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            autoFocus
            autoComplete="username"
            className={classeCampo}
          />
        </div>
        <div>
          <label htmlFor="senha" className="mb-1.5 block text-[13px] font-semibold text-grafite">Senha</label>
          <div className="relative">
            <input
              id="senha"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete="current-password"
              className={`${classeCampo} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ardosia transition-colors hover:bg-nevoa hover:text-tinta"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-grafite">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="size-4 rounded accent-[#0E1013]"
            />
            Permanecer conectado
          </label>
          <Link href="/login/esqueci" className={classeLink}>Esqueci minha senha</Link>
        </div>

        {error && <p role="alert" className={classeErro}>{error}</p>}

        <button type="submit" disabled={loading || !username.trim() || !password.trim()} className={`${classeBotao} mt-2`}>
          {loading ? "Entrando..." : "Acessar o escritório"}
        </button>
      </form>
    </CascaAcesso>
  );
}
