"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileDown, FileText, Loader2, Printer, RefreshCw, Settings2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { loadPerfilAdvogado, getPerfilAdvogado, type PerfilAdvogado } from "@/lib/perfil";
import { MODELOS, getModelo, type ModeloId } from "@/lib/modelos-documentos";
import { listarModelos, preencherModelo, inspecionarModelo, type ModeloCustom } from "@/lib/modelos-custom";
import { montarDadosDocumento } from "@/lib/tokens-documento";
import { getProcessosByCliente } from "@/lib/store";
import type { Cliente, Processo } from "@/types";

const LABELS_TOKEN: Record<string, string> = {
  processo: "Número do processo",
  acao: "Nome da ação",
  valor: "Valor",
  objeto: "Objeto",
  declarante_nome: "Declarante — nome completo",
  declarante_nacionalidade: "Declarante — nacionalidade",
  declarante_estado_civil: "Declarante — estado civil",
  declarante_profissao: "Declarante — profissão",
  declarante_rg: "Declarante — RG",
  declarante_cpf: "Declarante — CPF",
  declarante_endereco: "Declarante — endereço completo",
  vinculo_parentesco: "Vínculo/parentesco com o apenado",
  municipio_assinatura: "Município da assinatura",
  empregador_nome: "Empregador — nome / razão social",
  empregador_qualificacao: "Empregador — qualificação",
  empregador_doc: "Empregador — CPF/CNPJ",
  empregador_endereco: "Empregador — endereço",
  empregador_telefone: "Empregador — telefone",
  empregador_representante: "Empregador — representante",
  representante_cargo: "Representante — cargo",
  representante_rg: "Representante — RG",
  representante_cpf: "Representante — CPF",
  funcao: "Função oferecida",
  local_trabalho: "Local de trabalho",
  jornada: "Jornada de trabalho",
  remuneracao: "Remuneração (R$)",
  remuneracao_extenso: "Remuneração por extenso",
};

