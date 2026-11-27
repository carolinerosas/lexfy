"use client";
// Importar: do Cowork (PDF dos autos, com revisão) ou pela Triagem com IA (tela do Justio antigo).
import { useState } from "react";
import TriagemPage from "@/telas/triagem";
import { ImportarCowork } from "@/novo/components/importar-cowork";
import { Cabecalho, Seg } from "@/novo/components/ui";

export default function Importar() {
  const [de, setDe] = useState<"cowork" | "triagem">("cowork");
  return (
    <>
      <Cabecalho titulo="Importar" sub="Do Cowork: cole o que ele extraiu do PDF dos autos, revise e confirme. Triagem: leads e textos soltos, com leitura por IA.">
        <Seg rotulo="Origem" valor={de} aoMudar={setDe} opcoes={[["cowork", "Do Cowork"], ["triagem", "Triagem"]] as const} />
      </Cabecalho>
      {de === "cowork" ? <ImportarCowork /> : <div className="-mx-4 sm:-mx-8"><TriagemPage /></div>}
    </>
  );
}
