"use client";

import { useState } from "react";
import Link from "next/link";
import { CascaAcesso, classeBotao, classeCampo } from "../casca";

const SENHA_MIN = 10;

export function FormularioRedefinir({ token }: { token: string }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < SENHA_MIN) return setErro(`A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    if (senha !== confirmacao) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/auth/redefinir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) setPronto(true);
      else setErro(corpo?.error ?? "Não consegui salvar. Tente de novo.");
    } catch {
      setErro("Erro de conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <CascaAcesso titulo="Link incompleto" subtitulo="Abra o link exatamente como chegou no e-mail.">
        <Link href="/login/esqueci" className="text-xs text-gray-400 hover:text-gray-200">Pedir um link novo</Link>
      </CascaAcesso>
    );
  }

  if (pronto) {
    return (
      <CascaAcesso titulo="Senha nova salva" subtitulo="Por segurança, os outros aparelhos foram desconectados.">
        <Link href="/login" className={`${classeBotao} block text-center`}>Entrar no Justio</Link>
      </CascaAcesso>
    );
  }

  return (
    <CascaAcesso titulo="Criar senha nova" subtitulo={`Use pelo menos ${SENHA_MIN} caracteres.`}>
      <form onSubmit={salvar} className="space-y-4">
        <input
          type="password"
          value={senha}
          onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          placeholder="Senha nova"
          autoComplete="new-password"
          autoFocus
          className={classeCampo}
        />
        <input
          type="password"
          value={confirmacao}
          onChange={(e) => { setConfirmacao(e.target.value); setErro(""); }}
          placeholder="Repita a senha nova"
          autoComplete="new-password"
          className={classeCampo}
        />
        {erro && <p className="text-red-400 text-xs font-medium px-1">{erro}</p>}
        <button type="submit" disabled={enviando || !senha || !confirmacao} className={classeBotao}>
          {enviando ? "Salvando..." : "Salvar senha nova"}
        </button>
      </form>
    </CascaAcesso>
  );
}
