"use client";
// Caixa de texto com ditado por voz (Web Speech API, pt-BR). O botão de microfone aparece
// só nos navegadores que têm reconhecimento de voz (Chrome, Edge). O que é falado entra
// numa linha nova, depois do que já estava escrito.
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Mic, MicOff } from "lucide-react";

type Resultado = { isFinal: boolean; 0: { transcript: string } };
type Evento = { resultIndex: number; results: { length: number; [i: number]: Resultado } };
type Reconhecedor = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: Evento) => void) | null; onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type Construtor = new () => Reconhecedor;

const construtor = (): Construtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const juntar = (base: string, falado: string) => [base.trimEnd(), falado.trim()].filter(Boolean).join(base.trim() ? "\n" : "");

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & { value: string; aoMudar: (v: string) => void };

export function CaixaTexto({ value, aoMudar, className = "inp", ...resto }: Props) {
  const [suporta, setSuporta] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const rec = useRef<Reconhecedor | null>(null);
  const base = useRef("");

  useEffect(() => {
    const t = setTimeout(() => setSuporta(!!construtor()), 0);
    return () => { clearTimeout(t); rec.current?.stop(); };
  }, []);

  function alternar() {
    if (ouvindo) { rec.current?.stop(); setOuvindo(false); return; }
    const C = construtor();
    if (!C) return;
    const r = new C();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
    base.current = value;
    setErro("");
    r.onresult = (e) => {
      let final = "", parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += `${e.results[i][0].transcript} `; else parcial += `${e.results[i][0].transcript} `;
      }
      aoMudar(juntar(base.current, `${final} ${parcial}`));
      if (final.trim()) base.current = juntar(base.current, final);
    };
    r.onerror = () => { setErro("Não consegui ouvir. Confira a permissão do microfone."); setOuvindo(false); };
    r.onend = () => setOuvindo(false);
    rec.current = r;
    r.start();
    setOuvindo(true);
  }

  return (
    <span className="relative block">
      <textarea {...resto} className={`${className} ${suporta ? "pr-11" : ""}`} value={value} onChange={(e) => aoMudar(e.target.value)} />
      {suporta && (
        <button type="button" onClick={alternar} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar o ditado" : "Ditar por voz"} title={ouvindo ? "Parar o ditado" : "Ditar por voz"}
          className={`absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full transition-colors ${ouvindo ? "bg-perigo text-white" : "text-ink-3 hover:bg-cobalto-f hover:text-ink"}`}>
          {ouvindo ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
      )}
      {erro && <span role="alert" className="mt-1 block text-[12px] text-perigo">{erro}</span>}
    </span>
  );
}
