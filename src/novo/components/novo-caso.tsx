"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AREAS, areaDe, secaoVisivel, tipoDoCaso } from "@/novo/lib/areas";
import { incluir, useDB } from "@/novo/lib/store";
import { hojeISO, semAcento } from "@/novo/lib/format";
import { Azulejo } from "./azulejo";
import { CampoArea, Dialogo, Rotulado } from "./ui";

const INICIAL = { area: "", titulo: "", cliente: "", numero: "", orgao: "", comarca: "", contraria: "", valor: "", responsavel: "" };

export function NovoCaso({ aberto, aoFechar, areaInicial, preenchido, aoCriar }: { aberto: boolean; aoFechar: () => void; areaInicial?: string; preenchido?: Partial<typeof INICIAL>; aoCriar?: (id: string) => void }) {
  const db = useDB();
  const router = useRouter();
  const [f, setF] = useState({ ...INICIAL, area: areaInicial ?? "", ...preenchido });
  const [dados, setDados] = useState<Record<string, string | number>>({});
  const [erro, setErro] = useState("");
  const ativas = useMemo(() => AREAS.filter((a) => db.config.areasAtivas.includes(a.id)), [db.config.areasAtivas]);
  const area = f.area ? areaDe(f.area) : undefined;
  const campo = (k: keyof typeof INICIAL) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  function fechar() { setF({ ...INICIAL, area: areaInicial ?? "" }); setDados({}); setErro(""); aoFechar(); }
  function salvar() {
    if (!area) return setErro("Escolha a área de atuação.");
    if (!f.titulo.trim()) return setErro("Informe um título para o caso.");
    if (!f.cliente.trim()) return setErro("Informe o cliente.");
    let cli = db.clientes.find((c) => semAcento(c.nome) === semAcento(f.cliente.trim()));
    const cliId = cli?.id ?? incluir("clientes", { nome: f.cliente.trim(), tipo: "pf", criado_em: hojeISO() });
    const resp = f.responsavel || db.equipe.find((e) => e.areas.includes(area.id))?.id || db.equipe[0]?.id || "";
    const id = incluir("casos", {
      natureza: area.grupo, area: area.id, numero: f.numero.trim(), titulo: f.titulo.trim(), status: "ativo", fase: 0,
      orgao: f.orgao.trim() || undefined, comarca: f.comarca.trim() || undefined, uf: "RJ", cliente_id: cliId, cliente_nome: cli?.nome ?? f.cliente.trim(),
      parte_contraria: f.contraria.trim() || undefined, valor: f.valor ? Number(f.valor) : undefined, responsavel_id: resp, dados, criado_em: hojeISO(),
    });
    fechar();
    if (aoCriar) aoCriar(id);
    else router.push(`/casos/${id}`);
  }

  return (
    <Dialogo aberto={aberto} aoFechar={fechar} titulo="Novo caso" largo
      rodape={<>{erro && <p role="alert" className="mr-auto self-center font-semibold text-perigo">{erro}</p>}<button className="btn btn-g" onClick={fechar}>Cancelar</button><button className="btn btn-p" onClick={salvar}>Criar caso</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Rotulado rotulo="Área de atuação" className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            {area && <Azulejo area={area} tamanho={34} />}
            <select className="inp" {...campo("area")} onChange={(e) => { setF({ ...f, area: e.target.value }); setDados({}); }}>
              <option value="">Escolha a área</option>
              <optgroup label="Judicial">{ativas.filter((a) => a.grupo === "judicial").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</optgroup>
              <optgroup label="Extrajudicial">{ativas.filter((a) => a.grupo === "extrajudicial").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</optgroup>
            </select>
          </div>
        </Rotulado>
        <Rotulado rotulo="Título do caso" className="sm:col-span-2"><input className="inp" {...campo("titulo")} placeholder="Ex.: Divórcio litigioso com guarda e alimentos" /></Rotulado>
        <Rotulado rotulo="Cliente">
          <input className="inp" list="lista-clientes" {...campo("cliente")} placeholder="Nome (novo ou já cadastrado)" />
          <datalist id="lista-clientes">{db.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </Rotulado>
        <Rotulado rotulo="Parte contrária"><input className="inp" {...campo("contraria")} /></Rotulado>
        {area?.grupo !== "extrajudicial" && <Rotulado rotulo="Número do processo (CNJ)"><input className="inp" {...campo("numero")} placeholder="Deixe em branco se ainda não foi ajuizado" /></Rotulado>}
        <Rotulado rotulo={area?.grupo === "extrajudicial" ? "Cartório, câmara ou órgão" : "Vara ou órgão"}><input className="inp" {...campo("orgao")} /></Rotulado>
        <Rotulado rotulo="Comarca ou cidade"><input className="inp" {...campo("comarca")} /></Rotulado>
        <Rotulado rotulo="Valor da causa ou do contrato (R$)"><input className="inp" type="number" step="0.01" {...campo("valor")} /></Rotulado>
        <Rotulado rotulo="Responsável">
          <select className="inp" {...campo("responsavel")}>
            <option value="">Definir pela área</option>
            {db.equipe.filter((e) => e.ativo).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Rotulado>
      </div>
      {area?.tipos && (
        <Rotulado rotulo={`Tipo de processo em ${area.nome}`} className="mt-3">
          <select className="inp" value={String(dados.tipo_caso ?? "")} onChange={(e) => setDados({ ...dados, tipo_caso: e.target.value })}>
            <option value="">Escolher</option>
            {area.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Rotulado>
      )}
      {area && area.secoes.filter((s) => secaoVisivel(s, tipoDoCaso(area, dados), dados)).map((s, i) => (
        <details key={s.titulo} open={i === 0} className="mt-4 border-t border-line-2 pt-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold">Ficha de {area.nome}: {s.titulo}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {s.campos.map((c) => <CampoArea key={c.k} campo={c} valor={dados[c.k]} aoMudar={(v) => setDados({ ...dados, [c.k]: v })} />)}
          </div>
        </details>
      ))}
    </Dialogo>
  );
}
