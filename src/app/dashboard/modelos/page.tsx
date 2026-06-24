"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload, FilePlus2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anexarModelo, excluirModelo, listarModelos, type ModeloCustom } from "@/lib/modelos-custom";
import { formatDateTime } from "@/lib/utils";

const TOKENS: { grupo: string; itens: { token: string; vira: string }[] }[] = [
  {
    grupo: "Dados do cliente",
    itens: [
      { token: "{{nome}}", vira: "Nome do cliente" },
      { token: "{{cpf}}", vira: "CPF" },
      { token: "{{rg}}", vira: "RG" },
      { token: "{{nacionalidade}}", vira: "Nacionalidade" },
      { token: "{{estado_civil}}", vira: "Estado civil" },
      { token: "{{profissao}}", vira: "Profissão" },
      { token: "{{endereco}}", vira: "Endereço completo" },
      { token: "{{cidade}} {{uf}} {{cep}}", vira: "Partes do endereço" },
      { token: "{{logradouro}} {{numero}} {{bairro}}", vira: "Partes do endereço" },
      { token: "{{email}} {{celular}}", vira: "Contato" },
    ],
  },
  {
    grupo: "Seus dados (advogada)",
    itens: [
      { token: "{{adv_nome}}", vira: "Seu nome" },
      { token: "{{adv_oab}} {{adv_oab_uf}}", vira: "OAB e seccional" },
      { token: "{{adv_cpf}}", vira: "Seu CPF" },
      { token: "{{adv_nacionalidade}} {{adv_estado_civil}}", vira: "Sua qualificação" },
      { token: "{{adv_endereco}}", vira: "Endereço do escritório" },
    ],
  },
  {
    grupo: "Gênero (flexiona pelo sexo do cliente)",
    itens: [
      { token: "{{portador}}", vira: "portador / portadora" },
      { token: "{{inscrito}}", vira: "inscrito / inscrita" },
      { token: "{{domiciliado}}", vira: "domiciliado / domiciliada" },
      { token: "{{nascido}}", vira: "nascido / nascida" },
      { token: "{{o_a}}", vira: "o / a" },
    ],
  },
  {
    grupo: "Data",
    itens: [
      { token: "{{cidade_data}}", vira: "Cidade, 24 de junho de 2026" },
      { token: "{{data}}", vira: "24 de junho de 2026" },
      { token: "{{data_curta}}", vira: "24/06/2026" },
    ],
  },
];

export default function ModelosPage() {
  const [modelos, setModelos] = useState<ModeloCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nome, setNome] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setModelos(await listarModelos());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os modelos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selecionar(file?: File) {
    if (!file) return;
    setArquivo(file);
    if (!nome.trim()) setNome(file.name.replace(/\.docx$/i, ""));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setUploading(true);
    setError("");
    try {
      await anexarModelo({ arquivo, nome });
      setNome("");
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível subir o modelo.");
    } finally {
      setUploading(false);
    }
  }

  async function remover(modelo: ModeloCustom) {
    if (!window.confirm(`Excluir o modelo "${modelo.nome}"?`)) return;
    setBusyId(modelo.id);
    try {
      await excluirModelo(modelo);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o modelo.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-5 h-5 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Modelos de documentos</h1>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Suba seus modelos em Word com marcadores. Na página de cada cliente, o Justio preenche e baixa o documento pronto.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FilePlus2 className="w-4 h-4 text-gray-500" />
            <CardTitle>Subir um modelo (.docx)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvar} className="space-y-4">
            <Input
              label="Nome do modelo *"
              placeholder="Ex.: Procuração ad judicia"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <div className="space-y-1.5">
              <label htmlFor="modelo-file" className="text-sm font-medium text-gray-700">Arquivo Word *</label>
              <input
                id="modelo-file"
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => selecionar(e.target.files?.[0])}
                required
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700"
              />
              <p className="text-xs text-gray-400">Somente .docx (Word), com até 10 MB. Use os marcadores da lista abaixo.</p>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={uploading || !arquivo}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Enviando..." : "Subir modelo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Seus modelos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : modelos.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <FileText className="mb-3 h-10 w-10 text-gray-200" />
              <p className="text-sm font-medium text-gray-600">Nenhum modelo ainda</p>
              <p className="mt-1 text-xs text-gray-400">Suba seu primeiro modelo Word acima.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {modelos.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-48 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{m.nome}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {m.arquivoNome}
                      {m.criadoEm ? ` · ${formatDateTime(m.criadoEm)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Excluir modelo"
                    onClick={() => remover(m)}
                    disabled={busyId === m.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Marcadores disponíveis</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            No seu Word, escreva os marcadores abaixo (com chaves duplas, exatamente assim) onde quer que o dado entre.
          </p>
          <div className="rounded-lg bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
            <p className="font-semibold">E os campos que mudam por caso?</p>
            <p className="mt-1 text-blue-800">
              Qualquer marcador <strong>fora desta lista</strong> — como <code className="rounded bg-white/70 px-1 text-xs">{`{{processo}}`}</code> ou{" "}
              <code className="rounded bg-white/70 px-1 text-xs">{`{{acao}}`}</code> — o Justio <strong>pergunta na hora de gerar</strong>.
              No caso do <code className="rounded bg-white/70 px-1 text-xs">{`{{processo}}`}</code>, ele ainda mostra os processos já cadastrados do cliente pra você só clicar.
            </p>
          </div>
          {TOKENS.map((g) => (
            <div key={g.grupo}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{g.grupo}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.itens.map((it) => (
                  <div key={it.token} className="flex items-baseline gap-2 text-sm">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">{it.token}</code>
                    <span className="text-gray-500">{it.vira}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
