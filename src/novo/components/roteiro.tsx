"use client";
// Roteiro da audiência (perguntas, teses, ordem de oitiva). Fica na coluna roteiro da
// tabela audiencias, a mesma do JUSTIO antigo, e aparece também na tela Ao vivo do antigo.
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { RoteiroModal } from "@/components/ui/roteiro-modal";
import { supabase } from "@/lib/supabase";
import { updateAudiencia } from "@/lib/store";

export function BotaoRoteiro({ audienciaId }: { audienciaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [roteiro, setRoteiro] = useState({ texto: "", nome: "" });
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    const { data } = await supabase.from("audiencias").select("roteiro,roteiro_nome").eq("id", audienciaId).maybeSingle();
    setRoteiro({ texto: String(data?.roteiro ?? ""), nome: String(data?.roteiro_nome ?? "") });
    setCarregando(false);
    setAberto(true);
  }

  return (
    <>
      <button className="btn btn-g btn-sm" onClick={abrir} disabled={carregando}><ScrollText />{carregando ? "Abrindo..." : "Roteiro"}</button>
      <RoteiroModal
        open={aberto}
        onClose={() => setAberto(false)}
        roteiro={roteiro.texto}
        nome={roteiro.nome}
        onSalvar={async (texto, nome) => {
          await updateAudiencia(audienciaId, { roteiro: texto || null, roteiro_nome: nome || null });
          setRoteiro({ texto, nome });
        }}
      />
    </>
  );
}
