"use client";

import { useState, useRef, useEffect } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { JustioHexIcon } from "@/components/ui/justio-logo";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Olá! 👋 Sou o assistente virtual do escritório Caroline Rosas Advocacia. Vou fazer algumas perguntas rápidas para entender seu caso e encaminhar para a Dra. Caroline analisar. Tudo bem? (Seus dados serão usados apenas pelo escritório.)\n\nPara começar, qual é o seu nome completo?";

export default function TriagemPage() {
  const [turns, setTurns] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const display: Msg[] = [{ role: "assistant", content: GREETING }, ...turns];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [display.length, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || done) return;
    setInput("");
    const novosTurns: Msg[] = [...turns, { role: "user", content: text }];
    setTurns(novosTurns);
    setLoading(true);
    try {
      const apiMessages: Msg[] = [
        { role: "user", content: "[O cliente iniciou a conversa]" },
        { role: "assistant", content: GREETING },
        ...novosTurns,
      ];
      const res = await fetch("/api/triagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, canal: "link" }),
      });
      const data = (await res.json()) as { reply: string; done?: boolean };
      setTurns((t) => [...t, { role: "assistant", content: data.reply }]);
      if (data.done) setDone(true);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Tive um problema técnico. Pode tentar novamente?" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Cabeçalho */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-[#21181d] px-4 py-3 text-white">
        <JustioHexIcon size={32} dark={true} />
        <div className="leading-tight">
          <p className="text-sm font-bold">Caroline Rosas Advocacia</p>
          <p className="text-[11px] text-gray-400">Atendimento · triagem inicial</p>
        </div>
      </header>

      {/* Conversa */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {display.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "rounded-br-sm bg-[#21181d] text-white"
                    : "rounded-bl-sm bg-white text-gray-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-gray-400 shadow-sm">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                </span>
              </div>
            </div>
          )}
          {done && (
            <div className="mx-auto mt-2 flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Informações enviadas! Em breve entraremos em contato.
            </div>
          )}
        </div>
      </div>

      {/* Entrada */}
      <div className="border-t border-gray-200 bg-white px-3 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-lg items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={done ? "Atendimento concluído" : "Escreva sua mensagem…"}
            disabled={done}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 disabled:bg-gray-100"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || done}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#21181d] text-white transition-colors hover:bg-[#2b2027] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
