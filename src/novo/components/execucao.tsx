"use client";
// Execução penal: crimes da execução (cada um com pena, condição e frações próprias),
// remições, interrupções e suspensões da pena, e o cálculo da pena cumprida.
import { alterar } from "@/novo/lib/store";
import { data, uid } from "@/novo/lib/format";
import {
  CONDICOES, EXEC_VAZIA, MOTIVOS_INTERRUPCAO, MOTIVOS_REMICAO, NATUREZAS,
  calcular, diasTexto, pct, penaTexto, sugerirFracaoLC, sugerirFracaoProg,
} from "@/novo/lib/execucao";
import { SUGESTOES_FIXAS } from "@/novo/lib/areas";
import type { Caso, CrimeExec, DadosExecucao, Interrupcao, Remicao } from "@/novo/lib/types";
import { Acoes } from "./acoes";
import { BotaoNovo, type CampoF, type Valores } from "./form-rapido";
import { Vazio } from "./ui";

const camposCrime: CampoF[] = [
  { k: "crime", rotulo: "Crime", obrig: true, largo: true, lista: "exec_crime", sugestoes: SUGESTOES_FIXAS.tipo_penal },
  { k: "processo", rotulo: "Processo de conhecimento (número)" },
  { k: "vara", rotulo: "Vara de origem", lista: "exec_vara" },
  { k: "anos", rotulo: "Pena: anos", tipo: "numero" },
  { k: "meses", rotulo: "Pena: meses", tipo: "numero" },
  { k: "dias", rotulo: "Pena: dias", tipo: "numero" },
  { k: "natureza", rotulo: "Natureza", tipo: "opcoes", opcoes: NATUREZAS, lista: "exec_natureza" },
  { k: "condicao", rotulo: "Condição neste crime", tipo: "opcoes", opcoes: CONDICOES, lista: "exec_condicao" },
  { k: "data_fato", rotulo: "Data do fato", tipo: "data", dica: "Define a lei aplicável (antes ou depois do Pacote Anticrime)." },
  { k: "transito", rotulo: "Trânsito em julgado", tipo: "data" },
  { k: "fracao_prog", rotulo: "Fração para progressão", tipo: "opcoes", opcoes: ["16%", "20%", "25%", "30%", "40%", "50%", "60%", "70%", "1/6", "2/5", "3/5"], lista: "exec_fracao_prog", dica: "Em branco, usa a sugerida pela natureza, condição e data do fato." },
  { k: "fracao_lc", rotulo: "Fração para livramento", tipo: "opcoes", opcoes: ["1/3", "1/2", "2/3", "vedado"], lista: "exec_fracao_lc", dica: "Em branco, usa a sugerida." },
  { k: "obs", rotulo: "Observações", tipo: "longo" },
];
const camposRemicao: CampoF[] = [
  { k: "data", rotulo: "Data (ou fim do período)", tipo: "data", obrig: true },
  { k: "dias", rotulo: "Dias remidos", tipo: "numero", obrig: true },
  { k: "motivo", rotulo: "Motivo", tipo: "opcoes", opcoes: MOTIVOS_REMICAO, lista: "exec_motivo_remicao", inicial: "Trabalho" },
  { k: "homologada", rotulo: "Já homologada pelo juízo", tipo: "check" },
];
const camposInterrupcao: CampoF[] = [
  { k: "tipo", rotulo: "Tipo", tipo: "opcoes", opcoes: [["interrupção", "Interrupção (a pena para de correr)"], ["suspensão", "Suspensão"]], inicial: "interrupção", obrig: true },
  { k: "motivo", rotulo: "Motivo", tipo: "opcoes", opcoes: MOTIVOS_INTERRUPCAO, lista: "exec_motivo_interrupcao", obrig: true },
  { k: "inicio", rotulo: "Início", tipo: "data", obrig: true },
  { k: "fim", rotulo: "Fim (em branco se ainda não terminou)", tipo: "data" },
];

