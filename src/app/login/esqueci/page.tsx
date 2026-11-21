"use client";

import { useState } from "react";
import Link from "next/link";
import { CascaAcesso, classeBotao, classeErro, classeLink } from "../casca";

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
    <CascaAcesso titulo="Esqueci minha senha" subtitulo="Enviamos para o seu e-mail um link para criar uma senha nova.">
      {estado === "enviado" ? (
        <p role="status" className="rounded-[12px] bg-nevoa px-4 py-3 text-[14px] leading-relaxed text-grafite">
          Link enviado. Ele chega em instantes e vale por 30 minutos. Confira também o spam.
        </p>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={pedirLink} disabled={estado === "enviando"} className={classeBotao}>
            {estado === "enviando" ? "Enviando..." : "Enviar link para o meu e-mail"}
          </button>
          {estado === "erro" && <p role="alert" className={classeErro}>Não consegui enviar. Tente de novo em instantes.</p>}
        </div>
      )}
      <div className="pt-6">
        <Link href="/login" className={classeLink}>
          Voltar para o login
        </Link>
      </div>
    </CascaAcesso>
  );
}
