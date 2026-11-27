"use client";
import { useMemo, useState } from "react";
import { alterar, useDB } from "@/novo/lib/store";
import { brl, data, diaSemana, hora } from "@/novo/lib/format";
import { Avatar, Cabecalho, LinkCaso, Seg, Vazio, useMapas } from "@/novo/components/ui";
import { NovoAtendimento, SessaoAtendimento } from "@/novo/components/atendimento";
import type { Atendimento } from "@/novo/lib/types";

export default function Atendimentos() {
  const db = useDB();
  const { caso, pessoa } = useMapas(db);
  const [ver, setVer] = useState<Atendimento["status"]>("agendado");
  const [anotando, setAnotando] = useState<string | null>(null);
  const lista = useMemo(() => db.atendimentos.filter((a) => a.status === ver).sort((a, b) => (ver === "agendado" ? a.data_hora.localeCompare(b.data_hora) : b.data_hora.localeCompare(a.data_hora))), [db.atendimentos, ver]);

  return (
    <>
      <Cabecalho titulo="Atendimentos" sub="Consultas, retornos, preparação de audiência e visitas a clientes presos.">
        <Seg rotulo="Situação" valor={ver} aoMudar={setVer} opcoes={[["agendado", "Agendados"], ["realizado", "Realizados"], ["cancelado", "Cancelados"]] as const} />
        <NovoAtendimento modo="agora" /><NovoAtendimento modo="agendar" classe="btn btn-g" />
      </Cabecalho>
      <div className="painel overflow-x-auto">
        {lista.length === 0 ? <Vazio titulo="Nenhum atendimento nesta situação">Use “Agendar” para marcar o próximo.</Vazio> : (
          <table className="tb min-w-[760px]">
            <thead><tr><th>Quando</th><th>Cliente</th><th>Tipo</th><th>Caso</th><th className="num">Valor</th><th>Resp.</th><th /></tr></thead>
            <tbody>{lista.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap"><span className="font-semibold">{data(a.data_hora)}</span> <span className="text-ink-3">{diaSemana(a.data_hora)}</span><span className="block text-[12.5px] text-ink-3">{hora(a.data_hora)} · {a.duracao_min} min</span></td>
                <td className="font-semibold">{a.cliente_nome}{a.notas && <span className="block max-w-[280px] truncate text-[12.5px] font-normal text-ink-3">{a.notas}</span>}</td>
                <td><span className={`tag ${a.tipo === "visita à unidade prisional" ? "tag-alerta" : ""}`}>{a.tipo}</span></td>
                <td className="max-w-[240px]">{a.caso_id ? <LinkCaso caso={caso(a.caso_id)} /> : <span className="text-ink-3">-</span>}</td>
                <td className="num">{a.valor ? brl(a.valor) : "-"}</td>
                <td><Avatar pessoa={pessoa(a.responsavel_id)} /></td>
                <td className="num whitespace-nowrap">{a.status === "agendado" && <><button className="btn btn-p btn-sm" onClick={() => setAnotando(a.id)}>Atender</button> <button className="btn btn-g btn-sm" onClick={() => alterar("atendimentos", a.id, { status: "realizado" })}>Realizado</button> <button className="btn btn-perigo btn-sm" onClick={() => alterar("atendimentos", a.id, { status: "cancelado" })}>Cancelar</button></>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {anotando && <SessaoAtendimento id={anotando} aoFechar={() => setAnotando(null)} />}
    </>
  );
}
