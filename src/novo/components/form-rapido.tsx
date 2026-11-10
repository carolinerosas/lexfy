"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Dialogo, Rotulado } from "./ui";

export type CampoF = {
  k: string; rotulo: string;
  tipo?: "texto" | "numero" | "data" | "hora" | "longo" | "opcoes" | "check";
  opcoes?: readonly (string | readonly [string, string])[];
  obrig?: boolean; largo?: boolean; inicial?: string | number | boolean; dica?: string;
};
export type Valores = Record<string, string | number | boolean>;

const zerado = (campos: readonly CampoF[]): Valores => Object.fromEntries(campos.map((c) => [c.k, c.inicial ?? (c.tipo === "check" ? false : "")]));

/** Formulário em janela, montado a partir de uma lista de campos. */
export function FormRapido({ aberto, aoFechar, titulo, campos, aoSalvar, botao = "Salvar", inicial }: {
  aberto: boolean; aoFechar: () => void; titulo: string; campos: readonly CampoF[]; aoSalvar: (v: Valores) => void; botao?: string; inicial?: Valores;
}) {
  const [v, setV] = useState<Valores>(() => ({ ...zerado(campos), ...inicial }));
  const [erro, setErro] = useState("");
  useEffect(() => { if (aberto) { setV({ ...zerado(campos), ...inicial }); setErro(""); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  function salvar() {
    const falta = campos.find((c) => c.obrig && (v[c.k] === "" || v[c.k] === undefined));
    if (falta) return setErro(`Preencha “${falta.rotulo}”.`);
    const saida: Valores = {};
    campos.forEach((c) => { const x = v[c.k]; if (x !== "" && x !== undefined) saida[c.k] = c.tipo === "numero" ? Number(x) : x; });
    aoSalvar(saida);
    aoFechar();
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo={titulo}
      rodape={<>{erro && <p role="alert" className="mr-auto self-center font-semibold text-perigo">{erro}</p>}<button className="btn btn-g" onClick={aoFechar}>Cancelar</button><button className="btn btn-p" onClick={salvar}>{botao}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((c) => c.tipo === "check" ? (
          <label key={c.k} className={`flex items-center gap-2 ${c.largo ? "sm:col-span-2" : ""}`}><input type="checkbox" className="size-4" checked={!!v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.checked })} />{c.rotulo}</label>
        ) : (
          <Rotulado key={c.k} rotulo={c.rotulo + (c.obrig ? " *" : "")} className={c.largo || c.tipo === "longo" ? "sm:col-span-2" : ""}>
            {c.tipo === "opcoes" ? (
              <select className="inp" value={String(v[c.k] ?? "")} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}>
                <option value="">Escolher</option>
                {(c.opcoes ?? []).map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o[0]} value={o[0]}>{o[1]}</option>)}
              </select>
            ) : c.tipo === "longo" ? (
              <textarea className="inp" value={String(v[c.k] ?? "")} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
            ) : (
              <input className="inp" type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : c.tipo === "hora" ? "time" : "text"} step={c.tipo === "numero" ? "0.01" : undefined}
                value={String(v[c.k] ?? "")} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
            )}
            {c.dica && <span className="mt-1 block text-[12px] text-ink-3">{c.dica}</span>}
          </Rotulado>
        ))}
      </div>
    </Dialogo>
  );
}

/** Botão que abre um formulário rápido. Cuida sozinho de abrir e fechar. */
export function BotaoNovo({ rotulo, titulo, campos, aoSalvar, classe = "btn btn-p", icone = <Plus />, inicial, botao }: {
  rotulo: string; titulo?: string; campos: readonly CampoF[]; aoSalvar: (v: Valores) => void; classe?: string; icone?: ReactNode; inicial?: Valores; botao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className={classe} onClick={() => setAberto(true)}>{icone}{rotulo}</button>
      <FormRapido aberto={aberto} aoFechar={() => setAberto(false)} titulo={titulo ?? rotulo} campos={campos} aoSalvar={aoSalvar} inicial={inicial} botao={botao} />
    </>
  );
}
