"use client";
import { useMemo, useState } from "react";
import { addDays, addYears, differenceInCalendarDays, differenceInYears } from "date-fns";
import { brl, data, diaSemana, hojeISO, iso } from "@/novo/lib/format";
import { contarPrazo } from "@/novo/lib/prazo";
import { Abas, Cabecalho, Rotulado } from "@/novo/components/ui";

type Aba = "prazo" | "progressao" | "prescricao" | "rescisao";
const dia = (s: string) => new Date(`${s}T12:00:00`);

function Resultado({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return <div className="rounded-[16px] bg-ink p-5 text-white" role="status"><p className="text-[12.5px] font-semibold text-white/70">{rotulo}</p><p className="titulo mt-1 text-[30px]">{valor}</p>{nota && <p className="mt-1 text-[13px] text-white/75">{nota}</p>}</div>;
}
const Aviso = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-[70ch] text-[12.5px] text-ink-3">{children}</p>;

function Prazo() {
  const [f, setF] = useState({ base: hojeISO(), dias: 15, uteis: true, diario: true, recesso: true });
  const r = useMemo(() => (f.base && f.dias > 0 ? contarPrazo(f.base, f.dias, f.uteis, f.diario, f.recesso) : null), [f]);
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Rotulado rotulo={f.diario ? "Disponibilização no diário eletrônico" : "Data da intimação"}><input type="date" className="inp" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} /></Rotulado>
        <Rotulado rotulo="Prazo em dias"><input type="number" min={1} className="inp" value={f.dias} onChange={(e) => setF({ ...f, dias: Number(e.target.value) })} /></Rotulado>
        <div className="flex flex-wrap gap-1.5">{[2, 5, 8, 10, 15, 30].map((n) => <button key={n} className={`btn btn-sm ${f.dias === n ? "btn-p" : "btn-g"}`} onClick={() => setF({ ...f, dias: n })}>{n}</button>)}</div>
        <Rotulado rotulo="Contagem"><select className="inp" value={f.uteis ? "u" : "c"} onChange={(e) => setF({ ...f, uteis: e.target.value === "u" })}><option value="u">Dias úteis (CPC, art. 219; CLT, art. 775)</option><option value="c">Dias corridos (CPP, art. 798)</option></select></Rotulado>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.diario} onChange={(e) => setF({ ...f, diario: e.target.checked })} /><span>Intimação por diário eletrônico <span className="block text-[12.5px] text-ink-3">Considera publicado no primeiro dia útil após a disponibilização.</span></span></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.recesso} onChange={(e) => setF({ ...f, recesso: e.target.checked })} /><span>Suspender no recesso de 20/12 a 20/01 <span className="block text-[12.5px] text-ink-3">Desmarque para réu preso e medidas urgentes.</span></span></label>
      </div>
      <div>
        {r && <>
          <Resultado rotulo="Último dia do prazo" valor={`${data(r.vencimento)} (${diaSemana(r.vencimento)})`} nota={`Publicação em ${data(r.publicacao)} · contagem a partir de ${data(r.inicio)}`} />
          {r.pulados.length > 0 && <div className="painel mt-4"><div className="painel-cab"><h2>Dias que não contaram</h2><span className="tag">{r.pulados.length}</span></div><ul className="max-h-[260px] overflow-y-auto">{r.pulados.map((p) => <li key={p.dia} className="flex justify-between gap-3 border-b border-line-2 px-5 py-2 text-[13px] last:border-0"><span>{data(p.dia)} <span className="text-ink-3">{diaSemana(p.dia)}</span></span><span className="text-ink-2">{p.motivo}</span></li>)}</ul></div>}
        </>}
        <Aviso>A tabela tem os feriados nacionais e os forenses mais comuns. Feriados estaduais e municipais, pontos facultativos e suspensões de expediente do tribunal não entram: confira no calendário do foro.</Aviso>
      </div>
    </div>
  );
}

const FRACOES = [[16, "16% · primário, crime sem violência ou grave ameaça"], [20, "20% · reincidente, crime sem violência"], [25, "25% · primário, crime com violência ou grave ameaça"], [30, "30% · reincidente em crime com violência"], [40, "40% · primário, crime hediondo ou equiparado"], [50, "50% · hediondo com morte (primário), comando de organização criminosa ou milícia"], [55, "55% · feminicídio, primário"], [60, "60% · reincidente em crime hediondo"], [70, "70% · reincidente em hediondo com resultado morte"]] as const;

