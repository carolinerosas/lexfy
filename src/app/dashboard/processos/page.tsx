"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Filter, FolderOpen, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProcessos } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Processo, ProcessoStatus, ProcessoTipo } from "@/types";
import { NovoProcessoModal } from "./novo-processo-modal";

const statusLabel: Record<ProcessoStatus, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  encerrado: "Encerrado",
};

const statusVariant: Record<ProcessoStatus, "default" | "warning" | "neutral" | "danger"> = {
  ativo: "default",
  suspenso: "warning",
  arquivado: "neutral",
  encerrado: "neutral",
};

const tipoLabel: Record<ProcessoTipo, string> = {
  civel: "Cível",
  criminal: "Criminal",
  trabalhista: "Trabalhista",
  previdenciario: "Previdenciário",
  tributario: "Tributário",
  federal: "Federal",
  outro: "Outro",
};

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setProcessos(await getProcessos());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = processos.filter((p) => {
    const matchSearch =
      !search ||
      p.numero.toLowerCase().includes(search.toLowerCase()) ||
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.parte_contraria ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processos</h1>
          <p className="text-gray-500 text-sm mt-1">{processos.length} processo{processos.length !== 1 ? "s" : ""} cadastrado{processos.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Novo Processo
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-48 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(["todos", "ativo", "suspenso", "arquivado", "encerrado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "todos" ? "Todos" : statusLabel[s as ProcessoStatus]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500 font-medium">Nenhum processo encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? "Tente outros termos de busca" : "Adicione seu primeiro processo"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" /> Novo Processo
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-6 py-3">Número / Título</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Tribunal</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Tipo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Distribuição</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 font-mono text-xs">{p.numero}</p>
                    <p className="text-gray-600 mt-0.5 line-clamp-1">{p.titulo}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-gray-800 font-medium truncate max-w-32">{p.cliente_nome}</p>
                    {p.parte_contraria && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate max-w-32">vs. {p.parte_contraria}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell text-gray-600">
                    {p.tribunal ?? "—"}{p.uf ? `/${p.uf}` : ""}
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell text-gray-600">
                    {p.tipo ? tipoLabel[p.tipo] : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-4 hidden xl:table-cell text-gray-500">
                    {p.data_distribuicao ? formatDate(p.data_distribuicao) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/dashboard/processos/${p.id}`}
                      className="text-gray-500 hover:text-gray-900 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Ver detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NovoProcessoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { load(); setShowModal(false); }}
      />
    </div>
  );
}
