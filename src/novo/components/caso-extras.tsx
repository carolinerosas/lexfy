"use client";
import { useMemo, useState } from "react";
import { Loader2, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { alterar, incluir, useDB } from "@/novo/lib/store";
import { areaDe, tipoDoCaso, secaoVisivel } from "@/novo/lib/areas";
import { brl, data, hojeISO, hora } from "@/novo/lib/format";
import { pixCopiaECola } from "@/novo/lib/pix";
import { copiarTexto, linkWhatsApp } from "@/novo/lib/whatsapp";
import { Copiar, Dialogo, Rotulado, Vazio, valorCampo } from "./ui";
import { Acoes } from "./acoes";
import { BotaoNovo, type CampoF } from "./form-rapido";
import type { Caso, DB, Vinculado } from "@/novo/lib/types";

// ───────────────────────── processos vinculados ─────────────────────────

export const TIPOS_VINCULO = ["Apenso", "Habeas corpus", "Recurso", "Agravo", "Medidas protetivas", "Inquérito policial", "Auto de prisão em flagrante", "Execução", "Cumprimento de sentença", "Incidente", "Cautelar", "Processo de origem", "Outro"];
const SITUACOES = ["Em andamento", "Impetrado", "Liminar deferida", "Liminar indeferida", "Concedido", "Denegado", "Não conhecido", "Provido", "Desprovido", "Julgado", "Arquivado"];
const CAMPOS_VINCULO: CampoF[] = [
  { k: "tipo", rotulo: "Tipo", tipo: "opcoes", obrig: true, opcoes: TIPOS_VINCULO },
  { k: "numero", rotulo: "Número", obrig: true },
  { k: "tribunal", rotulo: "Tribunal ou órgão", dica: "Ex.: TJRJ, 3ª Câmara Criminal, STJ" },
  { k: "situacao", rotulo: "Situação", tipo: "opcoes", opcoes: SITUACOES },
  { k: "obs", rotulo: "Observação", tipo: "longo" },
];

export function Vinculados({ caso }: { caso: Caso }) {
  const lista = caso.vinculados ?? [];
  const gravar = (v: Vinculado[]) => alterar("casos", caso.id, { vinculados: v });
  const doForm = (v: Record<string, unknown>): Omit<Vinculado, "id"> => ({ tipo: String(v.tipo), numero: String(v.numero).trim(), tribunal: v.tribunal ? String(v.tribunal) : undefined, situacao: v.situacao ? String(v.situacao) : undefined, obs: v.obs ? String(v.obs) : undefined });
  return (
    <section className="painel">
      <div className="painel-cab">
        <h2>Processos vinculados</h2>
        <BotaoNovo rotulo="Incluir" titulo="Incluir processo vinculado" classe="btn btn-g btn-sm" campos={CAMPOS_VINCULO} aoSalvar={(v) => gravar([...lista, { id: crypto.randomUUID(), ...doForm(v) }])} />
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-4 text-[13.5px] text-ink-3">Apensos, habeas corpus, recursos, medidas protetivas e outros processos ligados a este caso.</p>
      ) : (
        <ul>{lista.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 px-4 py-2.5 last:border-0">
            <span className="tag">{v.tipo}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1"><span className="break-all font-mono text-[13.5px] font-semibold">{v.numero}</span><Copiar texto={v.numero} rotulo={`Copiar número do ${v.tipo.toLowerCase()}`} /></span>
              <span className="block text-[12.5px] text-ink-3">{[v.tribunal, v.situacao, v.obs].filter(Boolean).join(" · ")}</span>
            </span>
            <Acoes oQue="o processo vinculado" campos={CAMPOS_VINCULO} inicial={{ tipo: v.tipo, numero: v.numero, tribunal: v.tribunal ?? "", situacao: v.situacao ?? "", obs: v.obs ?? "" }}
              aoSalvar={(f) => gravar(lista.map((x) => (x.id === v.id ? { id: v.id, ...doForm(f) } : x)))} aoExcluir={() => gravar(lista.filter((x) => x.id !== v.id))} />
          </li>
        ))}</ul>
      )}
    </section>
  );
}

// ───────────────────────── resumo para copiar ─────────────────────────

