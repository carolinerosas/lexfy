"use client";
import { useState } from "react";
import Link from "next/link";
import { addMonths, format } from "date-fns";
import { Check, Copy, MessageCircle, Plus, QrCode } from "lucide-react";
import { incluir, useDB } from "@/novo/lib/store";
import { brl, data, hojeISO } from "@/novo/lib/format";
import { pixCopiaECola } from "@/novo/lib/pix";
import { FormRapido, type Valores } from "./form-rapido";
import { Dialogo } from "./ui";
import type { Honorario } from "@/novo/lib/types";

/** Lança honorários de um caso: à vista ou com entrada e parcelas mensais. */
export function NovoHonorario({ casoId, classe = "btn btn-p", rotulo = "Lançar honorário" }: { casoId?: string; classe?: string; rotulo?: string }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);

  function salvar(v: Valores) {
    const caso = String(v.caso_id ?? casoId ?? "");
    const total = Number(v.valor) || 0;
    const entrada = Math.min(total, Number(v.entrada) || 0);
    const n = Math.max(1, Math.round(Number(v.parcelas) || 1));
    const tipo = (v.tipo as Honorario["tipo"]) ?? "contratual";
    const venc = String(v.vencimento || hojeISO());
    const desc = String(v.descricao || "Honorários");
    if (entrada > 0) incluir("honorarios", { caso_id: caso, descricao: `${desc}: entrada`, valor: entrada, vencimento: hojeISO(), status: v.entrada_paga ? "recebido" : "pendente", recebido_em: v.entrada_paga ? hojeISO() : undefined, tipo });
    const resto = total - entrada;
    if (resto > 0) {
      const base = new Date(`${venc}T12:00:00`);
      // inclui de trás para a frente para a lista ficar em ordem
      for (let i = n - 1; i >= 0; i--) {
        const valor = i === n - 1 ? Math.round((resto - Math.floor((resto / n) * 100) / 100 * (n - 1)) * 100) / 100 : Math.floor((resto / n) * 100) / 100;
        incluir("honorarios", { caso_id: caso, descricao: n === 1 ? desc : `${desc}: parcela ${i + 1} de ${n}`, valor, vencimento: format(addMonths(base, i), "yyyy-MM-dd"), status: "pendente", tipo });
      }
    }
  }

  return (
    <>
      <button className={classe} onClick={() => setAberto(true)}><Plus />{rotulo}</button>
      <FormRapido aberto={aberto} aoFechar={() => setAberto(false)} titulo="Lançar honorário" botao="Lançar" aoSalvar={salvar}
        inicial={{ caso_id: casoId ?? "", tipo: "contratual", parcelas: 1, vencimento: hojeISO() }}
        campos={[
          ...(casoId ? [] : [{ k: "caso_id", rotulo: "Caso", tipo: "opcoes" as const, obrig: true, largo: true, opcoes: db.casos.filter((c) => c.status === "ativo").map((c) => [c.id, `${c.cliente_nome}: ${c.titulo}`] as const) }]),
          { k: "descricao", rotulo: "Descrição", obrig: true, largo: true, inicial: "Honorários contratuais" },
          { k: "tipo", rotulo: "Tipo", tipo: "opcoes", opcoes: [["contratual", "Contratual"], ["êxito", "De êxito"], ["sucumbência", "Sucumbência"], ["consulta", "Consulta"], ["mensalidade", "Mensalidade de assessoria"]] },
          { k: "valor", rotulo: "Valor total (R$)", tipo: "numero", obrig: true },
          { k: "entrada", rotulo: "Entrada (R$)", tipo: "numero", dica: "Deixe em branco se não houver." },
          { k: "entrada_paga", rotulo: "Entrada já recebida", tipo: "check" },
          { k: "parcelas", rotulo: "Número de parcelas do restante", tipo: "numero" },
          { k: "vencimento", rotulo: "Vencimento da primeira parcela", tipo: "data" },
        ]} />
    </>
  );
}