function Progressao() {
  const [f, setF] = useState({ anos: 6, meses: 0, dias: 0, base: "", fracao: 16, remidos: 0 });
  const total = f.anos * 365 + f.meses * 30 + f.dias;
  const exigido = Math.ceil((total * f.fracao) / 100);
  const quando = f.base ? iso(addDays(dia(f.base), Math.max(0, exigido - f.remidos))) : "";
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2"><Rotulado rotulo="Anos"><input type="number" min={0} className="inp" value={f.anos} onChange={(e) => setF({ ...f, anos: Number(e.target.value) })} /></Rotulado><Rotulado rotulo="Meses"><input type="number" min={0} max={11} className="inp" value={f.meses} onChange={(e) => setF({ ...f, meses: Number(e.target.value) })} /></Rotulado><Rotulado rotulo="Dias"><input type="number" min={0} max={29} className="inp" value={f.dias} onChange={(e) => setF({ ...f, dias: Number(e.target.value) })} /></Rotulado></div>
        <Rotulado rotulo="Data-base (início ou última progressão)"><input type="date" className="inp" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} /></Rotulado>
        <Rotulado rotulo="Percentual (LEP, art. 112)"><select className="inp" value={f.fracao} onChange={(e) => setF({ ...f, fracao: Number(e.target.value) })}>{FRACOES.map(([n, t]) => <option key={n} value={n}>{t}</option>)}</select></Rotulado>
        <Rotulado rotulo="Dias remidos e de detração ainda não descontados"><input type="number" min={0} className="inp" value={f.remidos} onChange={(e) => setF({ ...f, remidos: Number(e.target.value) })} /></Rotulado>
      </div>
      <div>
        <Resultado rotulo="Requisito objetivo para progredir" valor={quando ? data(quando) : `${exigido} dias de pena`} nota={`${exigido} dias a cumprir (${f.fracao}% de ${total} dias)${f.remidos ? `, menos ${f.remidos} dias remidos` : ""}`} />
        <Aviso>Estimativa com ano de 365 dias e mês de 30. Não considera falta grave (que interrompe o prazo), soma de penas com percentuais diferentes, nem o requisito subjetivo (bom comportamento). Em crimes anteriores a 23/01/2020, vale a regra mais favorável ao apenado.</Aviso>
      </div>
    </div>
  );
}

function Prescricao() {
  const [f, setF] = useState({ anos: 4, meses: 0, marco: "", metade: false });
  const pena = f.anos + f.meses / 12;
  const prazo = pena > 12 ? 20 : pena > 8 ? 16 : pena > 4 ? 12 : pena > 2 ? 8 : pena >= 1 ? 4 : 3;
  const final = f.metade ? prazo / 2 : prazo;
  const fim = f.marco ? iso(addDays(addYears(dia(f.marco), Math.floor(final)), final % 1 ? 182 : 0)) : "";
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2"><Rotulado rotulo="Pena: anos"><input type="number" min={0} className="inp" value={f.anos} onChange={(e) => setF({ ...f, anos: Number(e.target.value) })} /></Rotulado><Rotulado rotulo="Meses"><input type="number" min={0} max={11} className="inp" value={f.meses} onChange={(e) => setF({ ...f, meses: Number(e.target.value) })} /></Rotulado></div>
        <p className="text-[12.5px] text-ink-3">Use a pena máxima do tipo antes da sentença, ou a pena aplicada depois do trânsito para a acusação (CP, art. 110).</p>
        <Rotulado rotulo="Último marco (fato, recebimento da denúncia, sentença…)"><input type="date" className="inp" value={f.marco} onChange={(e) => setF({ ...f, marco: e.target.value })} /></Rotulado>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.metade} onChange={(e) => setF({ ...f, metade: e.target.checked })} /><span>Reduzir pela metade <span className="block text-[12.5px] text-ink-3">Menor de 21 anos na data do fato ou maior de 70 na sentença (CP, art. 115).</span></span></label>
      </div>
      <div>
        <Resultado rotulo="Prazo de prescrição" valor={`${String(final).replace(".", ",")} anos`} nota={fim ? `Prescreve em ${data(fim)} se não houver nova interrupção ou suspensão` : "Informe o último marco para ver a data"} />
        <div className="painel mt-4 overflow-x-auto"><table className="tb"><thead><tr><th>Pena</th><th>Prescreve em</th></tr></thead><tbody>{[["Menos de 1 ano", 3], ["De 1 a 2 anos", 4], ["Mais de 2 até 4 anos", 8], ["Mais de 4 até 8 anos", 12], ["Mais de 8 até 12 anos", 16], ["Mais de 12 anos", 20]].map(([p, n]) => <tr key={p} className={n === prazo ? "font-bold" : ""}><td>{p}</td><td>{n} anos</td></tr>)}</tbody></table></div>
        <Aviso>CP, art. 109. As causas de interrupção estão no art. 117 e as de suspensão no art. 116. A reincidência aumenta em um terço só a prescrição da pretensão executória (art. 110).</Aviso>
      </div>
    </div>
  );
}

