"use client";
// Importar do Cowork: a advogada cola o JSON que o Cowork extraiu do PDF dos autos,
// revisa campo a campo e confirma. Só depois da confirmação o sistema grava.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, FileSearch } from "lucide-react";
import { aguardarGravacoes, alterar, incluir, lerDB, useDB } from "@/novo/lib/store";
import { createIncidente, getIncidentesByProcesso } from "@/lib/store";
import { AREAS, areaDe } from "@/novo/lib/areas";
import { data, hojeISO, semAcento } from "@/novo/lib/format";
import { copiarTexto } from "@/novo/lib/whatsapp";
import { instrucoesCowork, lerImportacao, type Importacao } from "@/novo/lib/importacao";
import { BotaoInfo, CampoArea, Rotulado } from "./ui";
import type { Caso, Cliente, RecursoPedido } from "@/novo/lib/types";

const ROTULO_PEDIDO: Record<string, string> = { progressao_regime: "Progressão de regime", livramento_condicional: "Livramento condicional", remicao: "Remição", saida_temporaria: "Saída temporária", trabalho_extramuros: "Trabalho extramuros", regressao: "Regressão", unificacao_penas: "Unificação de penas", detracao: "Detração", indulto: "Indulto", comutacao: "Comutação", extincao_pena: "Extinção da pena", outro: "Outro" };
const ROTULO_STATUS: Record<string, string> = { protocolado: "Protocolado", em_andamento: "Em andamento", deferido: "Deferido", parcialmente_deferido: "Parcialmente deferido", indeferido: "Indeferido", cumprido: "Cumprido", arquivado: "Arquivado" };

const dig = (s?: string) => String(s ?? "").replace(/\D/g, "");
type Marcas = Record<string, boolean>;
const todas = (n: number, ja: (i: number) => boolean): Marcas => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), !ja(i)]));

