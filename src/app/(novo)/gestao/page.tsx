"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { incluir, useDB } from "@/novo/lib/store";
import { BotaoNovo } from "@/novo/components/form-rapido";
import type { Procuracao } from "@/novo/lib/types";
import { AREAS } from "@/novo/lib/areas";
import { brl, brlCurto, data, diasAte, hojeISO, quando, semAcento } from "@/novo/lib/format";
import { Abas, Avatar, Barras, Cabecalho, LinkCaso, Vazio, useMapas } from "@/novo/components/ui";

type Aba = "indicadores" | "conflito" | "procuracoes" | "correspondentes";
const RISCO = { provavel: "Êxito provável", possivel: "Êxito possível", remoto: "Êxito remoto" } as const;

export default function Gestao() {
  const db = useDB();
  const { caso } = useMapas(db);
  const [aba, setAba] = useState<Aba>("indicadores");
  const [q, setQ] = useState("");
  const ativos = db.casos.filter((c) => c.status === "ativo");

  const porArea = useMemo(() => AREAS.map((a) => ({ rotulo: a.nome, valor: ativos.filter((c) => c.area === a.id).length })).filter((x) => x.valor).sort((a, b) => b.valor - a.valor), [ativos]);
  const carga = db.equipe.filter((e) => e.areas.length).map((e) => ({ e, casos: ativos.filter((c) => c.responsavel_id === e.id).length, prazos: db.prazos.filter((p) => p.responsavel_id === e.id && !p.concluido && diasAte(p.data) <= 7).length }));
  const maxCasos = Math.max(1, ...carga.map((c) => c.casos));
  const prazosFechados = db.prazos.filter((p) => p.concluido).length;
  const prazosVencidos = db.prazos.filter((p) => !p.concluido && diasAte(p.data) < 0).length;
  const origem = useMemo(() => { const m = new Map<string, number>(); db.clientes.forEach((c) => m.set(c.origem ?? "Não informado", (m.get(c.origem ?? "Não informado") ?? 0) + 1)); return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor); }, [db.clientes]);
  const provisao = (["provavel", "possivel", "remoto"] as const).map((r) => ({ r, n: ativos.filter((c) => c.risco === r).length, v: ativos.filter((c) => c.risco === r).reduce((s, c) => s + (c.valor ?? 0), 0) }));

  const achados = useMemo(() => {
    const t = semAcento(q.trim());
    if (t.length < 3) return null;
    return {
      clientes: db.clientes.filter((c) => semAcento(c.nome).includes(t) || (c.documento ?? "").includes(t)),
      contrarios: db.casos.filter((c) => c.parte_contraria && semAcento(c.parte_contraria).includes(t)),
      mencoes: db.casos.filter((c) => Object.values(c.dados).some((v) => typeof v === "string" && semAcento(v).includes(t))),
      contatos: db.leads.filter((l) => semAcento(l.nome).includes(t)),
    };
  }, [q, db.clientes, db.casos, db.leads]);

  return (
    <>
      <Cabecalho titulo="Gestão" sub="Indicadores do escritório, checagem de conflito de interesses, procurações e rede de correspondentes." />
      <Abas valor={aba} aoMudar={setAba} abas={[["indicadores", "Indicadores"], ["conflito", "Conflito de interesses"], ["procuracoes", "Procurações"], ["correspondentes", "Correspondentes"]] as const} />
      <div className="mt-5">
        {aba === "indicadores" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="painel"><div className="painel-cab"><h2>Casos em andamento por área</h2><span className="text-[12.5px] text-ink-3">{ativos.length} no total</span></div><div className="p-5"><Barras itens={porArea} /></div></section>
            <section className="painel">
              <div className="painel-cab"><h2>Carga por responsável</h2></div>
              <ul>{carga.map(({ e, casos, prazos }) => (
                <li key={e.id} className="flex items-center gap-3 border-b border-line-2 px-5 py-3 last:border-0">
                  <Avatar pessoa={e} tamanho={30} /><span className="w-36 truncate font-semibold">{e.nome}</span>
                  <span className="h-2.5 flex-1 rounded-full bg-cobalto-f"><span className="block h-2.5 rounded-full bg-ink" style={{ width: `${(casos / maxCasos) * 100}%` }} /></span>
                  <span className="w-16 text-right text-[13px]">{casos} casos</span>
                  <span className={`tag ${prazos >= 4 ? "tag-perigo" : prazos ? "tag-alerta" : ""}`}>{prazos} na semana</span>
                </li>
              ))}</ul>
            </section>
            <section className="painel">
              <div className="painel-cab"><h2>Valor em discussão por chance de êxito</h2></div>
              <dl className="grid grid-cols-3 gap-px bg-line-2">{provisao.map((p) => (
                <div key={p.r} className="bg-surface p-5"><dt className="text-[12.5px] font-semibold text-ink-3">{RISCO[p.r]}</dt><dd className="titulo mt-1 text-[22px]">{brlCurto(p.v)}</dd><dd className="text-[12.5px] text-ink-3">{p.n} casos</dd></div>
              ))}</dl>
              <p className="border-t border-line-2 px-5 py-2.5 text-[12.5px] text-ink-3">A chance de êxito é marcada na ficha de cada caso e serve para relatórios a clientes empresariais.</p>
            </section>
            <section className="painel">
              <div className="painel-cab"><h2>Prazos</h2></div>
              <dl className="grid grid-cols-2 gap-px bg-line-2">
                <div className="bg-surface p-5"><dt className="text-[12.5px] font-semibold text-ink-3">Cumpridos</dt><dd className="titulo mt-1 text-[22px]">{prazosFechados}</dd></div>
                <div className="bg-surface p-5"><dt className="text-[12.5px] font-semibold text-ink-3">Vencidos sem baixa</dt><dd className={`titulo mt-1 text-[22px] ${prazosVencidos ? "text-perigo" : ""}`}>{prazosVencidos}</dd></div>
              </dl>
              <div className="border-t border-line-2 p-5"><p className="mb-3 text-[13px] font-semibold">De onde vêm os clientes</p><Barras itens={origem} /></div>
            </section>
          </div>
        )}

        {aba === "conflito" && (
          <div className="max-w-[820px]">
            <p className="mb-3 text-ink-2">Antes de aceitar um cliente, confira se o nome dele ou da parte contrária já aparece no escritório, de um lado ou de outro (Código de Ética da OAB, arts. 19 a 22).</p>
            <label className="relative block"><Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-ink-3" /><input className="inp h-11 pl-10 text-[15px]" placeholder="Nome, CPF ou CNPJ (mínimo de 3 letras)" aria-label="Nome para checar conflito" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            {!achados ? <p className="mt-4 text-ink-3">Digite o nome da pessoa ou da empresa para checar.</p> : (achados.clientes.length + achados.contrarios.length + achados.mencoes.length + achados.contatos.length === 0) ? (
              <div className="painel mt-4"><Vazio titulo="Nenhuma ocorrência">“{q}” não aparece como cliente, parte contrária, contato de captação nem nas fichas dos casos.</Vazio></div>
            ) : (
              <div className="mt-4 space-y-4">
                {achados.contrarios.length > 0 && <section className="painel"><div className="painel-cab"><h2>É parte contrária em {achados.contrarios.length} {achados.contrarios.length === 1 ? "caso" : "casos"}</h2><span className="tag tag-perigo">Possível conflito</span></div><ul>{achados.contrarios.map((c) => <li key={c.id} className="border-b border-line-2 px-5 py-2.5 last:border-0"><LinkCaso caso={c} /><p className="text-[12.5px] text-perigo">Contrária: {c.parte_contraria}</p></li>)}</ul></section>}
                {achados.clientes.length > 0 && <section className="painel"><div className="painel-cab"><h2>Já é cliente</h2></div><ul>{achados.clientes.map((c) => <li key={c.id} className="border-b border-line-2 px-5 py-2.5 last:border-0"><Link href={`/clientes/${c.id}`} className="font-semibold hover:underline">{c.nome}</Link><span className="block text-[12.5px] text-ink-3">{c.documento}</span></li>)}</ul></section>}
                {achados.mencoes.length > 0 && <section className="painel"><div className="painel-cab"><h2>Citado na ficha de casos</h2></div><ul>{achados.mencoes.map((c) => <li key={c.id} className="border-b border-line-2 px-5 py-2.5 last:border-0"><LinkCaso caso={c} /></li>)}</ul></section>}
                {achados.contatos.length > 0 && <section className="painel"><div className="painel-cab"><h2>Contato na captação</h2></div><ul>{achados.contatos.map((l) => <li key={l.id} className="border-b border-line-2 px-5 py-2.5 last:border-0"><span className="font-semibold">{l.nome}</span><span className="block text-[12.5px] text-ink-3">{l.resumo}</span></li>)}</ul></section>}
              </div>
            )}
          </div>
        )}

        {aba === "procuracoes" && (
          <><div className="mb-4"><BotaoNovo rotulo="Registrar procuração" aoSalvar={(v) => { const c = db.casos.find((x) => x.id === v.caso_id); incluir("procuracoes", { caso_id: c?.id, cliente_nome: c?.cliente_nome ?? String(v.cliente ?? ""), tipo: (v.tipo ?? "procuração") as Procuracao["tipo"], outorgado: String(v.outorgado ?? ""), poderes: String(v.poderes ?? ""), data: String(v.data ?? hojeISO()), validade: v.validade ? String(v.validade) : undefined }); }}
            campos={[{ k: "caso_id", rotulo: "Caso", tipo: "opcoes", largo: true, opcoes: db.casos.map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }, { k: "cliente", rotulo: "Outorgante (se não houver caso)" }, { k: "tipo", rotulo: "Instrumento", tipo: "opcoes", inicial: "procuração", opcoes: ["procuração", "substabelecimento com reserva", "substabelecimento sem reserva"] }, { k: "outorgado", rotulo: "Outorgado", obrig: true }, { k: "data", rotulo: "Data", tipo: "data", inicial: hojeISO() }, { k: "validade", rotulo: "Validade (se houver)", tipo: "data" }, { k: "poderes", rotulo: "Poderes", tipo: "longo" }]} /></div>
          <div className="painel overflow-x-auto">
            <table className="tb min-w-[760px]"><thead><tr><th>Outorgante</th><th>Instrumento</th><th>Outorgado</th><th>Poderes</th><th>Data</th><th>Validade</th></tr></thead>
              <tbody>{[...db.procuracoes].sort((a, b) => (a.validade ?? "9999").localeCompare(b.validade ?? "9999")).map((p) => { const n = p.validade ? diasAte(p.validade) : null; return (
                <tr key={p.id}><td className="max-w-[220px]"><span className="block truncate font-semibold">{p.cliente_nome}</span>{caso(p.caso_id) && <Link href={`/casos/${p.caso_id}`} className="block truncate text-[12.5px] text-ink-3 hover:underline">{caso(p.caso_id)!.titulo}</Link>}</td>
                  <td><span className="tag">{p.tipo}</span></td><td>{p.outorgado}</td><td className="max-w-[260px] text-[13px] text-ink-2">{p.poderes}</td><td className="whitespace-nowrap">{data(p.data)}</td>
                  <td className="whitespace-nowrap">{n === null ? <span className="text-ink-3">Sem prazo</span> : <span className={`tag ${n < 0 ? "tag-perigo" : n <= 30 ? "tag-alerta" : ""}`}>{n < 0 ? `Venceu ${quando(p.validade!)}` : `Vence ${quando(p.validade!)}`}</span>}</td></tr>
              ); })}</tbody></table>
          </div></>
        )}

        {aba === "correspondentes" && (
          <><div className="mb-4"><BotaoNovo rotulo="Novo correspondente" aoSalvar={(v) => incluir("correspondentes", { nome: String(v.nome), cidade: String(v.cidade ?? ""), uf: String(v.uf ?? "").toUpperCase().slice(0, 2), servicos: String(v.servicos ?? ""), contato: String(v.contato ?? ""), valor_diligencia: Number(v.valor) || 0, avaliacao: Number(v.avaliacao) || 4 })}
            campos={[{ k: "nome", rotulo: "Nome", obrig: true, largo: true }, { k: "cidade", rotulo: "Cidade", obrig: true }, { k: "uf", rotulo: "UF" }, { k: "contato", rotulo: "Telefone ou e-mail" }, { k: "valor", rotulo: "Valor da diligência (R$)", tipo: "numero" }, { k: "avaliacao", rotulo: "Avaliação (1 a 5)", tipo: "opcoes", inicial: "4", opcoes: ["1", "2", "3", "4", "5"] }, { k: "servicos", rotulo: "Serviços", tipo: "longo" }]} /></div>
          <div className="painel overflow-x-auto">
            <table className="tb min-w-[680px]"><thead><tr><th>Correspondente</th><th>Praça</th><th>Serviços</th><th className="num">Diligência</th><th>Avaliação</th></tr></thead>
              <tbody>{db.correspondentes.map((c) => (
                <tr key={c.id}><td><span className="font-semibold">{c.nome}</span><span className="block text-[12.5px] text-ink-3">{c.contato}</span></td><td>{c.cidade}/{c.uf}</td><td className="max-w-[300px] text-[13px] text-ink-2">{c.servicos}</td><td className="num">{brl(c.valor_diligencia)}</td>
                  <td><span className="flex gap-0.5" aria-label={`${c.avaliacao} de 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="size-3.5" fill={i <= c.avaliacao ? "#0a0a0a" : "none"} stroke={i <= c.avaliacao ? "#0a0a0a" : "#bdbdbd"} />)}</span></td></tr>
              ))}</tbody></table>
          </div></>
        )}
      </div>
    </>
  );
}