/** Cobrança de um honorário pendente: Pix copia e cola e mensagem pronta para o WhatsApp. */
export function Cobrar({ honorario }: { honorario: Honorario }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState("");
  const caso = db.casos.find((c) => c.id === honorario.caso_id);
  const cliente = db.clientes.find((c) => c.id === caso?.cliente_id);
  const chave = db.config.pix_chave?.trim();
  const pix = chave ? pixCopiaECola({ chave, nome: db.config.escritorio || db.config.responsavel, cidade: (db.config.cidade || "").split(",")[0], valor: honorario.valor, identificador: `H${honorario.id}`.slice(0, 25) }) : "";
  const primeiro = (cliente?.nome ?? caso?.cliente_nome ?? "").split(" ")[0];
  const atrasado = honorario.vencimento < hojeISO();
  const msg = `Olá, ${primeiro}. ${atrasado ? "Consta em aberto" : "Lembrete"}: ${honorario.descricao.toLowerCase()} no valor de ${brl(honorario.valor)}, ${atrasado ? "vencida em" : "com vencimento em"} ${data(honorario.vencimento)}.${pix ? " Segue o Pix copia e cola:\n\n" + pix : ""}\n\n${db.config.escritorio}`;
  const fone = (cliente?.celular ?? "").replace(/\D/g, "");
  const copiar = async (texto: string, qual: string) => { try { await navigator.clipboard.writeText(texto); setCopiado(qual); } catch { setCopiado("erro"); } };

  return (
    <>
      <button className="btn btn-q btn-sm" onClick={() => { setCopiado(""); setAberto(true); }}><QrCode />Cobrar</button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Cobrar honorário">
        <p className="text-ink-2">{caso?.cliente_nome} · {honorario.descricao}</p>
        <p className="titulo mt-1 text-[30px]">{brl(honorario.valor)}</p>
        <p className={`text-[13px] ${atrasado ? "font-semibold text-perigo" : "text-ink-3"}`}>{atrasado ? "Venceu em" : "Vence em"} {data(honorario.vencimento)}</p>

        <h3 className="mt-5 text-[13px] font-semibold">Pix copia e cola</h3>
        {pix ? (
          <>
            <p className="mt-1.5 break-all rounded-[12px] bg-porcelana p-3 font-mono text-[12px] leading-relaxed">{pix}</p>
            <button className="btn btn-g btn-sm mt-2" onClick={() => copiar(pix, "pix")}>{copiado === "pix" ? <Check /> : <Copy />}{copiado === "pix" ? "Copiado" : "Copiar código"}</button>
          </>
        ) : <p className="mt-1.5 text-[13.5px] text-ink-2">Cadastre a chave Pix do escritório em <Link href="/configuracoes" className="font-semibold text-ink underline">Configurações</Link> para gerar o código.</p>}

        <h3 className="mt-5 text-[13px] font-semibold">Mensagem para o cliente</h3>
        <p className="mt-1.5 whitespace-pre-line break-words rounded-[12px] bg-porcelana p-3 text-[13px]">{msg}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-g btn-sm" onClick={() => copiar(msg, "msg")}>{copiado === "msg" ? <Check /> : <Copy />}{copiado === "msg" ? "Copiada" : "Copiar mensagem"}</button>
          {fone.length >= 10 && <a className="btn btn-p btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`}><MessageCircle />Abrir no WhatsApp</a>}
        </div>
        {copiado === "erro" && <p role="alert" className="mt-2 text-[13px] text-perigo">O navegador bloqueou a cópia. Selecione o texto e copie à mão.</p>}
        <p className="mt-4 text-[12.5px] text-ink-3">O código vale para a chave cadastrada e este valor. A baixa continua manual: quando o dinheiro cair, clique em “Dar baixa”.</p>
      </Dialogo>
    </>
  );
}