const num = (v: unknown) => (v === undefined || v === "" ? 0 : Number(v) || 0);
const txt = (v: unknown) => (v === undefined || v === "" ? undefined : String(v));
const crimeDe = (v: Valores, id: string): CrimeExec => ({
  id, crime: String(v.crime), processo: txt(v.processo), vara: txt(v.vara), anos: num(v.anos), meses: num(v.meses), dias: num(v.dias),
  natureza: txt(v.natureza), condicao: txt(v.condicao), data_fato: txt(v.data_fato), transito: txt(v.transito), fracao_prog: txt(v.fracao_prog), fracao_lc: txt(v.fracao_lc), obs: txt(v.obs),
});
const valoresDe = (c: CrimeExec): Valores => Object.fromEntries(Object.entries(c).filter(([k, x]) => k !== "id" && x !== undefined)) as Valores;

export function Execucao({ caso }: { caso: Caso }) {
  const ex: DadosExecucao = { ...EXEC_VAZIA, ...caso.execucao };
  const gravar = (m: Partial<DadosExecucao>) => alterar("casos", caso.id, { execucao: { ...ex, ...m } });
  const k = calcular(caso);

  return (
    <>
      <section className="painel">
        <div className="painel-cab">
          <h2>Crimes da execução</h2>
          <BotaoNovo rotulo="Incluir crime" classe="btn btn-g btn-sm" campos={camposCrime} aoSalvar={(v) => gravar({ crimes: [...ex.crimes, crimeDe(v, uid())] })} />
        </div>
        {ex.crimes.length === 0 ? (
          <Vazio titulo="Nenhum crime cadastrado">Inclua cada condenação com a pena, a natureza e a condição (primário ou reincidente). O cálculo aplica a fração de cada crime sobre a pena dele.</Vazio>
        ) : (
          <ul>{ex.crimes.map((c) => {
            const fp = c.fracao_prog || sugerirFracaoProg(c), fl = c.fracao_lc || sugerirFracaoLC(c);
            return (
              <li key={c.id} className="flex items-start gap-3 border-b border-line-2 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{c.crime}</p>
                  <p className="text-[13px] text-ink-2">{penaTexto(c)}{c.natureza ? ` · ${c.natureza}` : ""}{c.condicao ? ` · ${c.condicao}` : ""}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[12.5px]">
                    <span className="tag">Progressão {fp}{c.fracao_prog ? "" : " (sugerida)"}</span>
                    <span className={`tag ${/vedad/i.test(fl) ? "tag-perigo" : ""}`}>Livramento {fl}{c.fracao_lc ? "" : " (sugerida)"}</span>
                  </p>
                  {(c.processo || c.vara || c.data_fato || c.transito) && <p className="mt-1 break-words text-[12.5px] text-ink-3">{[c.processo && `Proc. ${c.processo}`, c.vara, c.data_fato && `fato em ${data(c.data_fato)}`, c.transito && `trânsito em ${data(c.transito)}`].filter(Boolean).join(" · ")}</p>}
                  {c.obs && <p className="mt-1 whitespace-pre-line text-[12.5px] text-ink-2">{c.obs}</p>}
                </div>
                <Acoes oQue="o crime" campos={camposCrime} inicial={valoresDe(c)}
                  aoSalvar={(v) => gravar({ crimes: ex.crimes.map((x) => (x.id === c.id ? crimeDe(v, c.id) : x)) })}
                  aoExcluir={() => gravar({ crimes: ex.crimes.filter((x) => x.id !== c.id) })} />
              </li>
            );
          })}</ul>
        )}
        <p className="border-t border-line-2 px-4 py-2.5 text-[12px] text-ink-3">Frações sugeridas: LEP, art. 112 (Lei 13.964/2019 para fatos a partir de 23/01/2020; antes, 1/6, ou 2/5 e 3/5 para hediondos) e CP, art. 83. Ajuste quando o caso pedir outra (maus antecedentes, reincidência genérica em hediondo, decisão do juízo).</p>
      </section>

      <section className="painel">
        <div className="painel-cab"><h2>Cálculo da pena</h2><span className="text-[12px] text-ink-3">Estimativa. Vale o cálculo homologado.</span></div>
        {!k.ok ? <p className="px-4 py-4 text-ink-2">{k.falta}</p> : (
          <div className="p-4">
            <div className="h-2 rounded-full bg-cobalto-f"><div className="h-2 rounded-full bg-ink" style={{ width: `${k.pctCumprido}%` }} /></div>
            <p className="mt-1 text-[12.5px] text-ink-3">{k.pctCumprido.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da pena cumprida</p>
            <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <Linha rotulo="Pena total" valor={`${diasTexto(k.totalDias)} (${k.totalDias} dias)`} />
              <Linha rotulo="Dias cumpridos" valor={`${diasTexto(k.cumpridos)} (${k.cumpridos} dias)`} dica={`inclui ${k.remidos} remidos${k.remidosPendentes ? ` (${k.remidosPendentes} sem homologação)` : ""} e ${k.detracao} de detração${k.interrompidos ? `; descontados ${k.interrompidos} dias em que a pena não correu` : ""}`} />
              <Linha rotulo="Pena restante" valor={`${diasTexto(k.restante)} (${k.restante} dias)`} />
              <Linha rotulo="Término previsto" valor={data(k.termino)} />
              {k.progressao && <Linha rotulo="Progressão prevista" valor={data(k.progressao.data)} destaque
                dica={`data-base ${data(k.progressao.base)} · fração ${pct(k.progressao.fracao)}${k.porCrime.length > 1 ? " (média dos crimes, pesada pela pena)" : ""} · ${k.progressao.requisito} dias${k.progressao.semFracao.length ? ` · sem fração: ${k.progressao.semFracao.join(", ")}` : ""}`} />}
              {k.livramento ? <Linha rotulo="Livramento previsto" valor={data(k.livramento.data)} destaque
                dica={`data-base ${data(k.livramento.base)} · fração ${pct(k.livramento.fracao)} · ${k.livramento.requisito} dias${k.livramento.vedados.length ? ` · vedado em: ${k.livramento.vedados.join(", ")} (fora da conta; conferir)` : ""}`} />
                : k.porCrime.length > 0 && <Linha rotulo="Livramento" valor="Vedado em todos os crimes" />}
            </dl>
            {k.porCrime.length > 1 && (
              <table className="tb mt-3"><thead><tr><th>Crime</th><th className="num">Pena (dias)</th><th>Progressão</th><th>Livramento</th></tr></thead>
                <tbody>{k.porCrime.map((x) => <tr key={x.crime.id}><td>{x.crime.crime}</td><td className="num">{x.dias}</td><td>{x.fProg === null ? "sem fração" : pct(x.fProg)}</td><td>{x.vedadoLc ? "vedado" : x.fLc === null ? "sem fração" : pct(x.fLc)}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="painel">
          <div className="painel-cab">
            <h2>Dias remidos ({ex.remicoes.reduce((s, r) => s + r.dias, 0)})</h2>
            <BotaoNovo rotulo="Incluir remição" classe="btn btn-g btn-sm" campos={camposRemicao}
              aoSalvar={(v) => gravar({ remicoes: [...ex.remicoes, { id: uid(), data: String(v.data), dias: num(v.dias), motivo: String(v.motivo ?? "Trabalho"), homologada: !!v.homologada } as Remicao].sort((a, b) => a.data.localeCompare(b.data)) })} />
          </div>
          {ex.remicoes.length === 0 ? <Vazio titulo="Nenhuma remição lançada">Trabalho: 1 dia a cada 3 trabalhados. Estudo: 1 dia a cada 12 horas. Leitura: até 4 dias por obra.</Vazio> : (
            <ul>{ex.remicoes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                <span className="w-[86px] shrink-0 text-[12.5px] text-ink-3">{data(r.data)}</span>
                <span className="min-w-0 flex-1"><span className="font-semibold">{r.dias} {r.dias === 1 ? "dia" : "dias"}</span> <span className="text-ink-2">· {r.motivo}</span></span>
                <button className={`tag ${r.homologada ? "tag-ok" : "tag-alerta"}`} onClick={() => gravar({ remicoes: ex.remicoes.map((x) => (x.id === r.id ? { ...x, homologada: !x.homologada } : x)) })} title="Alternar homologação">{r.homologada ? "Homologada" : "Pendente"}</button>
                <Acoes oQue="a remição" campos={camposRemicao} inicial={{ data: r.data, dias: r.dias, motivo: r.motivo, homologada: r.homologada }}
                  aoSalvar={(v) => gravar({ remicoes: ex.remicoes.map((x) => (x.id === r.id ? { ...x, data: String(v.data), dias: num(v.dias), motivo: String(v.motivo ?? x.motivo), homologada: !!v.homologada } : x)) })}
                  aoExcluir={() => gravar({ remicoes: ex.remicoes.filter((x) => x.id !== r.id) })} />
              </li>
            ))}</ul>
          )}
        </section>

        <section className="painel">
          <div className="painel-cab">
            <h2>Interrupção ou suspensão</h2>
            <BotaoNovo rotulo="Incluir período" classe="btn btn-g btn-sm" campos={camposInterrupcao}
              aoSalvar={(v) => gravar({ interrupcoes: [...ex.interrupcoes, { id: uid(), tipo: v.tipo === "suspensão" ? "suspensão" : "interrupção", motivo: String(v.motivo), inicio: String(v.inicio), fim: txt(v.fim) } as Interrupcao].sort((a, b) => a.inicio.localeCompare(b.inicio)) })} />
          </div>
          {ex.interrupcoes.length === 0 ? <Vazio titulo="Nenhum período lançado">Fuga, não retorno da saída temporária e outros períodos em que a pena não correu. Esses dias saem da conta e empurram as datas.</Vazio> : (
            <ul>{ex.interrupcoes.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-0">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{p.motivo}</span><span className="text-[12.5px] text-ink-3">{p.tipo} · {data(p.inicio)} a {p.fim ? data(p.fim) : "hoje (em aberto)"}</span></span>
                <Acoes oQue="o período" campos={camposInterrupcao} inicial={{ tipo: p.tipo, motivo: p.motivo, inicio: p.inicio, fim: p.fim ?? "" }}
                  aoSalvar={(v) => gravar({ interrupcoes: ex.interrupcoes.map((x) => (x.id === p.id ? { ...x, tipo: v.tipo === "suspensão" ? "suspensão" : "interrupção", motivo: String(v.motivo), inicio: String(v.inicio), fim: txt(v.fim) } : x)) })}
                  aoExcluir={() => gravar({ interrupcoes: ex.interrupcoes.filter((x) => x.id !== p.id) })} />
              </li>
            ))}</ul>
          )}
          <p className="border-t border-line-2 px-4 py-2.5 text-[12px] text-ink-3">Falta grave que interrompe a data-base da progressão: altere a data-base em Datas da execução. Ela não interrompe o livramento (Súmula 441 do STJ).</p>
        </section>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, dica, destaque }: { rotulo: string; valor: string; dica?: string; destaque?: boolean }) {
  return (
    <div className={`min-w-0 rounded-[10px] px-3 py-2 ${destaque ? "bg-porcelana" : ""}`}>
      <dt className="text-[12px] font-semibold text-ink-3">{rotulo}</dt>
      <dd className={destaque ? "text-[17px] font-bold" : "font-semibold"}>{valor}</dd>
      {dica && <dd className="text-[12px] text-ink-3">{dica}</dd>}
    </div>
  );
}

