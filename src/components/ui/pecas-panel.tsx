"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Loader2, Save, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAnotacao, getAnotacoesByProcesso } from "@/lib/store";
import { areaDoProcesso, type Area } from "@/lib/audiencia/perfis";
import { TIPOS_PECA, tipoPeca } from "@/lib/pecas/tipos";
import type { Anotacao } from "@/types";

// Aba "Peças" do processo: gera petições (alegações finais etc.) a partir das anotações
// escolhidas (inclusive a transcrição da audiência), dos autos e do perfil da advogada;
// o texto fica editável na tela e dá para pedir ajustes.

const AREAS: { value: Area; label: string }[] = [
  { value: "criminal", label: "Advogada Criminalista" },
  { value: "familia", label: "Advogada de Família" },
  { value: "geral", label: "Advogada (geral)" },
];

const guardar = (chave: string, valor: string) => {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento local: segue sem rascunho
  }
};
const ler = (chave: string) => {
  try {
    return localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
};

export function PecasPanel({ processoId, tipoProcesso }: { processoId: string; tipoProcesso?: string }) {
  const chaveRascunho = `justio_peca_${processoId}`;
  const chaveProjeto = "justio_peca_projeto";

  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState(TIPOS_PECA[0].id);
  const [area, setArea] = useState<Area>(areaDoProcesso(tipoProcesso));
  const [projeto, setProjeto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [usarAutos, setUsarAutos] = useState(true);
  const [texto, setTexto] = useState("");
  const [ajuste, setAjuste] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [gravacao, setGravacao] = useState<"" | "salvando" | "salvo">("");
  const [copiado, setCopiado] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTexto(ler(chaveRascunho));
    setProjeto(ler(chaveProjeto));
  }, [chaveRascunho]);

  useEffect(() => {
    getAnotacoesByProcesso(processoId)
      .then((lista) => {
        setAnotacoes(lista);
        setMarcadas(new Set(lista.filter((a) => /^transcri/i.test(a.titulo ?? "")).slice(0, 1).map((a) => a.id)));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, [processoId]);

  const gerar = useCallback(
    async (comRascunho: boolean) => {
      setErro("");
      setGravacao("");
      setGerando(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const base = comRascunho ? texto : "";
      if (!comRascunho) setTexto("");
      try {
        const res = await fetch("/api/pecas/gerar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            processo_id: processoId,
            tipo,
            area,
            projeto,
            instrucoes,
            anotacao_ids: [...marcadas],
            usar_autos: usarAutos,
            ...(comRascunho ? { rascunho: base, ajuste } : {}),
          }),
        });
        if (!res.ok || !res.body) {
          const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
          throw new Error(msg ?? `Falha ao gerar (${res.status}).`);
        }
        const leitor = res.body.getReader();
        const decoder = new TextDecoder();
        let acumulado = "";
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          acumulado += decoder.decode(value, { stream: true });
          setTexto(acumulado);
        }
        guardar(chaveRascunho, acumulado);
        if (comRascunho) setAjuste("");
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setGerando(false);
        abortRef.current = null;
      }
    },
    [processoId, tipo, area, projeto, instrucoes, marcadas, usarAutos, texto, ajuste, chaveRascunho]
  );

  async function salvarNoProcesso() {
    if (!texto.trim() || gravacao === "salvando") return;
    setGravacao("salvando");
    setErro("");
    try {
      await createAnotacao({
        processo_id: processoId,
        titulo: `${tipoPeca(tipo).label} — rascunho (${new Date().toLocaleDateString("pt-BR")})`,
        conteudo: texto,
      });
      setGravacao("salvo");
    } catch (e) {
      setGravacao("");
      setErro(`Não consegui salvar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tipoPeca(tipo).label.replace(/[\\/:*?"<>|]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function alternar(id: string) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const campo = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wand2 className="h-4 w-4" /> Gerar peça
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Usa as anotações que você marcar (inclusive a transcrição da audiência), o texto dos autos enviados na aba Autos e o perfil escolhido. O resultado fica editável aqui.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Peça
              <select className={`${campo} mt-1`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS_PECA.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Perfil da advogada
              <select className={`${campo} mt-1`} value={area} onChange={(e) => setArea(e.target.value as Area)}>
                {AREAS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Anotações e transcrições a usar</p>
            {anotacoes.length === 0 ? (
              <p className="text-xs text-gray-500">Este processo ainda não tem anotações.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
                {anotacoes.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                    <input type="checkbox" className="mt-1" checked={marcadas.has(a.id)} onChange={() => alternar(a.id)} />
                    <span className="min-w-0 break-words">
                      {a.titulo || "Anotação"}{" "}
                      <span className="text-xs text-gray-400">({Math.round(a.conteudo.length / 1000)} mil caracteres)</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={usarAutos} onChange={(e) => setUsarAutos(e.target.checked)} />
            Pesquisar nos autos (aba Autos) enquanto redige
          </label>

          <details className="rounded-lg border border-gray-100 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">Instruções do meu projeto (opcional)</summary>
            <p className="mt-2 text-xs text-gray-500">
              Cole aqui as instruções de um projeto do Cowork (por exemplo, da Advogada Criminalista). Ficam guardadas neste computador.
            </p>
            <textarea
              className={`${campo} mt-2 h-32`}
              value={projeto}
              onChange={(e) => {
                setProjeto(e.target.value);
                guardar(chaveProjeto, e.target.value);
              }}
            />
          </details>

          <label className="block text-xs font-medium text-gray-600">
            Instruções adicionais (teses, o que enfatizar, o que evitar)
            <textarea className={`${campo} mt-1 h-24`} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => gerar(false)} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Gerar peça
            </Button>
            {gerando && (
              <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                <Square className="h-4 w-4" /> Parar
              </Button>
            )}
          </div>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </CardContent>
      </Card>

      {(texto || gerando) && (
        <Card>
          <CardContent className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{tipoPeca(tipo).label}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copiar} disabled={!texto}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="outline" onClick={baixar} disabled={!texto}>
                  <Download className="h-4 w-4" /> Baixar .txt
                </Button>
                <Button size="sm" onClick={salvarNoProcesso} disabled={!texto || gerando || gravacao === "salvando"}>
                  {gravacao === "salvando" ? <Loader2 className="h-4 w-4 animate-spin" /> : gravacao === "salvo" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {gravacao === "salvando" ? "Salvando…" : gravacao === "salvo" ? "Salvo nas anotações" : "Salvar nas anotações"}
                </Button>
              </div>
            </div>

            <textarea
              className={`${campo} min-h-[28rem] font-serif leading-relaxed`}
              value={texto}
              readOnly={gerando}
              onChange={(e) => {
                setTexto(e.target.value);
                setGravacao("");
                guardar(chaveRascunho, e.target.value);
              }}
            />

            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row">
              <input
                className={`${campo} flex-1`}
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value)}
                placeholder="Pedir ajuste (ex.: reforce a contradição da testemunha 2; encurte a dosimetria)"
              />
              <Button variant="secondary" onClick={() => gerar(true)} disabled={gerando || !texto.trim() || !ajuste.trim()}>
                <Wand2 className="h-4 w-4" /> Ajustar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
