"use client";
import { useMemo, useState } from "react";
import { Download, LogIn, LogOut } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { data, diaSemana, hojeISO, horas } from "@/novo/lib/format";
import { Avatar } from "./ui";
import type { Ponto } from "@/novo/lib/types";

const min = (hm?: string) => (hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : 0);
const trabalhado = (p: Ponto) => (p.saida ? Math.max(0, min(p.saida) - min(p.entrada) - p.intervalo_min) : 0);
const agora = () => new Date().toTimeString().slice(0, 5);
const saldoTxt = (m: number) => `${m < 0 ? "−" : "+"}${horas(Math.abs(m))}`;

/** Ponto e banco de horas de quem tem jornada controlada (CLT e estágio). */
export function PontoAba() {
  const db = useDB();
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const controlados = db.equipe.filter((e) => e.ativo && (e.vinculo === "CLT" || e.vinculo === "estágio"));
  const [quem, setQuem] = useState("");
  const sel = quem || controlados[0]?.id || "";

  const resumo = useMemo(() => controlados.map((e) => {
    const doMes = db.pontos.filter((p) => p.colaborador_id === e.id && p.data.startsWith(mes) && p.saida);
    const diaria = Math.round((e.carga_semanal / 5) * 60);
    const feito = doMes.reduce((s, p) => s + trabalhado(p), 0);
    return { e, dias: doMes.length, feito, saldo: feito - doMes.length * diaria, diaria, aberto: db.pontos.find((p) => p.colaborador_id === e.id && p.data === hoje && !p.saida), fechadoHoje: db.pontos.some((p) => p.colaborador_id === e.id && p.data === hoje && p.saida) };
  }), [controlados, db.pontos, mes, hoje]);

  const registros = db.pontos.filter((p) => p.colaborador_id === sel).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 31);
  const diariaSel = resumo.find((r) => r.e.id === sel)?.diaria ?? 480;

  function exportar() {
    const linhas = [["Pessoa", "Vínculo", "Data", "Entrada", "Saída", "Intervalo (min)", "Trabalhado (min)"], ...db.pontos.filter((p) => p.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data)).map((p) => { const e = db.equipe.find((x) => x.id === p.colaborador_id); return [e?.nome ?? "", e?.vinculo ?? "", p.data, p.entrada, p.saida ?? "", String(p.intervalo_min), String(trabalhado(p))]; })];
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `ponto-${mes}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  if (controlados.length === 0) return <p className="text-ink-2">Ninguém da equipe tem jornada controlada. O ponto vale para vínculos CLT e de estágio.</p>;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="painel h-fit">
        <div className="painel-cab"><h2>Hoje e saldo do mês</h2><button className="btn btn-g btn-sm" onClick={exportar}><Download />Planilha para o contador</button></div>
        <ul>{resumo.map(({ e, dias, feito, saldo, aberto, fechadoHoje }) => (
          <li key={e.id} className={`flex flex-wrap items-center gap-3 border-b border-line-2 px-5 py-3 last:border-0 ${sel === e.id ? "bg-porcelana" : ""}`}>
            <Avatar pessoa={e} tamanho={34} />
            <button className="min-w-0 flex-1 text-left" onClick={() => setQuem(e.id)}>
              <span className="block truncate font-semibold hover:underline">{e.nome}</span>
              <span className="block text-[12.5px] text-ink-3">{e.vinculo} · {e.carga_semanal}h por semana · {dias} dias no mês · {horas(feito)}</span>
            </button>
            <span className={`tag ${saldo < -60 ? "tag-perigo" : saldo > 60 ? "tag-ok" : ""}`} title="Saldo do banco de horas no mês">{saldoTxt(saldo)}</span>
            {aberto ? <button className="btn btn-p btn-sm" onClick={() => alterar("pontos", aberto.id, { saida: agora() })}><LogOut />Saída ({aberto.entrada})</button>
              : fechadoHoje ? <span className="tag tag-ok">Dia fechado</span>
              : <button className="btn btn-g btn-sm" onClick={() => incluir("pontos", { colaborador_id: e.id, data: hoje, entrada: agora(), intervalo_min: e.vinculo === "estágio" ? 0 : 60 })}><LogIn />Entrada</button>}
          </li>
        ))}</ul>
        <p className="border-t border-line-2 px-5 py-2.5 text-[12.5px] text-ink-3">Estágio: até 6 horas por dia e 30 por semana (Lei 11.788/08, art. 10). Para CLT, o banco de horas depende de acordo (CLT, art. 59).</p>
      </section>
      <section className="painel overflow-x-auto">
        <div className="painel-cab"><h2>Registros de {db.equipe.find((e) => e.id === sel)?.nome.split(" ")[0]}</h2></div>
        {registros.length === 0 ? <p className="px-5 py-8 text-center text-ink-2">Nenhum registro ainda. Use “Entrada” para começar o dia.</p> : (
          <table className="tb"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída</th><th>Intervalo</th><th className="num">Trabalhado</th><th className="num">Saldo</th></tr></thead>
            <tbody>{registros.map((p) => { const t = trabalhado(p); return (
              <tr key={p.id}><td className="whitespace-nowrap">{data(p.data)} <span className="text-ink-3">{diaSemana(p.data)}</span></td>
                <td><input type="time" aria-label="Entrada" className="inp h-8 w-[104px]" value={p.entrada} onChange={(e) => alterar("pontos", p.id, { entrada: e.target.value })} /></td>
                <td><input type="time" aria-label="Saída" className="inp h-8 w-[104px]" value={p.saida ?? ""} onChange={(e) => alterar("pontos", p.id, { saida: e.target.value || undefined })} /></td>
                <td>{p.intervalo_min} min</td><td className="num">{p.saida ? horas(t) : "em curso"}</td>
                <td className={`num font-semibold ${p.saida && t - diariaSel < 0 ? "text-perigo" : ""}`}>{p.saida ? saldoTxt(t - diariaSel) : ""}</td></tr>
            ); })}</tbody></table>
        )}
      </section>
    </div>
  );
}