function labelToken(t: string): string {
  return LABELS_TOKEN[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

/** Número do caso: para inquérito usa numero_inquerito; senão, o número do processo. */
function numeroProcesso(p: Processo): string {
  if (p.tipo === "inquerito_policial") return (p.numero_inquerito ?? "").trim();
  return (p.numero ?? "").trim();
}

interface GerarDocumentoPanelProps {
  cliente: Cliente;
}

/** Estilo do documento — usado no editor e no PDF dos modelos prontos. */
const DOC_CSS = `
  .doc-page { font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1.5; color: #111; text-align: justify; }
  .doc-page .doc-title { text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 0 0 24px; letter-spacing: 0.5px; }
  .doc-page p { margin: 0 0 14px; }
  .doc-page .doc-local { text-align: right; margin: 28px 0 36px; }
  .doc-page .doc-sign { text-align: center; margin-top: 72px; }
`;

const FILL_CSS = `.doc-page .doc-fill { background: #fef3c7; color: #92400e; border-radius: 3px; padding: 0 2px; }`;

function nomeArquivo(modeloNome: string, clienteNome: string): string {
  return `${modeloNome} - ${clienteNome}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim();
}

export function GerarDocumentoPanel({ cliente }: GerarDocumentoPanelProps) {
  const [perfil, setPerfil] = useState<PerfilAdvogado>(() => getPerfilAdvogado());
  const [modeloId, setModeloId] = useState<ModeloId>("procuracao");
  const editorRef = useRef<HTMLDivElement>(null);
  const [meusModelos, setMeusModelos] = useState<ModeloCustom[]>([]);
  const [gerandoId, setGerandoId] = useState("");
  const [erroModelo, setErroModelo] = useState("");
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [timbreUrl, setTimbreUrl] = useState("");
  const [nomeDocAtual, setNomeDocAtual] = useState("Procuração");
  const [modalGerar, setModalGerar] = useState<{ modelo: ModeloCustom; tokens: string[] } | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPerfilAdvogado().then(setPerfil).catch(() => { /* perfil local já carregado */ });
    listarModelos().then(setMeusModelos).catch(() => { /* sem modelos ou tabela ausente */ });
    carregarProcessos();
    fetch("/timbre.png")
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      }))
      .then(setTimbreUrl)
      .catch(() => { /* sem timbre disponível */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarProcessos() {
    try {
      const [porId, porNome] = await Promise.all([
        getProcessosByCliente(cliente.id),
        getProcessosByCliente(cliente.nome),
      ]);
      const todos = [...porId, ...porNome].filter(
        (p, i, self) => self.findIndex((x) => x.id === p.id) === i
      );
      setProcessos(todos);
    } catch { /* sem processos */ }
  }

  // Clicar num modelo SEU: pergunta os campos que faltam e gera o .docx (mantém a formatação do Word).
  async function iniciarGeracao(modelo: ModeloCustom) {
    setErroModelo("");
    setGerandoId(modelo.id);
    try {
      const tokens = await inspecionarModelo(modelo.caminho);
      if (tokens.length === 0) {
        await baixarPreenchido(modelo, {});
      } else {
        setValores({});
        setModalGerar({ modelo, tokens });
        if (tokens.includes("processo")) carregarProcessos();
      }
    } catch (err) {
      setErroModelo(err instanceof Error ? err.message : "Não foi possível ler o modelo.");
    } finally {
      setGerandoId("");
    }
  }

  async function baixarPreenchido(modelo: ModeloCustom, extras: Record<string, string>) {
    setGerandoId(modelo.id);
    setErroModelo("");
    try {
      const dados = { ...montarDadosDocumento(cliente, perfil), ...extras };
      const blob = await preencherModelo(modelo.caminho, dados);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeArquivo(modelo.nome, cliente.nome)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setModalGerar(null);
    } catch (err) {
      setErroModelo(err instanceof Error ? err.message : "Não foi possível gerar o documento.");
    } finally {
      setGerandoId("");
    }
  }

  function render(id: ModeloId, p: PerfilAdvogado) {
    const modelo = getModelo(id);
    if (!modelo || !editorRef.current) return;
    const { titulo, corpoHtml } = modelo.gerar({ cliente, perfil: p, processos });
    editorRef.current.innerHTML = `<h1 class="doc-title" contenteditable="false">${titulo}</h1>${corpoHtml}`;
    setNomeDocAtual(modelo.nome);
  }

  // Regera o modelo pronto quando muda o modelo, o perfil ou os processos.
  useEffect(() => {
    render(modeloId, perfil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId, perfil, processos, cliente.id]);

  function htmlAtual(): string {
    return editorRef.current?.innerHTML ?? "";
  }

  const PAGINA_CSS = `
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .folha { position: relative; width: 21cm; min-height: 29.7cm; box-sizing: border-box; }
    .folha .timbre { position: absolute; top: 0; left: 0; width: 21cm; height: 29.7cm; z-index: 0; }
    .folha .conteudo { position: relative; z-index: 1; padding: 5.5cm 2.5cm 4cm 2.5cm; }
  `;

  function documentoCompleto(): string {
    const timbre = timbreUrl ? `<img class="timbre" src="${timbreUrl}" alt="" />` : "";
    return `<!doctype html><html><head><meta charset="utf-8"><title>Documento</title><style>${DOC_CSS}${PAGINA_CSS}</style></head>` +
      `<body><div class="folha">${timbre}<div class="conteudo doc-page">${htmlAtual()}</div></div></body></html>`;
  }

  function baixarPdf() {
    // Imprime via iframe invisível (sem pop-up, imune a bloqueador).
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      setErroModelo("Não foi possível preparar a impressão. Use o botão Word e imprima de lá.");
      return;
    }
    doc.open();
    doc.write(documentoCompleto());
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    }, 300);
  }

  function baixarWord() {
    const header =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"><style>${DOC_CSS} @page { margin: 2.5cm 2.5cm 2.5cm 3cm; }</style></head>` +
      `<body><div class="doc-page">`;
    const footer = `</div></body></html>`;
    const blob = new Blob(["﻿", header + htmlAtual() + footer], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivo(nomeDocAtual || "documento", cliente.nome)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const perfilIncompleto = !perfil.nome?.trim() || !perfil.oab_numero?.trim();

  return (
    <div className="space-y-4">
      <style>{DOC_CSS + FILL_CSS}</style>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Seus modelos</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Ele pergunta os dados que faltam e gera o <strong>.docx</strong> com a sua formatação do Word (versalete etc.).
            </p>
          </div>
          <Link href="/dashboard/modelos" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Settings2 className="h-4 w-4" /> Gerenciar modelos
          </Link>
        </div>
        {erroModelo && !modalGerar && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroModelo}</p>}
        {meusModelos.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <FileText className="mb-2 h-9 w-9 text-gray-200" />
            <p className="text-sm font-medium text-gray-600">Nenhum modelo seu ainda</p>
            <p className="mt-1 text-xs text-gray-400">
              Suba seus modelos Word em <Link href="/dashboard/modelos" className="underline">Modelos</Link> para gerá-los aqui já preenchidos.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {meusModelos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="min-w-40 flex-1 truncate text-sm font-semibold text-gray-900">{m.nome}</p>
                <Button size="sm" onClick={() => iniciarGeracao(m)} disabled={gerandoId === m.id}>
                  {gerandoId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {gerandoId === m.id ? "Gerando..." : "Gerar .docx"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Modelos prontos</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Preenchido com os dados de {cliente.nome}. Edite na tela e exporte (PDF com timbre).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" title="Restaurar o modelo original" onClick={() => render(modeloId, perfil)}>
              <RefreshCw className="h-4 w-4" /> Restaurar
            </Button>
            <Button variant="secondary" size="sm" onClick={baixarWord}>
              <FileDown className="h-4 w-4" /> Word
            </Button>
            <Button size="sm" onClick={baixarPdf}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeloId(m.id)}
              title={m.descricao}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                modeloId === m.id
                  ? "bg-[#21181d] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {m.nome}
            </button>
          ))}
        </div>

        {perfilIncompleto && (
          <p className="m-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            Seu perfil de advogada está incompleto. Preencha nome, OAB e qualificação em
            <strong className="font-semibold">&nbsp;Configurações → Perfil do Advogado</strong>
            &nbsp;para a procuração sair completa.
          </p>
        )}

        <div className="px-5 py-5">
          <p className="mb-2 text-xs text-gray-400">
            Os trechos em <span className="rounded bg-amber-100 px-1 text-amber-800">amarelo</span> são para você completar.
          </p>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            style={timbreUrl ? {
              backgroundImage: `url(${timbreUrl})`,
              backgroundSize: "100% auto",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top center",
              paddingTop: "150px",
              paddingBottom: "140px",
            } : undefined}
            className="doc-page min-h-[400px] rounded-lg border border-gray-200 bg-white px-12 py-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          {timbreUrl && (
            <p className="mt-2 text-xs text-gray-400">
              O timbre aparece aqui só como prévia aproximada — no <strong>PDF</strong> ele sai certinho, em página A4.
            </p>
          )}
        </div>
      </div>

      <p className="px-1 text-xs text-gray-400">
        <Loader2 className="mr-1 inline h-3 w-3 align-[-2px]" />
        Dica: o botão <strong>PDF</strong> abre a janela de impressão — escolha “Salvar como PDF”. O <strong>Word</strong> baixa um arquivo que abre no Word/Google Docs para ajustes finais.
      </p>

      {modalGerar && (
        <Modal open onClose={() => setModalGerar(null)} title={`Gerar: ${modalGerar.modelo.nome}`} size="md">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Complete os campos que não vêm do cadastro de {cliente.nome}:
            </p>
            {modalGerar.tokens.map((t) =>
              t === "processo" ? (
                <div key={t} className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Número do processo</label>
                  {processos.length > 0 && (
                    <div className="space-y-1.5">
                      {processos.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setValores((v) => ({ ...v, processo: numeroProcesso(p) }))}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            numeroProcesso(p) && valores.processo === numeroProcesso(p)
                              ? "border-[#21181d] bg-gray-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <span className="shrink-0 font-mono text-xs text-gray-500">{numeroProcesso(p) || "sem número"}</span>
                          <span className="truncate text-gray-800">{p.titulo}</span>
                          {p.tipo === "inquerito_policial" && <span className="shrink-0 rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">inquérito</span>}
                        </button>
                      ))}
                      <p className="text-xs text-gray-400">ou digite manualmente:</p>
                    </div>
                  )}
                  <Input
                    placeholder="0000000-00.0000.0.00.0000"
                    value={valores[t] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [t]: e.target.value }))}
                  />
                </div>
              ) : (
                <Input
                  key={t}
                  label={labelToken(t)}
                  value={valores[t] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [t]: e.target.value }))}
                />
              )
            )}
            {erroModelo && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroModelo}</p>}
            <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-gray-100 bg-white px-4 pt-4 pb-[calc(0.25rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
              <Button variant="secondary" onClick={() => setModalGerar(null)}>Cancelar</Button>
              <Button onClick={() => baixarPreenchido(modalGerar.modelo, valores)} disabled={gerandoId === modalGerar.modelo.id}>
                {gerandoId === modalGerar.modelo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Gerar .docx
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
