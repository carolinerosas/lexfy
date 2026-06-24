"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  anexarDocumento,
  excluirDocumento,
  listarDocumentos,
  urlDocumento,
  type DocumentoArquivo,
  type DocumentoContexto,
} from "@/lib/documentos";
import { formatDateTime } from "@/lib/utils";

interface DocumentosPanelProps {
  contexto: DocumentoContexto;
  registroId: string;
  titulo?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function DocumentosPanel({ contexto, registroId, titulo = "Documentos" }: DocumentosPanelProps) {
  const [documentos, setDocumentos] = useState<DocumentoArquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyPath, setBusyPath] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [referencia, setReferencia] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDocumentos(await listarDocumentos(contexto, registroId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listarDocumentos(contexto, registroId)
      .then((items) => {
        if (!cancelled) setDocumentos(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar os documentos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contexto, registroId]);

  function abrirCadastro() {
    setArquivo(null);
    setNome("");
    setReferencia("");
    setError("");
    setModalOpen(true);
  }

  function selecionarArquivo(file?: File) {
    if (!file) return;
    setArquivo(file);
    if (!nome.trim()) setNome(file.name.replace(/\.pdf$/i, ""));
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!arquivo) return;
    setUploading(true);
    setError("");
    try {
      await anexarDocumento({ contexto, registroId, arquivo, nome, referencia });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível anexar o PDF.");
    } finally {
      setUploading(false);
    }
  }

  async function abrir(documento: DocumentoArquivo, download = false) {
    setBusyPath(documento.caminho);
    setError("");
    try {
      const url = await urlDocumento(documento.caminho, download);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o documento.");
    } finally {
      setBusyPath("");
    }
  }

  async function excluir(documento: DocumentoArquivo) {
    if (!window.confirm(`Excluir o documento "${documento.nome}"?`)) return;
    setBusyPath(documento.caminho);
    setError("");
    try {
      await excluirDocumento(documento);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o documento.");
    } finally {
      setBusyPath("");
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">{titulo}</h2>
            <p className="mt-0.5 text-xs text-gray-400">PDFs de até 20 MB · acesso por link temporário</p>
          </div>
          <Button size="sm" onClick={abrirCadastro}>
            <Upload className="h-4 w-4" /> Anexar PDF
          </Button>
        </div>

        {error && !modalOpen && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos...
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm font-medium text-gray-600">Nenhum documento anexado</p>
            <p className="mt-1 text-xs text-gray-400">Use “Anexar PDF” para incluir o primeiro arquivo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documentos.map((documento) => {
              const busy = busyPath === documento.caminho;
              return (
                <li key={documento.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-48 flex-1">
                    <button
                      type="button"
                      onClick={() => abrir(documento)}
                      disabled={busy}
                      title="Abrir PDF"
                      className="block max-w-full truncate text-left text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {documento.nome}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-gray-500">Referência: {documento.referencia}</p>
                  </div>
                  <div className="min-w-40 text-xs text-gray-400">
                    <p className="truncate">{documento.nomeOriginal}</p>
                    <p className="mt-0.5">
                      {formatBytes(documento.tamanho)}
                      {documento.criadoEm ? ` · ${formatDateTime(documento.criadoEm)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" title="Abrir PDF" onClick={() => abrir(documento)} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" title="Baixar PDF" onClick={() => abrir(documento, true)} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">
                      <Download className="h-4 w-4" />
                    </button>
                    <button type="button" title="Excluir PDF" onClick={() => excluir(documento)} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Anexar documento" size="md">
        <form onSubmit={salvar} className="space-y-4">
          <Input label="Nome do documento *" placeholder="Ex.: Procuração assinada" value={nome} onChange={(event) => setNome(event.target.value)} required />
          <Input label="Referência *" placeholder="Ex.: Cliente, contrato 2026 ou fls. 120" value={referencia} onChange={(event) => setReferencia(event.target.value)} required />
          <div className="space-y-1.5">
            <label htmlFor={`pdf-${contexto}-${registroId}`} className="text-sm font-medium text-gray-700">Arquivo PDF *</label>
            <input id={`pdf-${contexto}-${registroId}`} type="file" accept="application/pdf,.pdf" onChange={(event) => selecionarArquivo(event.target.files?.[0])} required className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700" />
            <p className="text-xs text-gray-400">Somente PDF, com até 20 MB.</p>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={uploading || !arquivo}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando..." : "Salvar documento"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
