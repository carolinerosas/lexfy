"use client";

import { useState } from "react";
import Link from "next/link";
import { CascaAcesso, classeBotao } from "../casca";

export default function EsqueciPage() {
  const [estado, setEstado] = useState<"inicio" | "enviando" | "enviado" | "erro">("inicio");

  async function pedirLink() {
    setEstado("enviando");
    try {
      const res = await fetch("/api/auth/esqueci", { method: "POST" });
      setEstado(res.ok ? "enviado" : "erro");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <CascaAcesso titulo="Esqueceu sua senha?" subtitulo="Vamos mandar um link para criar uma senha nova no seu Telegram.">
      {estado === "enviado" ? (
        <p className="text-gray-300 text-sm leading-relaxed">
          Pronto! Se estiver tudo certo, o link chega no seu Telegram em instantes. Ele vale por 30 minutos.
        </p>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={pedirLink} disabled={estado === "enviando"} className={classeBotao}>
            {estado === "enviando" ? "Enviando..." : "Enviar link para o meu Telegram"}
          </button>
          {estado === "erro" && <p className="text-red-400 text-xs font-medium px-1">Não consegui enviar. Tente de novo em instantes.</p>}
        </div>
      )}
      <div className="text-center pt-5">
        <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Voltar para o login
        </Link>
      </div>
    </CascaAcesso>
  );
}
