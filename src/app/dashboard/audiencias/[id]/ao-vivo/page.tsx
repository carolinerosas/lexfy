"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Copy, NotebookPen, FileText, Gavel, Lightbulb, Mic, Pause, Save, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RoteiroModal } from "@/components/ui/roteiro-modal";
import { createAnotacao, getAudienciasWithProcesso, updateAudiencia } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { Audiencia, Processo } from "@/types";

// Audiência ao vivo: microfone → Deepgram (streaming, com separação de falantes) →
// transcrição na tela; o Claude lê a transcrição + o processo e dá dicas, monta os
// requerimentos finais (art. 402 CPP) e as alegações finais (art. 403 CPP).

type AudienciaComProcesso = Audiencia & { processo?: Pick<Processo, "numero" | "titulo" | "cliente_nome"> };
type Modo = "dicas" | "requerimentos" | "alegacoes";

interface Trecho {
  falante: number;
  texto: string;
  inicio: number; // segundos desde o começo da gravação
}

interface Dica {
  hora: string;
  texto: string;
}

interface DgPalavra {
  punctuated_word?: string;
  word: string;
  speaker?: number;
  start: number;
}

interface DgResultado {
  type?: string;
  is_final?: boolean;
  channel?: { alternatives?: { transcript?: string; words?: DgPalavra[] }[] };
}

const DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&diarize=true&smart_format=true&punctuate=true&interim_results=true&endpointing=300";
const INTERVALO_DICAS_MS = 60_000;
const CORES = ["bg-blue-50 text-blue-800", "bg-amber-50 text-amber-800", "bg-emerald-50 text-emerald-800", "bg-rose-50 text-rose-800", "bg-violet-50 text-violet-800", "bg-cyan-50 text-cyan-800"];

