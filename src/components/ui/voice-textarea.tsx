"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface VoiceTextareaProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function VoiceTextarea({
  id,
  label,
  description,
  value,
  onChange,
  placeholder,
  className,
  rows,
}: VoiceTextareaProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function appendDictation(finalText: string, interimText = "") {
    const base = baseTextRef.current.trimEnd();
    const spoken = [finalText, interimText].filter(Boolean).join(" ").trim();
    onChange([base, spoken].filter(Boolean).join(base ? "\n" : ""));
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Ditado não disponível neste navegador.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseTextRef.current = value;
    setError("");

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interimText += `${result[0].transcript} `;
      }

      appendDictation(finalText.trim(), interimText.trim());
      if (finalText.trim()) {
        baseTextRef.current = [baseTextRef.current.trimEnd(), finalText.trim()].filter(Boolean).join(baseTextRef.current.trim() ? "\n" : "");
      }
    };

    recognition.onerror = () => {
      setError("Não consegui ouvir. Verifique a permissão do microfone.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
          {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
        </div>
        <button
          type="button"
          onClick={toggleListening}
          disabled={!supported}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            listening
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            !supported && "cursor-not-allowed opacity-50"
          )}
          title={supported ? "Ditar anotações por áudio" : "Ditado não disponível neste navegador"}
        >
          {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {listening ? "Parar áudio" : "Ditar áudio"}
        </button>
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!supported && (
        <p className="text-xs text-gray-400">
          O ditado por áudio depende do navegador. No Chrome ou Edge, ele deve aparecer após permitir o microfone.
        </p>
      )}
    </div>
  );
}
