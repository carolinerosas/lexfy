"use client";
import { useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { areaDe } from "@/novo/lib/areas";
import { brl, data, diasAte, hojeISO, horas, quando } from "@/novo/lib/format";
import { Abas, Avatar, Cabecalho, Dialogo, Rotulado, TagArea, Vazio, useMapas } from "@/novo/components/ui";
import type { Ausencia, Candidato, Colaborador, Treinamento } from "@/novo/lib/types";
import { BotaoNovo } from "@/novo/components/form-rapido";
import { PontoAba } from "@/novo/components/ponto";
import { AREAS } from "@/novo/lib/areas";

type Aba = "equipe" | "ausencias" | "ponto" | "folha" | "recrutamento" | "avaliacoes" | "capacitacao";
const ETAPAS: Candidato["etapa"][] = ["triagem", "entrevista", "prova prática", "proposta", "contratado"];
const TIPOS_AUS: Ausencia["tipo"][] = ["férias", "recesso de estágio", "licença médica", "folga", "licença-maternidade", "curso"];

export default function Pessoas() {
  const db = useDB();
  const { pessoa } = useMapas(db);
  const [aba, setAba] = useState<Aba>("equipe");
  const [ficha, setFicha] = useState<Colaborador | null>(null);
  const [na, setNa] = useState({ colaborador_id: "", tipo: TIPOS_AUS[0], inicio: "", fim: "", observacao: "" });
  const mes = hojeISO().slice(0, 7);

  // vencimentos que o escritório precisa vigiar
  const vencimentos = useMemo(() => db.equipe.flatMap((e) => ([
    ["Certificado digital", e.certificado_digital], ["Anuidade da OAB", e.anuidade_oab], ["Fim do contrato de estágio", e.fim_contrato_estagio], ["Exame periódico", e.exame_periodico],
  ] as const).filter(([, d]) => d).map(([rotulo, d]) => ({ e, rotulo, d: d!, n: diasAte(d!) }))).sort((a, b) => a.n - b.n), [db.equipe]);

  const linha = (e: Colaborador) => {
    const casos = db.casos.filter((c) => c.responsavel_id === e.id && c.status === "ativo").length;
    const prazos = db.prazos.filter((p) => p.responsavel_id === e.id && !p.concluido).length;
    const hs = db.horas.filter((h) => h.colaborador_id === e.id && h.data.startsWith(mes)).reduce((s, h) => s + h.minutos, 0);
    return { casos, prazos, hs };
  };
  const folha = db.equipe.filter((e) => e.ativo && e.remuneracao > 0);
  const totalFolha = folha.reduce((s, e) => s + e.remuneracao, 0);

  return (
    <>
      <Cabecalho titulo="Pessoas" sub="Equipe do escritório: vínculos, carga de trabalho, ausências, ponto, remuneração, seleção e desenvolvimento.">
        <BotaoNovo rotulo="Nova pessoa" titulo="Nova pessoa na equipe"
          aoSalvar={(v) => incluir("equipe", { nome: String(v.nome), cargo: String(v.cargo ?? ""), vinculo: (v.vinculo ?? "CLT") as Colaborador["vinculo"], oab: v.oab ? String(v.oab) : undefined, email: String(v.email ?? ""), celular: String(v.celular ?? ""), admissao: String(v.admissao ?? hojeISO()), nascimento: String(v.nascimento ?? ""), remuneracao: Number(v.remuneracao) || 0, areas: v.area ? [String(v.area)] : [], carga_semanal: Number(v.carga) || 40, meta_horas: v.meta ? Number(v.meta) : undefined, certificado_digital: v.certificado ? String(v.certificado) : undefined, fim_contrato_estagio: v.fim_estagio ? String(v.fim_estagio) : undefined, instituicao_ensino: v.instituicao ? String(v.instituicao) : undefined, ativo: true, cor: "#0a0a0a" })}
          campos={[{ k: "nome", rotulo: "Nome", obrig: true, largo: true }, { k: "cargo", rotulo: "Cargo", obrig: true }, { k: "vinculo", rotulo: "Vínculo", tipo: "opcoes", obrig: true, opcoes: ["sócia", "associado", "CLT", "estágio", "consultor"] }, { k: "oab", rotulo: "OAB" }, { k: "area", rotulo: "Área principal", tipo: "opcoes", opcoes: AREAS.map((a) => [a.id, a.nome] as const) }, { k: "email", rotulo: "E-mail" }, { k: "celular", rotulo: "Celular" }, { k: "admissao", rotulo: "Início no escritório", tipo: "data" }, { k: "nascimento", rotulo: "Nascimento", tipo: "data" }, { k: "remuneracao", rotulo: "Valor mensal (R$)", tipo: "numero" }, { k: "carga", rotulo: "Carga semanal (h)", tipo: "numero", inicial: 40 }, { k: "meta", rotulo: "Meta de horas no mês", tipo: "numero" }, { k: "certificado", rotulo: "Certificado digital vence em", tipo: "data" }, { k: "instituicao", rotulo: "Instituição de ensino (estágio)" }, { k: "fim_estagio", rotulo: "Fim do contrato de estágio", tipo: "data" }]} />
      </Cabecalho>
      <Abas valor={aba} aoMudar={setAba} abas={[["equipe", `Equipe (${db.equipe.length})`], ["ausencias", "Férias e ausências"], ["ponto", "Ponto e banco de horas"], ["folha", "Remuneração"], ["recrutamento", "Recrutamento"], ["avaliacoes", "Avaliações"], ["capacitacao", "Capacitação"]] as const} />
      <div className="mt-5">
        {aba === "equipe" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="painel overflow-x-auto">
              <table className="tb min-w-[760px]"><thead><tr><th>Pessoa</th><th>Vínculo</th><th>Áreas</th><th className="num">Casos</th><th className="num">Prazos</th><th>Horas no mês</th></tr></thead>
                <tbody>{db.equipe.map((e) => { const l = linha(e); return (
                  <tr key={e.id} className="cursor-pointer" onClick={() => setFicha(e)}>
                    <td><span className="flex items-center gap-3"><Avatar pessoa={e} tamanho={34} /><span><button className="font-semibold hover:underline" onClick={() => setFicha(e)}>{e.nome}</button><span className="block text-[12.5px] text-ink-3">{e.cargo}</span></span></span></td>
                    <td><span className="tag">{e.vinculo}</span>{e.oab && <span className="block pt-1 text-[12px] text-ink-3">{e.oab}</span>}</td>
                    <td><span className="flex max-w-[190px] flex-wrap gap-1">{e.areas.slice(0, 6).map((a) => <TagArea key={a} id={a} curto />)}{e.areas.length > 6 && <span className="text-[12px] text-ink-3">+{e.areas.length - 6}</span>}{e.areas.length === 0 && <span className="text-ink-3">Apoio</span>}</span></td>
                    <td className="num">{l.casos || "—"}</td><td className="num">{l.prazos || "—"}</td>
                    <td>{e.meta_horas ? <><span className="text-[13px]">{horas(l.hs)} <span className="text-ink-3">de {e.meta_horas}h</span></span><span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-cobalto-f"><span className="block h-1.5 bg-ink" style={{ width: `${Math.min(100, (l.hs / 60 / e.meta_horas) * 100)}%` }} /></span></> : <span className="text-ink-3">—</span>}</td>
                  </tr>
                ); })}</tbody></table>
            </div>
            <section className="painel h-fit">
              <div className="painel-cab"><h2>Vencimentos da equipe</h2></div>
              <ul>{vencimentos.map((v) => (
                <li key={v.e.id + v.rotulo} className="flex items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-0">
                  <Avatar pessoa={v.e} /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{v.rotulo}</span><span className="block truncate text-[12.5px] text-ink-3">{v.e.nome.split(" ")[0]} · {data(v.d)}</span></span>
                  <span className={`tag ${v.n <= 15 ? "tag-perigo" : v.n <= 60 ? "tag-alerta" : ""}`}>{quando(v.d)}</span>
                </li>
              ))}</ul>
              <p className="border-t border-line-2 px-5 py-2.5 text-[12.5px] text-ink-3">Certificado digital vencido impede o protocolo. O estágio tem limite de 2 anos no mesmo escritório (Lei 11.788/08, art. 11).</p>
            </section>
          </div>
        )}

        {aba === "ausencias" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="painel overflow-x-auto">
              {db.ausencias.length === 0 ? <Vazio titulo="Nenhuma ausência registrada" /> : (
                <table className="tb min-w-[620px]"><thead><tr><th>Pessoa</th><th>Tipo</th><th>Período</th><th>Situação</th><th /></tr></thead>
                  <tbody>{[...db.ausencias].sort((a, b) => a.inicio.localeCompare(b.inicio)).map((a) => { const p = pessoa(a.colaborador_id); const abertos = db.prazos.filter((z) => z.responsavel_id === a.colaborador_id && !z.concluido && z.data >= a.inicio && z.data <= a.fim).length; return (
                    <tr key={a.id}><td><span className="flex items-center gap-2.5"><Avatar pessoa={p} /><span className="font-semibold">{p?.nome}</span></span></td><td>{a.tipo}{a.observacao && <span className="block text-[12.5px] text-ink-3">{a.observacao}</span>}</td>
                      <td className="whitespace-nowrap">{data(a.inicio)}{a.fim !== a.inicio && <> a {data(a.fim)}</>}{abertos > 0 && <span className="block text-[12.5px] font-semibold text-perigo">{abertos} {abertos === 1 ? "prazo vence" : "prazos vencem"} no período</span>}</td>
                      <td><span className={`tag ${a.status === "aprovada" ? "tag-ok" : a.status === "recusada" ? "tag-perigo" : "tag-alerta"}`}>{a.status}</span></td>
                      <td className="num whitespace-nowrap">{a.status === "solicitada" && <><button className="btn btn-g btn-sm" onClick={() => alterar("ausencias", a.id, { status: "aprovada" })}>Aprovar</button> <button className="btn btn-perigo btn-sm" onClick={() => alterar("ausencias", a.id, { status: "recusada" })}>Recusar</button></>}</td></tr>
                  ); })}</tbody></table>
              )}
            </div>
            <form className="painel h-fit space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (!na.colaborador_id || !na.inicio) return; incluir("ausencias", { ...na, fim: na.fim || na.inicio, observacao: na.observacao || undefined, status: "solicitada" }); setNa({ ...na, inicio: "", fim: "", observacao: "" }); }}>
              <h2 className="titulo text-[16px]">Registrar ausência</h2>
              <Rotulado rotulo="Pessoa"><select className="inp" value={na.colaborador_id} onChange={(e) => setNa({ ...na, colaborador_id: e.target.value })}><option value="">Escolher</option>{db.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Rotulado>
              <Rotulado rotulo="Tipo"><select className="inp" value={na.tipo} onChange={(e) => setNa({ ...na, tipo: e.target.value as Ausencia["tipo"] })}>{TIPOS_AUS.map((t) => <option key={t}>{t}</option>)}</select></Rotulado>
              <div className="grid grid-cols-2 gap-3"><Rotulado rotulo="De"><input type="date" className="inp" value={na.inicio} onChange={(e) => setNa({ ...na, inicio: e.target.value })} /></Rotulado><Rotulado rotulo="Até"><input type="date" className="inp" value={na.fim} onChange={(e) => setNa({ ...na, fim: e.target.value })} /></Rotulado></div>
              <Rotulado rotulo="Observação"><input className="inp" value={na.observacao} onChange={(e) => setNa({ ...na, observacao: e.target.value })} /></Rotulado>
              <button className="btn btn-p w-full" disabled={!na.colaborador_id || !na.inicio}><Plus />Registrar</button>
              <p className="text-[12.5px] text-ink-3">O sistema avisa quando há prazo da pessoa vencendo dentro do período, para redistribuir antes de aprovar.</p>
            </form>
          </div>
        )}

        {aba === "ponto" && <PontoAba />}

        {aba === "folha" && (
          <div className="space-y-4">
            <p className="text-ink-2">Custo mensal com a equipe: <strong className="titulo text-[20px] text-ink">{brl(totalFolha)}</strong> <span className="text-ink-3">(sem encargos; o cálculo da folha é do contador)</span></p>
            <div className="painel overflow-x-auto">
              <table className="tb min-w-[640px]"><thead><tr><th>Pessoa</th><th>Vínculo</th><th>Desde</th><th>Carga semanal</th><th className="num">Valor mensal</th><th>Observação</th></tr></thead>
                <tbody>{folha.map((e) => (
                  <tr key={e.id}><td><span className="flex items-center gap-2.5"><Avatar pessoa={e} /><span className="font-semibold">{e.nome}</span></span></td><td>{e.vinculo}</td><td>{data(e.admissao)}</td><td>{e.carga_semanal}h</td><td className="num font-semibold">{brl(e.remuneracao)}</td>
                    <td className="text-[12.5px] text-ink-2">{e.vinculo === "estágio" ? "Bolsa e auxílio-transporte (Lei 11.788/08, art. 12); recesso de 30 dias a cada ano" : e.vinculo === "associado" ? "Contrato de associação averbado na OAB; participação nos honorários" : e.vinculo === "CLT" ? "Salário, 13º, férias e FGTS" : "Remuneração por contrato de prestação de serviços"}</td></tr>
                ))}</tbody></table>
            </div>
          </div>
        )}

        {aba === "recrutamento" && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <BotaoNovo rotulo="Abrir vaga" aoSalvar={(v) => incluir("vagas", { titulo: String(v.titulo), vinculo: String(v.vinculo ?? "CLT"), area: String(v.area ?? "civel"), aberta_em: hojeISO(), status: "aberta" })}
                campos={[{ k: "titulo", rotulo: "Título da vaga", obrig: true, largo: true }, { k: "vinculo", rotulo: "Vínculo", tipo: "opcoes", opcoes: ["associado", "CLT", "estágio", "consultor"] }, { k: "area", rotulo: "Área", tipo: "opcoes", opcoes: AREAS.map((a) => [a.id, a.nome] as const) }]} />
              {db.vagas.length > 0 && <BotaoNovo rotulo="Incluir candidato" classe="btn btn-g" aoSalvar={(v) => incluir("candidatos", { vaga_id: String(v.vaga_id), nome: String(v.nome), etapa: "triagem", origem: String(v.origem ?? "Site"), nota: v.nota ? Number(v.nota) : undefined })}
                campos={[{ k: "vaga_id", rotulo: "Vaga", tipo: "opcoes", obrig: true, largo: true, opcoes: db.vagas.map((x) => [x.id, x.titulo] as const) }, { k: "nome", rotulo: "Nome", obrig: true }, { k: "origem", rotulo: "Como chegou", tipo: "opcoes", opcoes: ["Indicação", "Site", "LinkedIn", "Faculdade", "Instagram"] }, { k: "nota", rotulo: "Nota do currículo (0 a 10)", tipo: "numero" }]} />}
            </div>
            {db.vagas.map((v) => (
              <section key={v.id}>
                <h2 className="titulo mb-3 flex flex-wrap items-center gap-2.5 text-[18px]">{v.titulo}<span className="tag">{v.vinculo}</span><span className="tag">{areaDe(v.area).nome}</span><span className="text-[12.5px] font-normal text-ink-3" style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>aberta {quando(v.aberta_em)}</span></h2>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {ETAPAS.map((etapa, i) => { const itens = db.candidatos.filter((c) => c.vaga_id === v.id && c.etapa === etapa); return (
                    <div key={etapa} className="rounded-[16px] bg-porcelana">
                      <h3 className="flex items-center justify-between px-4 pb-1 pt-3.5 text-[13px] font-semibold first-letter:uppercase">{etapa}<span className="tag bg-white">{itens.length}</span></h3>
                      <ul className="min-h-[56px] space-y-2 p-2">{itens.map((c) => (
                        <li key={c.id} className="rounded-[12px] border border-line bg-surface p-3">
                          <p className="font-semibold">{c.nome}</p><p className="text-[12.5px] text-ink-3">{c.origem}{c.nota ? ` · nota ${c.nota}` : ""}</p>
                          {i < ETAPAS.length - 1 && <div className="mt-2 flex gap-1.5"><button className="btn btn-g btn-sm flex-1" onClick={() => alterar("candidatos", c.id, { etapa: ETAPAS[i + 1] })}>Avançar<ArrowRight /></button><button className="btn btn-perigo btn-sm" onClick={() => alterar("candidatos", c.id, { etapa: "dispensado" })}>Dispensar</button></div>}
                        </li>
                      ))}</ul>
                    </div>
                  ); })}
                </div>
              </section>
            ))}
          </div>
        )}

        {aba === "avaliacoes" && (
          <><div className="mb-4"><BotaoNovo rotulo="Nova avaliação" aoSalvar={(v) => incluir("avaliacoes", { colaborador_id: String(v.colaborador_id), ciclo: String(v.ciclo ?? ""), tecnica: Number(v.tecnica) || 3, prazos: Number(v.prazos) || 3, atendimento: Number(v.atendimento) || 3, equipe: Number(v.equipe) || 3, comentario: String(v.comentario ?? ""), metas: String(v.metas ?? "") })}
            campos={[{ k: "colaborador_id", rotulo: "Pessoa", tipo: "opcoes", obrig: true, opcoes: db.equipe.map((e) => [e.id, e.nome] as const) }, { k: "ciclo", rotulo: "Ciclo", inicial: `${new Date().getFullYear()}/2` }, ...(["tecnica:Técnica", "prazos:Prazos", "atendimento:Atendimento", "equipe:Trabalho em equipe"].map((x) => ({ k: x.split(":")[0], rotulo: `${x.split(":")[1]} (1 a 5)`, tipo: "opcoes" as const, inicial: "3", opcoes: ["1", "2", "3", "4", "5"] }))), { k: "comentario", rotulo: "Comentário", tipo: "longo" }, { k: "metas", rotulo: "Meta do próximo ciclo", tipo: "longo" }]} /></div>
          <div className="grid gap-5 md:grid-cols-2">
            {db.avaliacoes.map((a) => { const p = pessoa(a.colaborador_id); const notas = [["Técnica", a.tecnica], ["Prazos", a.prazos], ["Atendimento", a.atendimento], ["Equipe", a.equipe]] as const; return (
              <section key={a.id} className="painel p-5">
                <p className="flex items-center gap-3"><Avatar pessoa={p} tamanho={36} /><span className="flex-1"><span className="titulo block text-[16px]">{p?.nome}</span><span className="text-[12.5px] text-ink-3">{p?.cargo} · ciclo {a.ciclo}</span></span><span className="titulo text-[26px]">{(notas.reduce((s, [, n]) => s + n, 0) / 4).toFixed(1)}</span></p>
                <dl className="mt-4 grid grid-cols-4 gap-3">{notas.map(([k, n]) => (
                  <div key={k}><dt className="text-[12px] text-ink-3">{k}</dt><dd className="mt-1 flex gap-0.5" aria-label={`${n} de 5`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= n ? "#0a0a0a" : "#e4e4e4" }} />)}</dd></div>
                ))}</dl>
                <p className="mt-4 text-[13.5px]">{a.comentario}</p>
                <p className="mt-2 text-[13px] text-ink-2"><span className="font-semibold text-ink">Meta do próximo ciclo:</span> {a.metas}</p>
              </section>
            ); })}
          </div></>
        )}

        {aba === "capacitacao" && (
          <><div className="mb-4"><BotaoNovo rotulo="Registrar curso" aoSalvar={(v) => incluir("treinamentos", { colaborador_id: String(v.colaborador_id), titulo: String(v.titulo), instituicao: String(v.instituicao ?? ""), horas: Number(v.horas) || 0, status: (v.status ?? "planejado") as Treinamento["status"], conclusao: v.conclusao ? String(v.conclusao) : undefined })}
            campos={[{ k: "colaborador_id", rotulo: "Pessoa", tipo: "opcoes", obrig: true, opcoes: db.equipe.map((e) => [e.id, e.nome] as const) }, { k: "titulo", rotulo: "Curso", obrig: true }, { k: "instituicao", rotulo: "Instituição" }, { k: "horas", rotulo: "Carga horária", tipo: "numero" }, { k: "status", rotulo: "Situação", tipo: "opcoes", inicial: "planejado", opcoes: ["planejado", "em curso", "concluído"] }, { k: "conclusao", rotulo: "Concluído em", tipo: "data" }]} /></div>
          <div className="painel overflow-x-auto">
            <table className="tb min-w-[620px]"><thead><tr><th>Pessoa</th><th>Curso</th><th>Instituição</th><th className="num">Horas</th><th>Situação</th></tr></thead>
              <tbody>{db.treinamentos.map((t) => { const p = pessoa(t.colaborador_id); return (
                <tr key={t.id}><td><span className="flex items-center gap-2.5"><Avatar pessoa={p} /><span className="font-semibold">{p?.nome}</span></span></td><td>{t.titulo}</td><td>{t.instituicao}</td><td className="num">{t.horas}h</td>
                  <td><span className={`tag ${t.status === "concluído" ? "tag-ok" : t.status === "em curso" ? "tag-info" : ""}`}>{t.status}</span>{t.conclusao && <span className="ml-2 text-[12.5px] text-ink-3">{data(t.conclusao)}</span>}</td></tr>
              ); })}</tbody></table>
          </div></>
        )}
      </div>

      <Dialogo aberto={!!ficha} aoFechar={() => setFicha(null)} titulo={ficha?.nome ?? ""}>
        {ficha && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {([["Cargo", ficha.cargo], ["Vínculo", ficha.vinculo], ["OAB", ficha.oab], ["E-mail", ficha.email], ["Celular", ficha.celular], ["No escritório desde", data(ficha.admissao)], ["Aniversário", data(ficha.nascimento).slice(0, 5)], ["Carga semanal", `${ficha.carga_semanal}h`], ["Meta de horas no mês", ficha.meta_horas ? `${ficha.meta_horas}h` : undefined], ["Instituição de ensino", ficha.instituicao_ensino], ["Certificado digital vence em", ficha.certificado_digital && data(ficha.certificado_digital)], ["Contrato de estágio termina em", ficha.fim_contrato_estagio && data(ficha.fim_contrato_estagio)]] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-[12px] font-semibold text-ink-3">{k}</dt><dd className="break-words">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="text-[12px] font-semibold text-ink-3">Áreas</dt><dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">{ficha.areas.length ? ficha.areas.map((a) => <TagArea key={a} id={a} />) : "Apoio administrativo"}</dd></div>
          </dl>
        )}
      </Dialogo>
    </>
  );
}