function relogio(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AudienciaAoVivoPage() {
  const { id } = useParams<{ id: string }>();
  const livre = id === "livre"; // audiência avulsa, sem processo no Justio
  const chaveLocal = `justio_aovivo_${id}`;

  const [audiencia, setAudiencia] = useState<AudienciaComProcesso | null>(null);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [parcial, setParcial] = useState("");
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [estado, setEstado] = useState<"parado" | "conectando" | "gravando" | "pausado">("parado");
  const [erro, setErro] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [dicasAuto, setDicasAuto] = useState(true);
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [analisando, setAnalisando] = useState<Modo | null>(null);
  const [peca, setPeca] = useState<{ modo: Exclude<Modo, "dicas">; texto: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [roteiro, setRoteiro] = useState("");
  const [notas, setNotas] = useState("");
  const [roteiroNome, setRoteiroNome] = useState("");
  const [editandoRoteiro, setEditandoRoteiro] = useState(false);
  const [area, setArea] = useState<"auto" | "criminal" | "familia" | "geral">("auto");

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const encerrandoRef = useRef(false);
  const offsetRef = useRef(0); // segundos já gravados antes da conexão atual
  const ultimaAnaliseRef = useRef(0); // tamanho da transcrição na última dica
  const fimRef = useRef<HTMLDivElement | null>(null);

  // --- carregar audiência e o backup local (se o navegador fechou no meio) ---
  useEffect(() => {
    getAudienciasWithProcesso().then((lista) => {
      const atual = livre ? null : lista.find((a) => a.id === id) ?? null;
      setAudiencia(atual);
      try {
        const salvo = JSON.parse(localStorage.getItem(chaveLocal) ?? "null") as {
          trechos: Trecho[];
          nomes: Record<number, string>;
          dicas: Dica[];
          roteiro?: string;
          notas?: string;
          roteiroNome?: string;
          area?: "auto" | "criminal" | "familia" | "geral";
          segundos: number;
        } | null;
        if (atual?.roteiro) {
          setRoteiro(atual.roteiro);
          setRoteiroNome(atual.roteiro_nome ?? "");
        } else if (salvo?.roteiro) {
          setRoteiro(salvo.roteiro);
          setRoteiroNome(salvo.roteiroNome ?? "");
        }
        if (salvo?.area) setArea(salvo.area);
        if (salvo?.notas) setNotas(salvo.notas);
        if (salvo?.trechos?.length) {
          setTrechos(salvo.trechos);
          setNomes(salvo.nomes ?? {});
          setDicas(salvo.dicas ?? []);
          setSegundos(salvo.segundos ?? 0);
          offsetRef.current = salvo.segundos ?? 0;
          setAviso("Recuperei a transcrição que estava em andamento neste aparelho.");
        }
      } catch {
        // sem backup local
      }
    });
  }, [id, chaveLocal, livre]);

  useEffect(() => {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify({ trechos, nomes, dicas, segundos, roteiro, roteiroNome, area, notas }));
    } catch {
      // armazenamento indisponível: segue sem backup
    }
  }, [chaveLocal, trechos, nomes, dicas, segundos, roteiro, roteiroNome, area, notas]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trechos, parcial]);

  useEffect(() => {
    if (estado !== "gravando") return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [estado]);

  const nomeFalante = useCallback((f: number) => nomes[f] ?? `Voz ${f + 1}`, [nomes]);

  const textoTranscricao = useCallback(
    () => trechos.map((t) => `[${relogio(t.inicio)}] ${nomeFalante(t.falante)}: ${t.texto}`).join("\n"),
    [trechos, nomeFalante]
  );

  // --- transcrição ao vivo ---
  function receber(ev: MessageEvent) {
    const r = JSON.parse(ev.data as string) as DgResultado;
    if (r.type !== "Results") return;
    const alt = r.channel?.alternatives?.[0];
    if (!alt?.transcript) return;
    if (!r.is_final) {
      setParcial(alt.transcript);
      return;
    }
    setParcial("");
    const palavras = alt.words ?? [];
    setTrechos((atual) => {
      const novos = [...atual];
      for (const p of palavras) {
        const falante = p.speaker ?? 0;
        const texto = p.punctuated_word ?? p.word;
        const ultimo = novos[novos.length - 1];
        if (ultimo && ultimo.falante === falante) {
          novos[novos.length - 1] = { ...ultimo, texto: `${ultimo.texto} ${texto}` };
        } else {
          novos.push({ falante, texto, inicio: offsetRef.current + p.start });
        }
      }
      return novos;
    });
  }

  async function conectar() {
    const res = await fetch("/api/audiencia/token", { method: "POST" });
    const json = (await res.json()) as { token?: string; error?: string };
    if (!json.token) throw new Error(json.error ?? "Não consegui a senha do Deepgram.");

    const ws = new WebSocket(DEEPGRAM_URL, ["bearer", json.token]);
    wsRef.current = ws;
    ws.onmessage = receber;
    ws.onclose = () => {
      if (recRef.current?.state === "recording") recRef.current.stop();
      // Caiu no meio (internet do fórum): reconecta sozinho.
      if (!encerrandoRef.current && streamRef.current) {
        offsetRef.current = segundosRef.current;
        setEstado("conectando");
        setTimeout(() => conectar().catch((e) => falhar(e)), 1500);
      }
    };
    ws.onopen = () => {
      const rec = new MediaRecorder(streamRef.current!, { mimeType: "audio/webm;codecs=opus" });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      rec.start(250);
      recRef.current = rec;
      setEstado("gravando");
    };
  }

  const segundosRef = useRef(0);
  useEffect(() => {
    segundosRef.current = segundos;
  }, [segundos]);

  function falhar(e: unknown) {
    setErro(e instanceof Error ? e.message : String(e));
    parar();
  }

  async function iniciar() {
    setErro("");
    setAviso("");
    encerrandoRef.current = false;
    setEstado("conectando");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      wakeRef.current = await navigator.wakeLock?.request("screen").catch(() => null) ?? null;
      offsetRef.current = segundosRef.current;
      await conectar();
    } catch (e) {
      falhar(e);
    }
  }

  function parar(pausa = false) {
    encerrandoRef.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      wsRef.current.close();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
    setParcial("");
    setEstado(pausa ? "pausado" : "parado");
  }

  useEffect(() => () => parar(), []);

  // --- análises do Claude ---
  async function analisar(modo: Modo) {
    if ((!audiencia && !livre) || analisando) return;
    const transcricao = textoTranscricao();
    if (!transcricao) return;
    setAnalisando(modo);
    if (modo !== "dicas") setPeca({ modo, texto: "" });
    try {
      const res = await fetch("/api/audiencia/analisar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processo_id: audiencia?.processo_id,
          audiencia_id: audiencia?.id,
          transcricao,
          modo,
          roteiro: roteiro || undefined,
          notas: notas || undefined,
          area: area === "auto" ? undefined : area,
        }),
      });
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Erro ${res.status}`);
      const leitor = res.body.getReader();
      const dec = new TextDecoder();
      let texto = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        texto += dec.decode(value, { stream: true });
        if (modo !== "dicas") setPeca({ modo, texto });
      }
      if (modo === "dicas") {
        ultimaAnaliseRef.current = transcricao.length;
        if (!/^sem novidades relevantes\.?$/i.test(texto.trim())) {
          setDicas((d) => [{ hora: relogio(segundosRef.current), texto: texto.trim() }, ...d]);
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalisando(null);
    }
  }

  const analisarRef = useRef(analisar);
  analisarRef.current = analisar;
  useEffect(() => {
    if (!dicasAuto || estado !== "gravando") return;
    const t = setInterval(() => {
      if (textoTranscricao().length - ultimaAnaliseRef.current > 300) analisarRef.current("dicas");
    }, INTERVALO_DICAS_MS);
    return () => clearInterval(t);
  }, [dicasAuto, estado, textoTranscricao]);

  // --- salvar no processo ---
  async function salvar(titulo: string, conteudo: string) {
    if (livre) {
      // Sem processo: baixa um .txt para guardar na pasta do cliente.
      const url = URL.createObjectURL(new Blob([conteudo], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo.replace(/[\\/:*?"<>|]/g, "-")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!audiencia) return;
    await createAnotacao({ processo_id: audiencia.processo_id, titulo, conteudo });
    setAviso(`"${titulo}" salvo nas anotações do processo.`);
  }

  function renomear(f: number) {
    const novo = window.prompt("Quem é esta voz? (ex.: Juiz, MP, Testemunha João, Eu)", nomeFalante(f));
    if (novo?.trim()) setNomes((n) => ({ ...n, [f]: novo.trim() }));
  }

  function novaAudiencia() {
    if (!window.confirm("Apagar a transcrição desta tela e começar do zero? (O que já foi salvo no processo continua lá.)")) return;
    setTrechos([]);
    setDicas([]);
    setNomes({});
    setSegundos(0);
    setPeca(null);
    offsetRef.current = 0;
    ultimaAnaliseRef.current = 0;
    try {
      localStorage.removeItem(chaveLocal);
    } catch {
      // nada a limpar
    }
  }

  const falantes = [...new Set(trechos.map((t) => t.falante))].sort();
  const dataAudiencia = audiencia ? formatDateTime(audiencia.data_hora).split(" ")[0] : new Date().toLocaleDateString("pt-BR");
  const tituloPeca = peca?.modo === "alegacoes" ? "Alegações finais" : "Requerimentos finais";

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
      <Link href="/dashboard/audiencias" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Audiências
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Audiência ao vivo</h1>
          <p className="text-sm text-gray-500 mt-1 break-words">
            {livre
              ? "Audiência livre — sem processo vinculado"
              : audiencia
                ? `${audiencia.titulo} · ${audiencia.processo?.cliente_nome ?? "—"} · ${audiencia.processo?.numero ?? "—"}`
                : "Carregando…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estado === "gravando" || estado === "conectando" ? (
            <>
              <span className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                {estado === "conectando" ? "Conectando…" : relogio(segundos)}
              </span>
              <Button variant="secondary" onClick={() => parar(true)}>
                <Pause className="w-4 h-4" /> Pausar
              </Button>
              <Button variant="danger" onClick={() => parar()}>
                <Square className="w-4 h-4" /> Encerrar
              </Button>
            </>
          ) : (
            <Button onClick={iniciar} disabled={!audiencia && !livre}>
              <Mic className="w-4 h-4" /> {estado === "pausado" || trechos.length ? "Continuar gravação" : "Iniciar gravação"}
            </Button>
          )}
        </div>
      </div>

      {erro && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {aviso && <p className="mb-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">{aviso}</p>}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Transcrição: ocupa a altura toda da linha, com os botões colados no fim da caixa */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col py-4 px-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 mr-1">Transcrição</span>
              {falantes.map((f) => (
                <button key={f} onClick={() => renomear(f)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${CORES[f % CORES.length]}`} title="Toque para dizer quem é">
                  {nomeFalante(f)} ✎
                </button>
              ))}
            </div>
            <div className="relative min-h-[55vh] flex-1">
            <div className="absolute inset-0 overflow-y-auto space-y-3 pr-1">
              {trechos.length === 0 && !parcial && (
                <p className="py-16 text-center text-sm text-gray-400">
                  Aperte &quot;Iniciar gravação&quot; e deixe o celular ou o microfone perto de quem fala.
                </p>
              )}
              {trechos.map((t, i) => (
                <div key={i} className="text-sm leading-relaxed">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${CORES[t.falante % CORES.length]}`}>{nomeFalante(t.falante)}</span>
                  <span className="mr-2 text-xs text-gray-400">{relogio(t.inicio)}</span>
                  <span className="text-gray-800">{t.texto}</span>
                </div>
              ))}
              {parcial && <p className="text-sm italic text-gray-400">{parcial}</p>}
              <div ref={fimRef} />
            </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <Button size="sm" variant="outline" disabled={!trechos.length} onClick={() => salvar(`Transcrição — ${audiencia?.titulo ?? "audiência livre"} (${dataAudiencia})`, textoTranscricao())}>
                <Save className="w-4 h-4" /> {livre ? "Baixar transcrição (.txt)" : "Salvar transcrição no processo"}
              </Button>
              <Button size="sm" variant="ghost" disabled={!trechos.length || estado === "gravando"} onClick={novaAudiencia}>
                Limpar tela
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assistente */}
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 px-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Lightbulb className="w-4 h-4" /> Dicas
                </span>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={dicasAuto} onChange={(e) => setDicasAuto(e.target.checked)} />
                  automáticas (1 min)
                </label>
              </div>
              <Button size="sm" variant="secondary" className="mb-3 w-full" disabled={!trechos.length || !!analisando} onClick={() => analisar("dicas")}>
                {analisando === "dicas" ? "Analisando…" : "Analisar agora"}
              </Button>
              <div className="max-h-[30vh] overflow-y-auto space-y-3">
                {dicas.length === 0 && <p className="text-xs text-gray-400">As dicas aparecem aqui conforme a audiência anda.</p>}
                {dicas.map((d, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="mb-1 text-xs text-gray-400">{d.hora}</p>
                    <p className="whitespace-pre-line text-sm text-gray-800">{d.texto}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <NotebookPen className="w-4 h-4" /> Minhas anotações
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!notas.trim()}
                  onClick={() => salvar(`Anotações da audiência — ${audiencia?.titulo ?? "audiência livre"} (${dataAudiencia})`, notas)}
                  title={livre ? "Baixar .txt" : "Salvar no processo"}
                >
                  <Save className="w-4 h-4" />
                </Button>
              </div>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-200 p-3 text-sm"
                placeholder="Suas impressões e considerações. As dicas, os requerimentos e as alegações levam em conta o que você escrever aqui."
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!trechos.length || !!analisando} onClick={() => analisar("requerimentos")}>
              <FileText className="w-4 h-4" /> {analisando === "requerimentos" ? "Gerando…" : "Requerimentos finais"}
            </Button>
            <Button disabled={!trechos.length || !!analisando} onClick={() => analisar("alegacoes")}>
              <Gavel className="w-4 h-4" /> {analisando === "alegacoes" ? "Gerando…" : "Alegações finais"}
            </Button>
          </div>

          {peca && (
            <Card>
              <CardContent className="py-4 px-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{tituloPeca}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={!peca.texto} onClick={() => navigator.clipboard.writeText(peca.texto)} title="Copiar">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!peca.texto || !!analisando} onClick={() => salvar(`${tituloPeca} — ${audiencia?.titulo ?? "audiência livre"} (${dataAudiencia})`, peca.texto)} title={livre ? "Baixar .txt" : "Salvar no processo"}>
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-[15px] leading-relaxed text-gray-800">
                  {peca.texto || "Escrevendo…"}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ClipboardList className="w-4 h-4" /> Roteiro
                </span>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as typeof area)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
                  title="Perfil da advogada que assessora esta audiência"
                >
                  <option value="auto">Área: pelo processo</option>
                  <option value="criminal">Advogada criminal</option>
                  <option value="familia">Advogada de família</option>
                  <option value="geral">Geral</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {roteiro ? `Usando: ${roteiroNome || "roteiro colado"} (${roteiro.split(/\s+/).length} palavras)` : "Inclua o roteiro que você preparou: as dicas e as alegações partem dele."}
              </p>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setEditandoRoteiro(true)}>
                {roteiro ? "Ver ou trocar roteiro" : "Incluir roteiro de audiência"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <RoteiroModal
        open={editandoRoteiro}
        onClose={() => setEditandoRoteiro(false)}
        roteiro={roteiro}
        nome={roteiroNome}
        onSalvar={async (texto, nome) => {
          setRoteiro(texto);
          setRoteiroNome(nome);
          // Fica guardado na audiência: preparado no PC, aparece no celular no fórum.
          if (!livre) await updateAudiencia(id, { roteiro: texto || null, roteiro_nome: nome || null });
        }}
      />
    </div>
  );
}