export function ImportarCowork() {
  const db = useDB();
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [imp, setImp] = useState<Importacao | null>(null);
  const [cli, setCli] = useState<Record<string, string>>({});
  const [proc, setProc] = useState<Record<string, string>>({});
  const [clienteAlvo, setClienteAlvo] = useState("novo");
  const [casoAlvo, setCasoAlvo] = useState("novo");
  const [ficha, setFicha] = useState<Record<string, string | number>>({});
  const [usarCampo, setUsarCampo] = useState<Marcas>({});
  const [sel, setSel] = useState<{ prazos: Marcas; audiencias: Marcas; andamentos: Marcas; vinculados: Marcas; pendencias: Marcas; pedidos: Marcas }>({ prazos: {}, audiencias: {}, andamentos: {}, vinculados: {}, pendencias: {}, pedidos: {} });
  const [gravando, setGravando] = useState(false);
  const [feito, setFeito] = useState<{ casoId: string; resumo: string } | null>(null);

  const casoExistente = db.casos.find((c) => c.id === casoAlvo);
  const clienteExistente = db.clientes.find((c) => c.id === clienteAlvo);
  const area = areaDe(proc.area);

  async function copiar() { setCopiado(await copiarTexto(instrucoesCowork())); setTimeout(() => setCopiado(false), 2500); }

  /** Lê o texto colado e prepara a revisão. `areaForcada` relê a ficha quando a área é trocada. */
  function ler(areaForcada?: string) {
    setErro(""); setFeito(null);
    let r: Importacao;
    try { r = lerImportacao(texto, areaForcada); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui ler o texto."); setImp(null); return; }
    setImp(r);
    const c = r.cliente, p = r.processo;
    if (!areaForcada) {
      setCli({ nome: c.nome, tipo: c.tipo, documento: c.documento ?? "", email: c.email ?? "", celular: c.celular ?? "", cidade: c.cidade ?? "", uf: c.uf ?? "", profissao: c.profissao ?? "", qualificacao: c.qualificacao.join("\n") });
      const porDoc = dig(c.documento).length >= 11 ? db.clientes.find((x) => dig(x.documento) === dig(c.documento)) : undefined;
      const porNome = db.clientes.find((x) => c.nome && semAcento(x.nome) === semAcento(c.nome));
      setClienteAlvo((porDoc ?? porNome)?.id ?? "novo");
      const porNumero = dig(p.numero).length === 20 ? db.casos.find((x) => dig(x.numero) === dig(p.numero)) : undefined;
      setCasoAlvo(porNumero?.id ?? "novo");
    }
    setProc({ area: p.area, titulo: p.titulo, numero: p.numero, orgao: p.orgao ?? "", comarca: p.comarca ?? "", uf: p.uf ?? "", parte_contraria: p.parte_contraria ?? "", valor: p.valor !== undefined ? String(p.valor) : "", distribuido_em: p.distribuido_em ?? "", fase: String(p.fase) });
    setFicha(r.ficha);
    const caso = db.casos.find((x) => dig(p.numero).length === 20 && dig(x.numero) === dig(p.numero));
    // num caso já cadastrado, valor diferente do atual só substitui se a advogada marcar
    setUsarCampo(Object.fromEntries(Object.keys(r.ficha).map((k) => { const atual = caso?.dados[k]; return [k, atual === undefined || atual === "" || String(atual) === String(r.ficha[k])]; })));
    const doCaso = <T,>(lista: T[]) => (caso ? lista.filter((x) => (x as { caso_id: string }).caso_id === caso.id) : []);
    const prazosJa = doCaso(db.prazos), audJa = doCaso(db.audiencias), andJa = doCaso(db.andamentos);
    setSel({
      prazos: todas(r.prazos.length, (i) => prazosJa.some((z) => z.data === r.prazos[i].data && semAcento(z.titulo) === semAcento(r.prazos[i].titulo))),
      audiencias: todas(r.audiencias.length, (i) => audJa.some((z) => z.data_hora.slice(0, 16) === r.audiencias[i].data_hora.slice(0, 16))),
      andamentos: todas(r.andamentos.length, (i) => andJa.some((z) => z.data === r.andamentos[i].data && semAcento(z.descricao).startsWith(semAcento(r.andamentos[i].descricao).slice(0, 40)))),
      vinculados: todas(r.vinculados.length, (i) => (caso?.vinculados ?? []).some((v) => dig(v.numero) === dig(r.vinculados[i].numero))),
      pendencias: todas(r.pendencias.length, () => false),
      pedidos: todas(r.pedidos.length, () => false),
    });
    // pedidos que o caso já tem (mesmo tipo e mesma data do pedido) começam desmarcados
    if (caso && r.pedidos.length) getIncidentesByProcesso(caso.id).then((ja) => setSel((x) => ({ ...x, pedidos: todas(r.pedidos.length, (i) => ja.some((z) => z.tipo === r.pedidos[i].tipo && (z.data_pedido ?? "") === (r.pedidos[i].data_pedido ?? ""))) }))).catch(() => {});
  }

  const conta = useMemo(() => ({
    campos: Object.keys(ficha).filter((k) => usarCampo[k]).length,
    prazos: Object.values(sel.prazos).filter(Boolean).length, audiencias: Object.values(sel.audiencias).filter(Boolean).length,
    andamentos: Object.values(sel.andamentos).filter(Boolean).length, vinculados: Object.values(sel.vinculados).filter(Boolean).length,
    pendencias: Object.values(sel.pendencias).filter(Boolean).length,
    pedidos: area.id === "execucao_penal" ? Object.values(sel.pedidos).filter(Boolean).length : 0,
  }), [ficha, usarCampo, sel, area.id]);

  async function confirmar() {
    if (!imp || gravando) return;
    if (!cli.nome?.trim()) return setErro("Informe o nome do cliente.");
    if (!proc.titulo?.trim()) return setErro("Informe o título do caso.");
    setErro("");
    const vazio = (v: unknown) => v === undefined || v === null || v === "";
    const obsQualif = cli.qualificacao?.trim() ? `Qualificação (importada dos autos em ${data(hojeISO())}):\n${cli.qualificacao.trim()}` : "";

    // 1. cliente: novo, ou o existente completado só onde está vazio
    let clienteId: string, clienteNome: string;
    const novoCli = { nome: cli.nome.trim(), tipo: (cli.tipo === "pj" ? "pj" : "pf") as Cliente["tipo"], documento: cli.documento || undefined, email: cli.email || undefined, celular: cli.celular || undefined, cidade: cli.cidade || undefined, uf: cli.uf || undefined, profissao: cli.profissao || undefined };
    if (clienteExistente) {
      const mud: Partial<Cliente> = {};
      (["documento", "email", "celular", "cidade", "uf", "profissao"] as const).forEach((k) => { if (vazio(clienteExistente[k]) && novoCli[k]) mud[k] = novoCli[k]; });
      if (obsQualif && !(clienteExistente.observacoes ?? "").includes(cli.qualificacao.trim().split("\n")[0])) mud.observacoes = [clienteExistente.observacoes, obsQualif].filter(Boolean).join("\n\n");
      if (Object.keys(mud).length) alterar("clientes", clienteExistente.id, mud);
      clienteId = clienteExistente.id; clienteNome = clienteExistente.nome;
    } else {
      clienteId = incluir("clientes", { ...novoCli, observacoes: obsQualif || undefined, criado_em: hojeISO() });
      clienteNome = novoCli.nome;
    }

    // 2. caso
    const dadosNovos = Object.fromEntries(Object.entries(ficha).filter(([k]) => usarCampo[k]));
    const vincs = imp.vinculados.filter((_, i) => sel.vinculados[i]).map((v) => ({ id: crypto.randomUUID(), tipo: v.tipo, numero: v.numero, situacao: v.situacao }));
    const resp = db.equipe.find((e) => e.ativo && e.areas.includes(area.id))?.id ?? db.equipe[0]?.id ?? "e1";
    const topo = { numero: proc.numero.trim(), titulo: proc.titulo.trim(), orgao: proc.orgao || undefined, comarca: proc.comarca || undefined, uf: proc.uf || "RJ", parte_contraria: proc.parte_contraria || undefined, valor: proc.valor ? Number(proc.valor) : undefined, distribuido_em: proc.distribuido_em || undefined };
    let casoId: string;
    if (casoExistente) {
      const mud: Partial<Caso> = { fase: Number(proc.fase), dados: { ...casoExistente.dados, ...dadosNovos } };
      (Object.keys(topo) as (keyof typeof topo)[]).forEach((k) => { if (vazio(casoExistente[k]) && !vazio(topo[k])) (mud as Record<string, unknown>)[k] = topo[k]; });
      if (casoExistente.area !== area.id) { mud.area = area.id; mud.natureza = area.grupo; }
      if (vincs.length) mud.vinculados = [...(casoExistente.vinculados ?? []), ...vincs];
      alterar("casos", casoExistente.id, mud);
      casoId = casoExistente.id;
    } else {
      casoId = incluir("casos", {
        natureza: area.grupo, area: area.id, ...topo, status: "ativo", fase: Number(proc.fase), cliente_id: clienteId, cliente_nome: clienteNome,
        responsavel_id: resp, dados: dadosNovos, vinculados: vincs.length ? vincs : undefined, criado_em: hojeISO(),
      });
    }
    const respCaso = casoExistente?.responsavel_id ?? resp;

    // 3. prazos, audiências, andamentos e pendências (como tarefas)
    imp.prazos.forEach((z, i) => { if (sel.prazos[i]) incluir("prazos", { caso_id: casoId, titulo: z.titulo, data: z.data, fatal: z.fatal, concluido: false, prioridade: "alta", responsavel_id: respCaso, base: `Importado dos autos${z.fonte ? ` (${z.fonte})` : ""}. Confira a contagem.` }); });
    const agora = new Date().toISOString().slice(0, 16);
    imp.audiencias.forEach((a, i) => { if (sel.audiencias[i]) incluir("audiencias", { caso_id: casoId, titulo: a.titulo, data_hora: a.data_hora, local: a.local, modalidade: a.modalidade, realizada: a.data_hora.slice(0, 16) < agora, responsavel_id: respCaso, observacoes: "Importada dos autos." }); });
    imp.andamentos.forEach((a, i) => { if (sel.andamentos[i]) incluir("andamentos", { caso_id: casoId, data: a.data, descricao: a.fonte ? `${a.descricao} (${a.fonte})` : a.descricao, fonte: "tribunal", lido: true }); });
    imp.pendencias.forEach((t, i) => { if (sel.pendencias[i]) incluir("tarefas", { caso_id: casoId, titulo: t, estado: "a fazer", prioridade: "media", responsavel_id: respCaso }); });

    // 4. pedidos da execução penal (aba Incidentes), cada um com a decisão e o recurso
    if (conta.pedidos) {
      setGravando(true);
      try {
        await aguardarGravacoes(); // o caso precisa estar no banco antes dos pedidos
        const recursos: Record<string, RecursoPedido> = {};
        for (const [i, x] of imp.pedidos.entries()) {
          if (!sel.pedidos[i]) continue;
          const inc = await createIncidente({ processo_id: casoId, titulo: x.titulo, tipo: x.tipo, status: x.status, data_pedido: x.data_pedido, data_decisao: x.data_decisao, resultado: x.resultado });
          if (x.recurso) recursos[inc.id] = x.recurso;
        }
        if (Object.keys(recursos).length) {
          const c = lerDB().casos.find((y) => y.id === casoId);
          const ex = c?.execucao ?? { crimes: [], remicoes: [], interrupcoes: [] };
          alterar("casos", casoId, { execucao: { ...ex, recursos: { ...(ex.recursos ?? {}), ...recursos } } });
        }
      } catch (e) {
        setErro(`O caso foi gravado, mas os pedidos da execução não: ${e instanceof Error ? e.message : "erro"}. Lance-os na aba Incidentes.`);
      } finally { setGravando(false); }
    }

    const partes = [
      clienteExistente ? `cliente ${clienteNome} completado` : `cliente ${clienteNome} cadastrado`,
      casoExistente ? "caso atualizado" : "caso criado",
      conta.campos && `${conta.campos} campo${conta.campos > 1 ? "s" : ""} da ficha`,
      conta.prazos && `${conta.prazos} prazo${conta.prazos > 1 ? "s" : ""}`,
      conta.audiencias && `${conta.audiencias} audiência${conta.audiencias > 1 ? "s" : ""}`,
      conta.andamentos && `${conta.andamentos} andamento${conta.andamentos > 1 ? "s" : ""}`,
      conta.pendencias && `${conta.pendencias} tarefa${conta.pendencias > 1 ? "s" : ""}`,
      conta.pedidos && `${conta.pedidos} pedido${conta.pedidos > 1 ? "s" : ""} da execução`,
    ].filter(Boolean);
    setFeito({ casoId, resumo: partes.join(", ") + "." });
    setImp(null); setTexto("");
  }

  const marca = (grupo: keyof typeof sel, i: number) => setSel({ ...sel, [grupo]: { ...sel[grupo], [String(i)]: !sel[grupo][String(i)] } });
  const secoes = area.secoes.map((s) => ({ s, campos: s.campos.filter((c) => c.k in ficha) })).filter((x) => x.campos.length);

  return (
    <div className="space-y-4">
      <section className="painel p-4 sm:p-5">
        <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold"><FileSearch className="size-5" />Importar processo do Cowork
          <BotaoInfo>1. Copie as instruções e cole no Cowork junto com o PDF dos autos. 2. Cole aqui a resposta do Cowork. 3. Revise cada campo e confirme. Nada é gravado antes da confirmação. As instruções são geradas a partir das fichas do sistema: copie de novo sempre que uma ficha mudar.</BotaoInfo>
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-g" onClick={copiar}>{copiado ? <Check /> : <ClipboardCopy />}{copiado ? "Instruções copiadas" : "Copiar instruções para o Cowork"}</button>
        </div>
        <Rotulado rotulo="Resposta do Cowork" className="mt-4">
          <textarea className="inp min-h-40 font-mono text-[13px]" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder='Cole aqui o bloco ```json que o Cowork devolveu' />
        </Rotulado>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn btn-p" disabled={!texto.trim()} onClick={() => ler()}>Ler e revisar</button>
          {erro && <p role="alert" className="text-[13px] font-semibold text-perigo">{erro}</p>}
        </div>
        {feito && <p role="status" className="mt-3 text-[13.5px] font-semibold text-ok">Gravado: {feito.resumo} <Link href={`/casos/${feito.casoId}`} className="underline">Abrir o caso</Link></p>}
      </section>

      {imp && (
        <>
          {imp.avisos.length > 0 && (
            <section role="alert" className="rounded-[12px] bg-perigo-f p-3 text-[13px] text-perigo">
              <p className="font-semibold">Confira antes de gravar:</p>
              <ul className="mt-1 list-disc pl-5">{imp.avisos.map((a) => <li key={a} className="break-words">{a}</li>)}</ul>
            </section>
          )}

          <section className="painel">
            <div className="painel-cab"><h2>Cliente</h2></div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <Rotulado rotulo="Gravar como" className="sm:col-span-2">
                <select className="inp" value={clienteAlvo} onChange={(e) => setClienteAlvo(e.target.value)}>
                  <option value="novo">Cliente novo</option>
                  {db.clientes.map((c) => <option key={c.id} value={c.id}>Já cadastrado: {c.nome}{c.documento ? ` (${c.documento})` : ""}</option>)}
                </select>
              </Rotulado>
              {clienteExistente && <p className="text-[12.5px] text-ink-3 sm:col-span-2">No cliente já cadastrado, só os campos vazios são preenchidos. A qualificação entra nas observações.</p>}
              {clienteExistente && cli.nome && semAcento(clienteExistente.nome) !== semAcento(cli.nome) && (
                <p role="alert" className="rounded-[10px] bg-perigo-f px-3 py-2 text-[13px] font-semibold text-perigo sm:col-span-2">O nome nos autos (“{cli.nome}”) é diferente do cliente escolhido (“{clienteExistente.nome}”). Confira o CPF antes de gravar.</p>
              )}
              {([["nome", "Nome"], ["documento", "CPF ou CNPJ"], ["celular", "Celular"], ["email", "E-mail"], ["profissao", "Profissão"], ["cidade", "Cidade"], ["uf", "UF"]] as const).map(([k, r]) => (
                <Rotulado key={k} rotulo={r + (clienteExistente && clienteExistente[k as keyof Cliente] ? ` (atual: ${String(clienteExistente[k as keyof Cliente])})` : "")} className={k === "nome" ? "sm:col-span-2" : ""}>
                  <input className="inp" value={cli[k] ?? ""} onChange={(e) => setCli({ ...cli, [k]: e.target.value })} />
                </Rotulado>
              ))}
              <Rotulado rotulo="Tipo"><select className="inp" value={cli.tipo} onChange={(e) => setCli({ ...cli, tipo: e.target.value })}><option value="pf">Pessoa física</option><option value="pj">Empresa</option></select></Rotulado>
              <Rotulado rotulo="Qualificação (RG, nascimento, estado civil, filiação, endereço)" className="sm:col-span-2">
                <textarea className="inp min-h-24" value={cli.qualificacao ?? ""} onChange={(e) => setCli({ ...cli, qualificacao: e.target.value })} />
              </Rotulado>
            </div>
          </section>

          <section className="painel">
            <div className="painel-cab"><h2>Processo</h2></div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <Rotulado rotulo="Gravar como" className="sm:col-span-2">
                <select className="inp" value={casoAlvo} onChange={(e) => setCasoAlvo(e.target.value)}>
                  <option value="novo">Caso novo</option>
                  {db.casos.map((c) => <option key={c.id} value={c.id}>Já cadastrado: {c.cliente_nome}: {c.titulo}{c.numero ? ` (${c.numero})` : ""}</option>)}
                </select>
              </Rotulado>
              {casoExistente && <p className="text-[12.5px] text-ink-3 sm:col-span-2">No caso já cadastrado, só os campos vazios são preenchidos; a fase passa a ser a escolhida abaixo e a ficha recebe os campos marcados.</p>}
              <Rotulado rotulo="Área" className="sm:col-span-2">
                <select className="inp" value={proc.area} onChange={(e) => ler(e.target.value)}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
              </Rotulado>
              {([["titulo", "Título do caso"], ["numero", "Número (CNJ)"], ["orgao", "Vara ou órgão"], ["comarca", "Comarca"], ["uf", "UF"], ["parte_contraria", "Parte contrária"], ["valor", "Valor da causa (R$)"], ["distribuido_em", "Distribuído em"]] as const).map(([k, r]) => (
                <Rotulado key={k} rotulo={r} className={k === "titulo" ? "sm:col-span-2" : ""}>
                  <input className="inp" type={k === "distribuido_em" ? "date" : k === "valor" ? "number" : "text"} value={proc[k] ?? ""} onChange={(e) => setProc({ ...proc, [k]: e.target.value })} />
                </Rotulado>
              ))}
              <Rotulado rotulo="Fase"><select className="inp" value={proc.fase} onChange={(e) => setProc({ ...proc, fase: e.target.value })}>{area.fases.map((f, i) => <option key={f} value={i}>{f}</option>)}</select></Rotulado>
            </div>
          </section>

          <section className="painel">
            <div className="painel-cab"><h2>Ficha de {area.nome} ({conta.campos} de {Object.keys(ficha).length})</h2></div>
            {secoes.length === 0 && !ficha.tipo_caso ? <p className="p-4 text-[13.5px] text-ink-3">O Cowork não trouxe campos da ficha desta área.</p> : (
              <div className="space-y-4 p-4">
                {ficha.tipo_caso !== undefined && (
                  <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-4" checked={!!usarCampo.tipo_caso} onChange={() => setUsarCampo({ ...usarCampo, tipo_caso: !usarCampo.tipo_caso })} /><span><span className="rotulo">Tipos de processo</span>{String(ficha.tipo_caso).split("\n").join("; ")}</span></label>
                )}
                {secoes.map(({ s, campos }) => (
                  <div key={s.titulo}>
                    <h3 className="mb-2 font-semibold">{s.titulo}</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {campos.map((c) => {
                        const atual = casoExistente?.dados[c.k];
                        return (
                          <div key={c.k} className={`flex items-start gap-2 ${c.tipo === "l" || c.tipo === "m" ? "sm:col-span-2" : ""}`}>
                            <input type="checkbox" className="mt-7 size-4 shrink-0" aria-label={`Gravar ${c.rotulo}`} checked={!!usarCampo[c.k]} onChange={() => setUsarCampo({ ...usarCampo, [c.k]: !usarCampo[c.k] })} />
                            <div className="grid min-w-0 flex-1 grid-cols-1">
                              <CampoArea campo={c} valor={ficha[c.k]} aoMudar={(v) => setFicha({ ...ficha, [c.k]: v })} />
                              {atual !== undefined && atual !== "" && String(atual) !== String(ficha[c.k]) && <p className="mt-1 text-[12px] text-ocre">Atual no caso: {String(atual).split("\n").join("; ")}. {usarCampo[c.k] ? "Vai ser substituído; desmarque para manter." : "Marque para substituir."}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <ListaMarcavel titulo="Prazos" itens={imp.prazos.map((z) => `${data(z.data)}: ${z.titulo}${z.fatal ? " (fatal)" : ""}${z.fonte ? ` · ${z.fonte}` : ""}`)} marcas={sel.prazos} aoMarcar={(i) => marca("prazos", i)} vazio="Nenhum prazo em curso nos autos." />
          <ListaMarcavel titulo="Audiências" itens={imp.audiencias.map((a) => `${data(a.data_hora)} às ${a.data_hora.slice(11, 16)}: ${a.titulo} (${a.modalidade})${a.local ? ` · ${a.local}` : ""}`)} marcas={sel.audiencias} aoMarcar={(i) => marca("audiencias", i)} vazio="Nenhuma audiência nos autos." />
          <ListaMarcavel titulo="Andamentos" itens={imp.andamentos.map((a) => `${data(a.data)}: ${a.descricao}${a.fonte ? ` · ${a.fonte}` : ""}`)} marcas={sel.andamentos} aoMarcar={(i) => marca("andamentos", i)} vazio="Nenhum andamento." />
          <ListaMarcavel titulo="Processos vinculados" itens={imp.vinculados.map((v) => `${v.tipo}: ${v.numero}${v.situacao ? ` (${v.situacao})` : ""}`)} marcas={sel.vinculados} aoMarcar={(i) => marca("vinculados", i)} vazio="Nenhum processo vinculado." />
          {area.id === "execucao_penal" && <ListaMarcavel titulo="Pedidos da execução (vão para a aba Incidentes)" itens={imp.pedidos.map((x) => `${x.data_pedido ? `${data(x.data_pedido)} · ` : ""}${ROTULO_PEDIDO[x.tipo]}: ${x.titulo}. ${ROTULO_STATUS[x.status]}${x.data_decisao ? ` em ${data(x.data_decisao)}` : ""}${x.resultado ? `: ${x.resultado}` : ""}${x.recurso ? ` · ${x.recurso.interposto}: ${x.recurso.resultado || "pendente"}` : ""}`)} marcas={sel.pedidos} aoMarcar={(i) => marca("pedidos", i)} vazio="Nenhum pedido da execução nos autos." />}
          <ListaMarcavel titulo="Pendências (viram tarefas do caso)" itens={imp.pendencias} marcas={sel.pendencias} aoMarcar={(i) => marca("pendencias", i)} vazio="Nenhuma pendência apontada." />
          {imp.partes.length > 0 && (
            <section className="painel">
              <div className="painel-cab"><h2>Partes citadas nos autos</h2></div>
              <ul className="divide-y divide-line-2 text-[13.5px]">{imp.partes.map((p, i) => <li key={i} className="px-4 py-2"><span className="font-semibold">{p.nome}</span>{p.papel ? ` · ${p.papel}` : ""}{p.polo ? ` · polo ${p.polo}` : ""}</li>)}</ul>
            </section>
          )}

          <section className="painel flex flex-wrap items-center justify-end gap-2 p-4">
            {erro && <p role="alert" className="mr-auto text-[13px] font-semibold text-perigo">{erro}</p>}
            <button className="btn btn-g" onClick={() => setImp(null)}>Descartar</button>
            <button className="btn btn-p" disabled={gravando} onClick={confirmar}><Check />{gravando ? "Gravando…" : "Confirmar e gravar"}</button>
          </section>
        </>
      )}
    </div>
  );
}

function ListaMarcavel({ titulo, itens, marcas, aoMarcar, vazio }: { titulo: string; itens: string[]; marcas: Record<string, boolean>; aoMarcar: (i: number) => void; vazio: string }) {
  const n = Object.values(marcas).filter(Boolean).length;
  return (
    <section className="painel">
      <div className="painel-cab"><h2>{titulo}{itens.length ? ` (${n} de ${itens.length})` : ""}</h2></div>
      {itens.length === 0 ? <p className="px-4 py-3 text-[13.5px] text-ink-3">{vazio}</p> : (
        <ul className="divide-y divide-line-2">{itens.map((t, i) => (
          <li key={i}><label className="flex items-start gap-3 px-4 py-2.5 text-[13.5px]"><input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={!!marcas[String(i)]} onChange={() => aoMarcar(i)} /><span className="min-w-0 break-words">{t}</span></label></li>
        ))}</ul>
      )}
    </section>
  );
}
