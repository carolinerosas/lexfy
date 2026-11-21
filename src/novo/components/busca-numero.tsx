"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { buscarCapa, numeroCompleto, type CapaProcesso } from "@/novo/lib/busca-processo";

/**
 * Ao completar os 20 dígitos do número CNJ, busca a capa do processo no DataJud
 * e devolve o que achou para completar o cadastro. Também tem botão para buscar de novo.
 */
export function BuscaNumero({ numero, aoAchar, auto = true }: { numero: string; aoAchar: (c: CapaProcesso) => void; auto?: boolean }) {
  const [estado, setEstado] = useState<{ st: "" | "buscando" | "ok" | "erro"; msg?: string }>({ st: "" });
  const ultimo = useRef("");
  const cb = useRef(aoAchar);
  useEffect(() => { cb.current = aoAchar; });

  async function buscar(n: string) {
    ultimo.current = n.replace(/\D/g, "");
    setEstado({ st: "buscando" });
    try {
      const c = await buscarCapa(n);
      if (ultimo.current !== n.replace(/\D/g, "")) return;
      cb.current(c);
      setEstado({ st: "ok", msg: [c.classe, c.orgao, c.assuntos.length ? `${c.assuntos.length} assunto(s)` : ""].filter(Boolean).join(" · ") || "Processo encontrado" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setEstado({ st: "erro", msg: /timeout|aborted|fetch failed|network/i.test(msg) ? "O CNJ não respondeu a tempo. Tente de novo em instantes." : msg || "Não consegui consultar o CNJ." });
    }
  }

  useEffect(() => {
    const d = numero.replace(/\D/g, "");
    if (auto && numeroCompleto(numero) && d !== ultimo.current) { const t = setTimeout(() => buscar(numero), 400); return () => clearTimeout(t); }
  }, [numero, auto]);

  if (!numeroCompleto(numero)) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
      {estado.st === "buscando" ? <span className="text-ink-3">Buscando dados do processo no CNJ…</span>
        : estado.st === "ok" ? <span className="text-ink-2">Completado com o CNJ: {estado.msg}</span>
        : estado.st === "erro" ? <span className="text-perigo">{estado.msg}</span> : null}
      {estado.st !== "buscando" && <button type="button" className="btn btn-q btn-sm" onClick={() => buscar(numero)}><Search />{estado.st ? "Buscar de novo" : "Buscar dados do processo"}</button>}
    </span>
  );
}