export function resumoDoCaso(caso: Caso): string {
  const area = areaDe(caso.area);
  const tipo = tipoDoCaso(area, caso.dados);
  const l: string[] = [caso.titulo, `Cliente: ${caso.cliente_nome}`];
  if (caso.parte_contraria) l.push(`Parte contrária: ${caso.parte_contraria}`);
  if (caso.numero) l.push(`Processo: ${caso.numero}`);
  const local = [caso.orgao, caso.comarca && `${caso.comarca}${caso.uf ? `/${caso.uf}` : ""}`].filter(Boolean).join(", ");
  if (local) l.push(`Juízo: ${local}`);
  l.push(`Área: ${area.nome}${tipo ? ` (${tipo})` : ""}`);
  for (const v of caso.vinculados ?? []) l.push(`${v.tipo}: ${v.numero}${v.tribunal ? ` (${v.tribunal})` : ""}${v.situacao ? `, ${v.situacao.toLowerCase()}` : ""}`);
  for (const s of area.secoes) {
    if (!secaoVisivel(s, tipo, caso.dados)) continue;
    const linhas = s.campos.map((c) => [c, valorCampo(c, caso.dados[c.k])] as const).filter(([, v]) => v);
    if (!linhas.length) continue;
    l.push("", s.titulo.toUpperCase());
    linhas.forEach(([c, v]) => l.push(`${c.rotulo}: ${v}`));
  }
  return l.join("\n");
}

// ───────────────────────── mensagem ao cliente ─────────────────────────

export type Modelo = "honorarios" | "documentos" | "audiencia" | "andamento" | "livre";
const MODELOS: [Modelo, string][] = [["honorarios", "Honorários"], ["documentos", "Documentos que faltam"], ["audiencia", "Audiência"], ["andamento", "Andamento do processo"], ["livre", "Mensagem livre"]];

function montar(modelo: Modelo, caso: Caso, db: DB): string {
  const cliente = db.clientes.find((c) => c.id === caso.cliente_id);
  const nome = (cliente?.nome ?? caso.cliente_nome ?? "").split(" ")[0];
  const assina = db.config.responsavel || db.config.escritorio;
  const ola = `Olá, ${nome}, tudo bem?`;
  const ref = caso.numero ? `no processo ${caso.numero}` : `no seu caso (${caso.titulo})`;
  const hoje = hojeISO();

  if (modelo === "honorarios") {
    const abertos = db.honorarios.filter((h) => h.caso_id === caso.id && h.status === "pendente").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (!abertos.length) return `${ola}\n\nPassando para avisar que não há honorários em aberto ${ref}. Obrigada!\n\n${assina}`;
    const total = abertos.reduce((s, h) => s + h.valor, 0);
    const linhas = abertos.map((h) => `• ${h.descricao}: ${brl(h.valor)} (${h.vencimento < hoje ? "venceu" : "vence"} em ${data(h.vencimento)})`).join("\n");
    const chave = db.config.pix_chave?.trim();
    const pix = chave ? pixCopiaECola({ chave, nome: db.config.escritorio || db.config.responsavel, cidade: (db.config.cidade || "").split(",")[0], valor: abertos[0].valor, identificador: `H${abertos[0].id}`.slice(0, 25) }) : "";
    return `${ola}\n\nPassando para lembrar dos honorários ${ref}:\n${linhas}\n${abertos.length > 1 ? `\nTotal em aberto: ${brl(total)}\n` : ""}${pix ? `\nPix copia e cola da próxima parcela (${brl(abertos[0].valor)}):\n${pix}\n` : ""}\nSe já pagou, me mande o comprovante, por favor, que eu dou baixa aqui.\n\n${assina}`;
  }
  if (modelo === "documentos") {
    const faltam = (caso.docs_pendentes ?? []).filter((d) => !d.recebido);
    if (!faltam.length) return `${ola}\n\nRecebi todos os documentos que eu tinha pedido ${ref}. Obrigada!\n\n${assina}`;
    return `${ola}\n\nPara seguir ${ref}, ainda preciso destes documentos:\n${faltam.map((d) => `• ${d.nome}${d.obs ? ` (${d.obs})` : ""}`).join("\n")}\n\nPode mandar foto ou PDF por aqui mesmo. Qualquer dúvida, me chame.\n\n${assina}`;
  }
  if (modelo === "audiencia") {
    const prox = db.audiencias.filter((a) => a.caso_id === caso.id && !a.realizada && a.data_hora.slice(0, 10) >= hoje).sort((a, b) => a.data_hora.localeCompare(b.data_hora))[0];
    if (!prox) return `${ola}\n\nAinda não há audiência marcada ${ref}. Assim que o juízo designar, eu te aviso.\n\n${assina}`;
    const virtual = prox.modalidade === "virtual";
    return `${ola}\n\nLembrete da sua audiência ${ref}:\n• Dia: ${data(prox.data_hora)}, às ${hora(prox.data_hora)}\n• ${virtual ? "Por videochamada" : "Local"}: ${prox.local || "vou te confirmar"}\n• Tipo: ${prox.titulo}\n\n${virtual ? "Entre no link uns 15 minutos antes, num lugar silencioso, com a câmera ligada e o documento com foto em mãos." : "Chegue uns 30 minutos antes e leve documento com foto."} Se puder, me confirme que recebeu esta mensagem.\n\n${assina}`;
  }
  if (modelo === "andamento") {
    const ult = db.andamentos.filter((a) => a.caso_id === caso.id).sort((a, b) => b.data.localeCompare(a.data))[0];
    if (!ult) return `${ola}\n\nPassando para dar notícia ${ref}: até agora não houve movimentação nova. Sigo acompanhando e te aviso de qualquer novidade.\n\n${assina}`;
    return `${ola}\n\nNovidade ${ref}, de ${data(ult.data)}:\n${ult.texto_cliente || ult.descricao}\n\nSe quiser conversar sobre isso, é só me chamar.\n\n${assina}`;
  }
  return `${ola}\n\n\n\n${assina}`;
}

