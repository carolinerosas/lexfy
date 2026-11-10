"use client";
import Link from "next/link";
import { ArrowRight, UserPlus, X } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { AREAS, areaDe } from "@/novo/lib/areas";
import { brl, hojeISO, quando, semAcento } from "@/novo/lib/format";
import { Cabecalho, TagArea } from "@/novo/components/ui";
import { BotaoNovo } from "@/novo/components/form-rapido";
import type { Lead } from "@/novo/lib/types";

const ETAPAS: Lead["etapa"][] = ["novo", "em análise", "proposta enviada", "fechado"];
const NOME: Record<Lead["etapa"], string> = { novo: "Novo contato", "em análise": "Em análise", "proposta enviada": "Proposta enviada", fechado: "Contrato fechado", descartado: "Descartado" };
const EXPLICA: Record<string, string> = {
  novo: "Chegou agora. Falta ouvir a pessoa.",
  "em análise": "Você está avaliando se pega a causa.",
  "proposta enviada": "Honorários propostos, aguardando resposta.",
  fechado: "Aceitou. Falta virar cliente e caso.",
};

export default function Captacao() {
  const db = useDB();
  const ativos = db.leads.filter((l) => l.etapa !== "descartado" && !l.convertido_caso_id);
  const propostas = db.leads.filter((l) => l.etapa === "proposta enviada").reduce((s, l) => s + (l.valor_proposta ?? 0), 0);
  const fechados = db.leads.filter((l) => l.etapa === "fechado").length;
  const decididos = db.leads.filter((l) => l.etapa === "fechado" || l.etapa === "descartado").length;

  /** Contato fechado vira cliente + caso (e honorário, se houve proposta). */
  function converter(l: Lead) {
    const area = areaDe(l.area);
    const existente = db.clientes.find((c) => semAcento(c.nome) === semAcento(l.nome));
    const ehFone = /\d{4}/.test(l.contato) && !l.contato.includes("@");
    const clienteId = existente?.id ?? incluir("clientes", { nome: l.nome, tipo: "pf", celular: ehFone ? l.contato : undefined, email: ehFone ? undefined : l.contato, origem: l.canal, observacoes: l.resumo, criado_em: hojeISO() });
    const resp = db.equipe.find((e) => e.areas.includes(area.id) && e.vinculo !== "estágio")?.id ?? db.equipe[0]?.id ?? "";
    const casoId = incluir("casos", { natureza: area.grupo, area: area.id, numero: "", titulo: l.resumo.length > 70 ? `${l.resumo.slice(0, 67)}…` : l.resumo, status: "ativo", fase: 0, cliente_id: clienteId, cliente_nome: l.nome, responsavel_id: resp, dados: {}, criado_em: hojeISO() });
    if (l.valor_proposta) incluir("honorarios", { caso_id: casoId, descricao: "Honorários contratuais", valor: l.valor_proposta, vencimento: hojeISO(), status: "pendente", tipo: "contratual" });
    incluir("anotacoes", { caso_id: casoId, texto: `Veio da captação (${l.canal}). Relato inicial: ${l.resumo}`, data: hojeISO(), autor_id: resp });
    alterar("leads", l.id, { convertido_caso_id: casoId });
  }

  return (
    <>
      <Cabecalho titulo="Captação" sub="Quem procurou o escritório e ainda não é cliente. O contato avança de etapa e, quando fecha contrato, vira cliente e caso com um clique.">
        <BotaoNovo rotulo="Novo contato" aoSalvar={(v) => incluir("leads", { nome: String(v.nome), contato: String(v.contato ?? ""), area: String(v.area ?? "civel"), resumo: String(v.resumo ?? ""), canal: String(v.canal ?? "WhatsApp"), urgencia: (v.urgencia ?? "media") as Lead["urgencia"], etapa: "novo", criado_em: hojeISO() })}
          campos={[{ k: "nome", rotulo: "Nome", obrig: true }, { k: "contato", rotulo: "Telefone ou e-mail" }, { k: "area", rotulo: "Área provável", tipo: "opcoes", inicial: "civel", opcoes: AREAS.map((a) => [a.id, a.nome] as const) }, { k: "canal", rotulo: "Canal", tipo: "opcoes", inicial: "WhatsApp", opcoes: ["WhatsApp", "Telefone", "Instagram", "Site", "Indicação", "Presencial"] }, { k: "urgencia", rotulo: "Urgência", tipo: "opcoes", inicial: "media", opcoes: [["alta", "Alta (prazo correndo ou pessoa presa)"], ["media", "Média"], ["baixa", "Baixa"]] }, { k: "resumo", rotulo: "O que a pessoa contou", tipo: "longo", obrig: true }]} />
      </Cabecalho>
      <p className="mb-4 text-ink-2">{ativos.length} contatos em aberto · {brl(propostas)} em propostas aguardando resposta · {decididos ? Math.round((fechados / decididos) * 100) : 0}% dos contatos decididos viraram contrato.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ETAPAS.map((etapa, i) => {
          const itens = db.leads.filter((l) => l.etapa === etapa);
          return (
            <section key={etapa} className="rounded-[16px] bg-porcelana">
              <h2 className="flex items-center justify-between px-4 pt-3.5 text-[13.5px] font-semibold">{NOME[etapa]}<span className="tag bg-white">{itens.length}</span></h2>
              <p className="px-4 pb-1 text-[12px] text-ink-3">{EXPLICA[etapa]}</p>
              <ul className="space-y-2 p-2">
                {itens.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-ink-3">Ninguém nesta etapa.</li>}
                {itens.map((l) => (
                  <li key={l.id} className="rounded-[12px] border border-line bg-surface p-3.5">
                    <p className="flex items-start justify-between gap-2"><span className="font-semibold">{l.nome}</span>{l.urgencia === "alta" && !l.convertido_caso_id && <span className="tag tag-perigo">Urgente</span>}</p>
                    <p className="mt-1 text-[13px] text-ink-2">{l.resumo}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3"><TagArea id={l.area} /><span>{l.canal}</span><span>{quando(l.criado_em)}</span></p>
                    <p className="mt-1 text-[12.5px] text-ink-3">{l.contato}</p>
                    {(etapa === "proposta enviada" || (etapa === "fechado" && !l.convertido_caso_id)) && (
                      <label className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2">Honorários (R$)<input type="number" className="inp h-8 w-28" value={l.valor_proposta ?? ""} onChange={(e) => alterar("leads", l.id, { valor_proposta: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    )}
                    {etapa === "fechado" && (l.convertido_caso_id ? (
                      <p className="mt-2.5 flex flex-wrap items-center gap-2"><span className="tag tag-ok">Já é cliente</span><Link href={`/casos/${l.convertido_caso_id}`} className="btn btn-g btn-sm">Abrir o caso<ArrowRight /></Link></p>
                    ) : (
                      <>
                        <button className="btn btn-p btn-sm mt-2.5 w-full" onClick={() => converter(l)}><UserPlus />Criar cliente e caso</button>
                        <p className="mt-1.5 text-[12px] text-ink-3">Cadastra o cliente, abre o caso em {areaDe(l.area).nome} e lança os honorários{l.valor_proposta ? ` de ${brl(l.valor_proposta)}` : ", se houver valor"}.</p>
                      </>
                    ))}
                    {i < ETAPAS.length - 1 && (
                      <div className="mt-2.5 flex gap-1.5">
                        <button className="btn btn-g btn-sm flex-1" onClick={() => alterar("leads", l.id, { etapa: ETAPAS[i + 1] })}>{NOME[ETAPAS[i + 1]]}<ArrowRight /></button>
                        <button className="btn btn-perigo btn-icone btn-sm" aria-label={`Descartar ${l.nome}`} title="Descartar" onClick={() => alterar("leads", l.id, { etapa: "descartado" })}><X /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {db.leads.some((l) => l.etapa === "descartado") && (
        <details className="mt-4 text-[13px] text-ink-2"><summary className="cursor-pointer font-semibold">Descartados ({db.leads.filter((l) => l.etapa === "descartado").length})</summary>
          <ul className="mt-2 space-y-1">{db.leads.filter((l) => l.etapa === "descartado").map((l) => <li key={l.id}>{l.nome}: {l.resumo} <button className="btn btn-q btn-sm" onClick={() => alterar("leads", l.id, { etapa: "novo" })}>Reabrir</button></li>)}</ul></details>
      )}
    </>
  );
}
