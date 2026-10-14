"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// Primeiro acesso (ou nova senha) pelo link enviado pelo escritório.
export default function ClienteConvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "invalido" | "ok">("carregando");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/cliente/convite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j: { valido: boolean; nome?: string }) => {
        setNome(j.nome ?? "");
        setEstado(j.valido ? "ok" : "invalido");
      })
      .catch(() => setEstado("invalido"));
  }, [token]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha !== senha2) return setErro("As senhas não são iguais.");
    setEnviando(true);
    const res = await fetch("/api/cliente/convite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, cpf, senha, aceito }),
    });
    setEnviando(false);
    if (res.ok) router.push("/cliente/painel");
    else setErro(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível salvar.");
  }

  if (estado === "carregando") return <p className="text-sm text-gray-500">Carregando…</p>;
  if (estado === "invalido") {
    return (
      <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Link expirado</h1>
        <p className="mt-2 text-sm text-gray-600">Este link já foi usado ou expirou. Peça um novo ao escritório pelo WhatsApp.</p>
      </div>
    );
  }

  const campo = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base";
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Olá{nome ? `, ${nome}` : ""}!</h1>
      <p className="mt-2 text-sm text-gray-600">Crie sua senha para acompanhar o processo pela Área do Cliente.</p>
      <form onSubmit={salvar} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <label className="block text-sm text-gray-700">
          Confirme seu CPF
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" autoComplete="username" className={campo} />
        </label>
        <label className="block text-sm text-gray-700">
          Nova senha (mínimo 8, com letras e números)
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className={campo} />
        </label>
        <label className="block text-sm text-gray-700">
          Repita a senha
          <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" className={campo} />
        </label>
        <div className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          <p className="font-semibold text-gray-800">Termos de uso e privacidade</p>
          <p className="mt-1">
            Esta área mostra informações protegidas por sigilo profissional, liberadas pela advogada para você. Seu acesso é pessoal:
            não compartilhe sua senha. Registramos data e hora dos acessos para sua segurança. Seus dados são tratados apenas para a
            prestação dos serviços jurídicos, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), e você pode pedir
            informações ou o encerramento do acesso a qualquer momento pelo WhatsApp do escritório. As informações daqui não
            substituem a orientação da advogada.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1" />
          Li e aceito os termos de uso e privacidade.
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button disabled={enviando} className="w-full rounded-lg bg-[#21181d] py-3 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? "Salvando…" : "Criar senha e entrar"}
        </button>
      </form>
    </div>
  );
}
