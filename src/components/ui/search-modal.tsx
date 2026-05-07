"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, Clock, Calendar, Users, DollarSign, ArrowRight, X } from "lucide-react";
import {
  getProcessos,
  getPrazosWithProcesso,
  getAudienciasWithProcesso,
  getAtendimentosWithProcesso,
  getHonorariosWithProcesso,
} from "@/lib/store";
import { formatDate, formatCurrency } from "@/lib/utils";

type ResultItem =
  | { kind: "processo"; id: string; title: string; sub: string; href: string }
  | { kind: "prazo"; id: string; title: string; sub: string; href: string }
  | { kind: "audiencia"; id: string; title: string; sub: string; href: string }
  | { kind: "atendimento"; id: string; title: string; sub: string; href: string }
  | { kind: "honorario"; id: string; title: string; sub: string; href: string };

const kindMeta: Record<ResultItem["kind"], { label: string; icon: React.ReactNode; color: string }> = {
  processo: { label: "Processo", icon: <FolderOpen className="w-3.5 h-3.5" />, color: "text-gray-600 bg-gray-100" },
  prazo: { label: "Prazo", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-700 bg-amber-50" },
  audiencia: { label: "Audiência", icon: <Calendar className="w-3.5 h-3.5" />, color: "text-blue-700 bg-blue-50" },
  atendimento: { label: "Atendimento", icon: <Users className="w-3.5 h-3.5" />, color: "text-violet-700 bg-violet-50" },
  honorario: { label: "Honorário", icon: <DollarSign className="w-3.5 h-3.5" />, color: "text-green-700 bg-green-50" },
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matches(query: string, ...fields: (string | undefined | null)[]) {
  const q = normalize(query);
  return fields.some((f) => f && normalize(f).includes(q));
}

function search(query: string): ResultItem[] {
  if (!query.trim()) return [];
  const results: ResultItem[] = [];

  getProcessos().forEach((p) => {
    if (matches(query, p.numero, p.titulo, p.cliente_nome, p.parte_contraria, p.descricao)) {
      results.push({
        kind: "processo",
        id: p.id,
        title: p.titulo || p.numero,
        sub: `${p.cliente_nome} · ${p.numero}`,
        href: `/dashboard/processos/${p.id}`,
      });
    }
  });

  getPrazosWithProcesso().forEach((p) => {
    if (matches(query, p.titulo, p.descricao, p.processo?.cliente_nome, p.processo?.numero)) {
      results.push({
        kind: "prazo",
        id: p.id,
        title: p.titulo,
        sub: `${p.processo?.cliente_nome ?? "—"} · ${formatDate(p.data_prazo)}`,
        href: `/dashboard/prazos`,
      });
    }
  });

  getAudienciasWithProcesso().forEach((a) => {
    if (matches(query, a.titulo, a.local, a.processo?.cliente_nome, a.processo?.numero)) {
      results.push({
        kind: "audiencia",
        id: a.id,
        title: a.titulo,
        sub: `${a.processo?.cliente_nome ?? "—"} · ${formatDate(a.data_hora)}${a.local ? ` · ${a.local}` : ""}`,
        href: `/dashboard/audiencias`,
      });
    }
  });

  getAtendimentosWithProcesso().forEach((a) => {
    if (matches(query, a.cliente_nome, a.notas)) {
      results.push({
        kind: "atendimento",
        id: a.id,
        title: a.cliente_nome,
        sub: `Atendimento · ${formatDate(a.data_hora)}`,
        href: `/dashboard/atendimentos`,
      });
    }
  });

  getHonorariosWithProcesso().forEach((h) => {
    if (matches(query, h.descricao, h.processo?.cliente_nome, h.processo?.numero)) {
      results.push({
        kind: "honorario",
        id: h.id,
        title: h.descricao,
        sub: `${h.processo?.cliente_nome ?? "—"} · ${formatCurrency(h.valor)}`,
        href: `/dashboard/financeiro`,
      });
    }
  });

  return results.slice(0, 20);
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const r = search(query);
    setResults(r);
    setSelected(0);
  }, [query]);

  const navigate = useCallback(
    (item: ResultItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return; }
      if (e.key === "Enter" && results[selected]) { navigate(results[selected]); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selected, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar processos, clientes, prazos..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono hidden sm:block">ESC</kbd>
        </div>

        {/* Results */}
        {query && (
          <div className="max-h-[50vh] overflow-y-auto">
            {results.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">Nenhum resultado para <span className="font-medium text-gray-600">"{query}"</span></p>
              </div>
            ) : (
              <ul className="py-2">
                {results.map((item, i) => {
                  const meta = kindMeta[item.kind];
                  const isSelected = i === selected;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelected(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${meta.color}`}>
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-400 truncate">{item.sub}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                          {meta.label}
                        </span>
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Empty state / hints */}
        {!query && (
          <div className="py-8 px-4 text-center">
            <p className="text-xs text-gray-400 mb-3">Pesquise por nome de cliente, número de processo, descrição…</p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400">
              <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> navegar</span>
              <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> abrir</span>
              <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> fechar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