export function MensagemCliente({ caso, modeloInicial = "honorarios", rotulo = "Mensagem ao cliente", classe = "btn btn-g" }: { caso: Caso; modeloInicial?: Modelo; rotulo?: string; classe?: string }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [modelo, setModelo] = useState<Modelo>(modeloInicial);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const cliente = db.clientes.find((c) => c.id === caso.cliente_id);
  const trocar = (m: Modelo) => { setModelo(m); setTexto(montar(m, caso, db)); setAviso(""); };
  const podeCompartilhar = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      <button className={classe} onClick={() => { trocar(modeloInicial); setAberto(true); }}><MessageCircle />{rotulo}</button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Mensagem para ${caso.cliente_nome.split(" ")[0]}`}
        rodape={<>
          <button className="btn btn-g" onClick={async () => setAviso((await copiarTexto(texto)) ? "Mensagem copiada." : "O navegador bloqueou a cópia. Selecione o texto e copie à mão.")}>Copiar</button>
          {podeCompartilhar && <button className="btn btn-g" onClick={() => navigator.share({ text: texto }).catch(() => undefined)}><Share2 />Compartilhar</button>}
          <a className="btn btn-p" target="_blank" rel="noreferrer" href={linkWhatsApp(texto, cliente?.celular)}><MessageCircle />{cliente?.celular ? "Abrir no WhatsApp" : "Escolher contato no WhatsApp"}</a>
        </>}>
        <Rotulado rotulo="Assunto">
          <select className="inp" value={modelo} onChange={(e) => trocar(e.target.value as Modelo)}>{MODELOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        </Rotulado>
        <Rotulado rotulo="Texto (pode editar antes de enviar)" className="mt-3"><textarea className="inp min-h-[260px]" value={texto} onChange={(e) => setTexto(e.target.value)} /></Rotulado>
        <p className="mt-2 text-[12.5px] text-ink-3">{cliente?.celular ? `Vai para ${cliente.celular}.` : "O cliente não tem celular cadastrado: o WhatsApp abre para você escolher o contato. Cadastre o celular na ficha do cliente para ir direto."}</p>
        {aviso && <p role="status" className="mt-2 text-[13px] font-semibold">{aviso}</p>}
      </Dialogo>
    </>
  );
}

// ───────────────────────── andamentos nos tribunais, em lote ─────────────────────────

interface Mov { caso_id: string; data: string; descricao: string; fonte: string; chave: string }
type Estado = { st: "fila" | "buscando" | "ok" | "erro"; msg?: string; novos?: number };

const paraISO = (d: string) => (/^\d{2}\/\d{2}\/\d{4}/.test(d) ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : d.slice(0, 10));

/** Busca andamentos de vários processos e deixa escolher o que vai para o Justio. */
export function BuscarAndamentos({ casos, rotulo = "Buscar andamentos", classe = "btn btn-p" }: { casos: Caso[]; rotulo?: string; classe?: string }) {
  const db = useDB();
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [achados, setAchados] = useState<Mov[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [rodando, setRodando] = useState(false);
  const [salvos, setSalvos] = useState(0);
  const comNumero = useMemo(() => casos.filter((c) => c.numero && c.numero.replace(/\D/g, "").length === 20), [casos]);
  const semNumero = casos.length - comNumero.length;
  const porId = new Map(casos.map((c) => [c.id, c]));

  function abrir() {
    setEscolhidos(new Set(comNumero.filter((c) => c.status === "ativo").map((c) => c.id)));
    setEstado({}); setAchados([]); setMarcados(new Set()); setSalvos(0); setAberto(true);
  }

  async function buscar() {
    setRodando(true); setAchados([]); setMarcados(new Set()); setSalvos(0);
    const [{ parseCNJ }, { buscarMovimentosSistema }] = await Promise.all([import("@/lib/datajud"), import("@/lib/sistemas")]);
    const fila = comNumero.filter((c) => escolhidos.has(c.id));
    setEstado(Object.fromEntries(fila.map((c) => [c.id, { st: "fila" }])));
    const todos: Mov[] = [];
    for (const c of fila) {
      setEstado((e) => ({ ...e, [c.id]: { st: "buscando" } }));
      try {
        const { tribunal } = parseCNJ(c.numero);
        if (!tribunal) throw new Error("tribunal não reconhecido pelo número");
        const movs = await buscarMovimentosSistema(tribunal, c.numero);
        const ja = new Set(db.andamentos.filter((a) => a.caso_id === c.id).map((a) => `${a.data}|${a.descricao.trim().toLowerCase()}`));
        const novos = movs.map((m) => ({ caso_id: c.id, data: paraISO(m.data), descricao: m.descricao.trim(), fonte: m.fonte }))
          .filter((m) => m.data && m.descricao && !ja.has(`${m.data}|${m.descricao.toLowerCase()}`))
          .map((m) => ({ ...m, chave: `${m.caso_id}|${m.data}|${m.descricao}` }));
        const unicos = [...new Map(novos.map((m) => [m.chave, m])).values()];
        todos.push(...unicos);
        setEstado((e) => ({ ...e, [c.id]: { st: "ok", novos: unicos.length } }));
      } catch (err) {
        setEstado((e) => ({ ...e, [c.id]: { st: "erro", msg: err instanceof Error ? err.message : "erro na consulta" } }));
      }
    }
    todos.sort((a, b) => b.data.localeCompare(a.data));
    setAchados(todos);
    setMarcados(new Set(todos.map((m) => m.chave)));
    setRodando(false);
  }

  function salvar() {
    const lista = achados.filter((m) => marcados.has(m.chave));
    lista.forEach((m) => incluir("andamentos", { caso_id: m.caso_id, data: m.data, descricao: m.descricao, fonte: "tribunal", lido: false }));
    setSalvos(lista.length);
    setAchados(achados.filter((m) => !marcados.has(m.chave)));
    setMarcados(new Set());
  }

  const alternar = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const buscou = Object.keys(estado).length > 0;

  return (
    <>
      <button className={classe} onClick={abrir} disabled={comNumero.length === 0} title={comNumero.length === 0 ? "Nenhum processo com número CNJ completo" : undefined}><RefreshCw />{rotulo}</button>
      <Dialogo aberto={aberto} aoFechar={() => { if (!rodando) setAberto(false); }} titulo="Buscar andamentos nos tribunais" largo
        rodape={<>
          {salvos > 0 && <p role="status" className="mr-auto self-center font-semibold">{salvos} andamento{salvos > 1 ? "s" : ""} gravado{salvos > 1 ? "s" : ""} no Justio.</p>}
          {achados.length > 0 ? <button className="btn btn-p" disabled={marcados.size === 0} onClick={salvar}>Gravar {marcados.size} selecionado{marcados.size === 1 ? "" : "s"}</button>
            : <button className="btn btn-p" disabled={rodando || escolhidos.size === 0} onClick={buscar}>{rodando ? <Loader2 className="animate-spin" /> : <RefreshCw />}{rodando ? "Buscando…" : `Buscar em ${escolhidos.size} processo${escolhidos.size === 1 ? "" : "s"}`}</button>}
        </>}>
        {achados.length === 0 && (
          <>
            {casos.length > 1 && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                <button className="btn btn-g btn-sm" disabled={rodando} onClick={() => setEscolhidos(new Set(comNumero.map((c) => c.id)))}>Marcar todos</button>
                <button className="btn btn-g btn-sm" disabled={rodando} onClick={() => setEscolhidos(new Set())}>Desmarcar</button>
                {semNumero > 0 && <span className="text-ink-3">{semNumero} caso{semNumero > 1 ? "s" : ""} sem número CNJ completo fica{semNumero > 1 ? "m" : ""} de fora.</span>}
              </div>
            )}
            <ul className="divide-y divide-line-2 rounded-[12px] border border-line">
              {comNumero.map((c) => {
                const e = estado[c.id];
                return (
                  <li key={c.id}>
                    <label className="flex items-start gap-3 px-3 py-2.5">
                      <input type="checkbox" className="mt-1 size-4 shrink-0" disabled={rodando} checked={escolhidos.has(c.id)} onChange={() => setEscolhidos(alternar(escolhidos, c.id))} />
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{c.cliente_nome}: {c.titulo}</span><span className="block break-all font-mono text-[12.5px] text-ink-3">{c.numero}</span></span>
                      <span className="shrink-0 text-[12.5px]">{!e ? null : e.st === "buscando" ? <Loader2 className="size-4 animate-spin" /> : e.st === "fila" ? <span className="text-ink-3">na fila</span> : e.st === "ok" ? <span className={e.novos ? "font-semibold" : "text-ink-3"}>{e.novos ? `${e.novos} novo${e.novos > 1 ? "s" : ""}` : "nada novo"}</span> : <span className="text-perigo" title={e.msg}>não consultou</span>}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {buscou && !rodando && <p className="mt-3 text-[13px] text-ink-2">Nenhum andamento novo para gravar.{Object.values(estado).some((e) => e.st === "erro") ? " Alguns tribunais não responderam; passe o mouse em “não consultou” para ver o motivo." : ""}</p>}
            <p className="mt-3 text-[12.5px] text-ink-3">A consulta usa o DataJud do CNJ e as consultas públicas dos tribunais. Nada é gravado antes de você escolher.</p>
          </>
        )}
        {achados.length > 0 && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-semibold">{achados.length} andamento{achados.length > 1 ? "s" : ""} novo{achados.length > 1 ? "s" : ""}.</span>
              <button className="btn btn-g btn-sm" onClick={() => setMarcados(new Set(achados.map((m) => m.chave)))}>Marcar todos</button>
              <button className="btn btn-g btn-sm" onClick={() => setMarcados(new Set())}>Desmarcar</button>
            </div>
            <ul className="divide-y divide-line-2 rounded-[12px] border border-line">
              {achados.map((m) => {
                const c = porId.get(m.caso_id);
                return (
                  <li key={m.chave}>
                    <label className="flex items-start gap-3 px-3 py-2.5">
                      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={marcados.has(m.chave)} onChange={() => setMarcados(alternar(marcados, m.chave))} />
                      <span className="min-w-0 flex-1"><span className="block text-[12.5px] text-ink-3">{data(m.data)} · {c?.cliente_nome}{casos.length > 1 ? `: ${c?.titulo}` : ""}</span><span className="block">{m.descricao}</span></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {casos.length === 1 && comNumero.length === 0 && <Vazio titulo="Caso sem número CNJ completo">Cadastre o número do processo para buscar os andamentos.</Vazio>}
      </Dialogo>
    </>
  );
}