function Rescisao() {
  const [f, setF] = useState({ salario: 3000, admissao: "", demissao: hojeISO(), tipo: "sem" as "sem" | "pedido" | "justa" | "acordo", fgts: 0, vencidas: false });
  const c = useMemo(() => {
    if (!f.admissao || !f.demissao) return null;
    const a = dia(f.admissao), d = dia(f.demissao);
    if (d <= a) return null;
    const anos = differenceInYears(d, a);
    const saldo = (f.salario / 30) * Math.min(30, d.getDate());
    const diasAviso = Math.min(90, 30 + 3 * anos);
    const aviso = f.tipo === "sem" ? (f.salario / 30) * diasAviso : f.tipo === "acordo" ? ((f.salario / 30) * diasAviso) / 2 : 0;
    const meses13 = d.getMonth() + (d.getDate() >= 15 ? 1 : 0);
    const decimo = f.tipo === "justa" ? 0 : (f.salario / 12) * meses13;
    const ultimoAniv = addYears(a, anos);
    const diasPeriodo = differenceInCalendarDays(d, ultimoAniv);
    const mesesFerias = Math.min(12, Math.floor(diasPeriodo / 30) + (diasPeriodo % 30 >= 15 ? 1 : 0));
    const feriasProp = f.tipo === "justa" ? 0 : ((f.salario / 12) * mesesFerias * 4) / 3;
    const feriasVenc = f.vencidas ? (f.salario * 4) / 3 : 0;
    const multa = f.tipo === "sem" ? f.fgts * 0.4 : f.tipo === "acordo" ? f.fgts * 0.2 : 0;
    const linhas: [string, number, string][] = [["Saldo de salário", saldo, `${Math.min(30, d.getDate())} dias`], ["Aviso prévio indenizado", aviso, f.tipo === "sem" ? `${diasAviso} dias` : f.tipo === "acordo" ? `metade de ${diasAviso} dias` : "não devido"], ["13º proporcional", decimo, `${meses13}/12`], ["Férias proporcionais + 1/3", feriasProp, `${mesesFerias}/12`], ["Férias vencidas + 1/3", feriasVenc, f.vencidas ? "1 período" : "não há"], ["Multa do FGTS", multa, f.tipo === "sem" ? "40%" : f.tipo === "acordo" ? "20%" : "não devida"]];
    return { linhas, total: linhas.reduce((s, l) => s + l[1], 0) };
  }, [f]);
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Rotulado rotulo="Último salário (R$)"><input type="number" className="inp" value={f.salario} onChange={(e) => setF({ ...f, salario: Number(e.target.value) })} /></Rotulado>
        <div className="grid grid-cols-2 gap-2"><Rotulado rotulo="Admissão"><input type="date" className="inp" value={f.admissao} onChange={(e) => setF({ ...f, admissao: e.target.value })} /></Rotulado><Rotulado rotulo="Desligamento"><input type="date" className="inp" value={f.demissao} onChange={(e) => setF({ ...f, demissao: e.target.value })} /></Rotulado></div>
        <Rotulado rotulo="Tipo de desligamento"><select className="inp" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as typeof f.tipo })}><option value="sem">Dispensa sem justa causa</option><option value="pedido">Pedido de demissão</option><option value="justa">Justa causa</option><option value="acordo">Acordo (CLT, art. 484-A)</option></select></Rotulado>
        <Rotulado rotulo="Saldo do FGTS para a multa (R$)"><input type="number" className="inp" value={f.fgts} onChange={(e) => setF({ ...f, fgts: Number(e.target.value) })} /></Rotulado>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.vencidas} onChange={(e) => setF({ ...f, vencidas: e.target.checked })} />Há um período de férias vencidas</label>
      </div>
      <div>
        {c ? <>
          <Resultado rotulo="Estimativa das verbas rescisórias" valor={brl(c.total)} nota="Valores brutos, antes de INSS e imposto de renda" />
          <div className="painel mt-4"><table className="tb"><tbody>{c.linhas.map(([n, v, d]) => <tr key={n}><td>{n}<span className="ml-2 text-[12.5px] text-ink-3">{d}</span></td><td className="num font-semibold">{brl(v)}</td></tr>)}</tbody></table></div>
        </> : <p className="text-ink-2">Informe admissão e desligamento para calcular.</p>}
        <Aviso>Cálculo simplificado para a primeira conversa com o cliente. Não projeta o aviso prévio no tempo de serviço nem inclui horas extras, adicionais, médias de comissão ou multas dos arts. 467 e 477 da CLT.</Aviso>
      </div>
    </div>
  );
}

export default function Ferramentas() {
  const [aba, setAba] = useState<Aba>("prazo");
  return (
    <>
      <Cabecalho titulo="Calculadoras" sub="Contas do dia a dia do foro. Servem para conferir e para a primeira conversa com o cliente; a conta final continua sendo sua." />
      <Abas valor={aba} aoMudar={setAba} abas={[["prazo", "Prazo processual"], ["progressao", "Progressão de regime"], ["prescricao", "Prescrição penal"], ["rescisao", "Verbas rescisórias"]] as const} />
      <div className="mt-6">{aba === "prazo" ? <Prazo /> : aba === "progressao" ? <Progressao /> : aba === "prescricao" ? <Prescricao /> : <Rescisao />}</div>
    </>
  );
}
