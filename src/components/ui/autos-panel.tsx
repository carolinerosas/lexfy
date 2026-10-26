"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buscarAutos, excluirAutos, importarAutos, listarAutos, urlAutos, type AutosArquivo, type TrechoAutos } from "@/lib/autos";

// Aba "Autos" do processo: PDFs do processo com texto pesquisável (usado também
// pela audiência ao vivo).

export function AutosPanel({ processoId }: { processoId: string }) {
  const [arquivos, setArquivos] = useState<AutosArquivo[]>([]);
  const [progresso, setProgresso] = useState<{ nome: string; feitas: number; total: number; etapa?: "texto" | "ocr" } | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<TrechoAutos[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      setArquivos(await listarAutos(processoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [processoId]);

  useEffect(() => {
    listarAutos(processoId).then(setArquivos).catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, [processoId]);

  async function enviar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro("");
    setSucesso("");
    for (const f of Array.from(lista)) {
      try {
        setProgresso({ nome: f.name, feitas: 0, total: 0 });
        const novo = await importarAutos(processoId, f, (feitas, total, etapa) => setProgresso({ nome: f.name, feitas, total, etapa }));
        setSucesso(
          `✓ ${f.name}: ${novo.paginas} páginas lidas` +
            (novo.paginas_sem_texto ? `, ${novo.paginas_sem_texto} sem texto (escaneadas)` : "") +
            ". Já dá para pesquisar nos autos."
        );
      } catch (e) {
        setErro(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setProgresso(null);
    carregar();
  }

  async function pesquisar(e: React.FormEvent) {
    e.preventDefault();
    if (!termo.trim()) return;
    try {
      setResultados(await buscarAutos(processoId, termo, 10));
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  }

  const totalPaginas = arquivos.reduce((s, a) => s + a.paginas, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <BookOpen className="w-4 h-4" /> Autos do processo
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {arquivos.length
                  ? `${arquivos.length} arquivo(s), ${totalPaginas} páginas. A audiência ao vivo pesquisa aqui.`
                  : "Envie o PDF do processo ou os volumes. O Justio guarda só o texto (o PDF fica no seu computador): dá para pesquisar aqui e a audiência ao vivo consulta os autos."}
              </p>
            </div>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#21181d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2b2027] ${progresso ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="w-4 h-4" /> Enviar PDF
              <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
            </label>
          </div>

          {progresso && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-gray-600">
                {progresso.etapa === "ocr"
                  ? `Lendo as páginas escaneadas de ${progresso.nome}… ${progresso.feitas} de ${progresso.total}`
                  : `Lendo ${progresso.nome}… ${progresso.total ? `página ${progresso.feitas} de ${progresso.total}` : ""}`}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-[#21181d] transition-all" style={{ width: `${progresso.total ? (progresso.feitas / progresso.total) * 100 : 3}%` }} />
              </div>
            </div>
          )}
          {sucesso && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{sucesso}</p>}
          {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          {arquivos.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {arquivos.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-gray-900">{a.nome}</p>
                    <p className="text-xs text-gray-500">
                      {a.paginas} páginas
                      {a.paginas_sem_texto > 0 && ` · ${a.paginas_sem_texto} página(s) sem texto legível`}
                    </p>
                  </div>
                  {a.caminho && (
                    <Button size="sm" variant="ghost" onClick={async () => window.open(await urlAutos(a.caminho!), "_blank")} title="Abrir PDF">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(`Remover "${a.nome}" dos autos do Justio?`)) return;
                      await excluirAutos(a);
                      carregar();
                    }}
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {arquivos.length > 0 && (
        <Card>
          <CardContent className="py-4 px-5">
            <form onSubmit={pesquisar} className="flex gap-2">
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Pesquisar nos autos (ex.: reconhecimento fotográfico, nome da testemunha)"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <Button type="submit" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
            {resultados && (
              <div className="mt-4 space-y-3">
                {resultados.length === 0 && <p className="text-sm text-gray-500">Nada encontrado.</p>}
                {resultados.map((r, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="mb-1 text-xs font-medium text-gray-500">
                      {r.arquivo} · página {r.pagina}
                    </p>
                    <p className="line-clamp-6 whitespace-pre-line text-sm text-gray-800">{r.trecho}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
