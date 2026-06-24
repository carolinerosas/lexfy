"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  DollarSign,
  FolderOpen,
  ListTodo,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  getAtendimentosWithProcesso,
  getAudienciasWithProcesso,
  getHonorariosWithProcesso,
  getClientes,
  getPrazosWithProcesso,
  getProcessos,
  getTarefasWithProcesso,
} from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

type ResultItem =
  | { kind: "cliente"; id: string; title: string; sub: string; href: string }
  | { kind: "processo"; id: string; title: string; sub: string; href: string }
  | { kind: "prazo"; id: string; title: string; sub: string; href: string }
  | { kind: "tarefa"; id: string; title: string; sub: string; href: string }
  | { kind: "audiencia"; id: string; title: string; sub: string; href: string }
  | { kind: "atendimento"; id: string; title: string; sub: string; href: string }
  | { kind: "honorario"; id: string; title: string; sub: string; href: string };

const kindMeta: Record<ResultItem["kind"], { label: string; icon: React.ReactNode; color: string }> = {
  cliente: { label: "Cliente", icon: <Users className="h-3.5 w-3.5" />, color: "bg-violet-50 text-violet-700" },
  processo: { label: "Processo", icon: <FolderOpen className="h-3.5 w-3.5" />, color: "bg-gray-100 text-gray-600" },
  prazo: { label: "Prazo", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-amber-50 text-amber-700" },
  tarefa: { label: "Tarefa", icon: <ListTodo className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-700" },
  audiencia: { label: "Audiência", icon: <Calendar className="h-3.5 w-3.5" />, color: "bg-blue-50 text-blue-700" },
  atendimento: { label: "Atendimento", icon: <Users className="h-3.5 w-3.5" />, color: "bg-violet-50 text-violet-700" },
  honorario: { label: "Honorário", icon: <DollarSign className="h-3.5 w-3.5" />, color: "bg-green-50 text-green-700" },
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matches(query: string, ...fields: (string | undefined | null)[]) {
  const q = normalize(query);
  return fields.some((field) => field && normalize(field).includes(q));
}

async function search(query: string): Promise<ResultItem[]> {
  if (!query.trim()) return [];

  const results: ResultItem[] = [];
  const [clientes, processos, prazos, tarefas, audiencias, atendimentos, honorarios] = await Promise.all([
    getClientes().catch(() => []),
    getProcessos().catch(() => []),
    getPrazosWithProcesso().catch(() => []),
    getTarefasWithProcesso().catch(() => []),
    getAudienciasWithProcesso().catch(() => []),
    getAtendimentosWithProcesso().catch(() => []),
    getHonorariosWithProcesso().catch(() => []),
  ]);

  clientes.forEach((cliente) => {
    if (matches(query, cliente.nome, cliente.cpf, cliente.rg, cliente.email, cliente.celular)) {
      const contatos = [cliente.cpf, cliente.email, cliente.celular].filter(Boolean);
      results.push({
        kind: "cliente",
        id: cliente.id,
        title: cliente.nome,
        sub: contatos.length > 0 ? contatos.join(" · ") : "Cliente cadastrado",
        href: `/dashboard/clientes/${cliente.id}`,
      });
    }
  });

  processos.forEach((p) => {
    if (matches(query, p.numero, p.titulo, p.cliente_nome, p.parte_contraria, p.descricao)) {
      results.push({
        kind: "processo",
        id: p.id,
        title: p.titulo || p.numero,
        sub: `${p.cliente_nome} · ${p.numero || p.numero_inquerito || "Sem número"}`,
        href: `/dashboard/processos/${p.id}`,
      });
    }
  });

  prazos.forEach((p) => {
    if (matches(query, p.titulo, p.descricao, p.processo?.cliente_nome, p.processo?.numero)) {
      results.push({
        kind: "prazo",
        id: p.id,
        title: p.titulo,
        sub: `${p.processo?.cliente_nome ?? "—"} · ${formatDate(p.data_prazo)}`,
        href: "/dashboard/prazos",
      });
    }
  });

  tarefas.forEach((t) => {
    if (matches(query, t.titulo, t.descricao, t.processo?.cliente_nome, t.processo?.numero)) {
      results.push({
        kind: "tarefa",
        id: t.id,
        title: t.titulo,
        sub: `${t.processo?.cliente_nome ?? "—"} · ${t.data_limite ? formatDate(t.data_limite) : "sem data"}`,
        href: "/dashboard/tarefas",
      });
    }
  });

  audiencias.forEach((a) => {
    if (matches(query, a.titulo, a.local, a.processo?.cliente_nome, a.processo?.numero)) {
      results.push({
        kind: "audiencia",
        id: a.id,
        title: a.titulo,
        sub: `${a.processo?.cliente_nome ?? "—"} · ${formatDate(a.data_hora)}${a.local ? ` · ${a.local}` : ""}`,
        href: "/dashboard/audiencias",
      });
    }
  });

  atendimentos.forEach((a) => {
    if (matches(query, a.cliente_nome, a.notas)) {
      results.push({
        kind: "atendimento",
        id: a.id,
        title: a.cliente_nome,
        sub: `Atendimento · ${formatDate(a.data_hora)}`,
        href: "/dashboard/atendimentos",
      });
    }
  });

  honorarios.forEach((h) => {
    if (matches(query, h.descricao, h.processo?.cliente_nome, h.processo?.numero)) {
      results.push({
        kind: "honorario",
        id: h.id,
        title: h.descricao,
        sub: `${h.processo?.cliente_nome ?? "—"} · ${formatCurrency(h.valor)}`,
        href: "/dashboard/financeiro",
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
  const [completedQuery, setCompletedQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) return;

    let cancelled = false;
    search(query)
      .then((items) => {
        if (!cancelled) {
          setResults(items);
          setCompletedQuery(query);
          setSelected(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const searching = Boolean(query.trim()) && completedQuery !== query;

  const navigate = useCallback((item: ResultItem) => {
    router.push(item.href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && results[selected]) navigate(results[selected]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selected, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar processos, clientes, prazos, tarefas..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-gray-300 transition-colors hover:text-gray-500">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 sm:block">ESC</kbd>
        </div>

        {query ? (
          <div className="max-h-[50vh] overflow-y-auto">
            {searching ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">Buscando...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">
                  Nenhum resultado para <span className="font-medium text-gray-600">&quot;{query}&quot;</span>
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {results.map((item, i) => {
                  const meta = kindMeta[item.kind];
                  const isSelected = i === selected;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelected(i)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.color}`}>
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="truncate text-xs text-gray-400">{item.sub}</p>
                        </div>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                        {isSelected && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="mb-3 text-xs text-gray-400">Pesquise por nome de cliente, número de processo, tarefa ou descrição.</p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400">
              <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">↑↓</kbd> navegar</span>
              <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Enter</kbd> abrir</span>
              <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Esc</kbd> fechar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
