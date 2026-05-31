"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, DownloadCloud, Filter, FolderOpen, Loader2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createProcesso, getProcessos, vincularPublicacoesAoProcesso } from "@/lib/store";
import { parseCNJ } from "@/lib/datajud";
import { getPerfilAdvogado } from "@/lib/perfil";
import { descobrirProcessosDjenSyncLocal } from "@/lib/syncLocal";
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

function onlyDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function inferUf(numero: string, tribunal?: string): string | undefined {
  if ((tribunal ?? "").toUpperCase() === "TJRJ" || numero.includes(".8.19.")) return "RJ";
  return undefined;
}

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "erro">("idle");
  const [importMsg, setImportMsg] = useState("");

  const load = useCallback(async () => {
    setProcessos(await getProcessos());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleImportarPorOab() {
    const perfil = getPerfilAdvogado();
    if (!perfil.nome?.trim() && !perfil.oab_numero?.trim()) {
      setImportStatus("erro");
      setImportMsg("Configure seu nome e OAB em Configuracoes antes de importar processos.");
      return;
    }

    setImportando(true);
    setImportStatus("idle");
    setImportMsg("Buscando processos publicados no DJEN pelo seu nome/OAB...");

    try {
      const encontrados = await descobrirProcessosDjenSyncLocal({
        nome: perfil.nome,
        oabNumero: perfil.oab_numero,
        oabUF: perfil.oab_uf || "RJ",
        dias: 180,
      });
      const atuais = await getProcessos();
      const existentes = new Set(atuais.map((p) => onlyDigits(p.numero)));
      let importados = 0;
      let repetidos = 0;

      for (const item of encontrados) {
        const key = onlyDigits(item.numero);
        if (!key || existentes.has(key)) {
          repetidos += 1;
          continue;
        }

        const { tribunal } = parseCNJ(item.numero);
        const novo = await createProcesso({
          numero: item.numero,
          titulo: item.classe || "Processo importado do DJEN",
          cliente_nome: "Cliente a identificar",
          parte_contraria: undefined,
          tribunal: tribunal?.toUpperCase() || item.tribunal,
          vara: item.orgao,
          comarca: undefined,
          uf: inferUf(item.numero, item.tribunal),
          tipo: "outro",
          fase: undefined,
          valor_causa: undefined,
          data_distribuicao: undefined,
          descricao: `Encontrado no DJEN por nome/OAB. Ultima publicacao: ${item.ultima_publicacao ?? "sem data"}.`,
          status: "ativo",
          monitorar_datajud: true,
        });
        await vincularPublicacoesAoProcesso(novo.id, item.numero).catch(() => undefined);
        existentes.add(key);
        importados += 1;
      }

      await load();
      setImportStatus("ok");
      setImportMsg(
        importados > 0
          ? `Importei ${importados} processo${importados !== 1 ? "s" : ""}. ${repetidos} ja existia${repetidos !== 1 ? "m" : ""}.`
          : `Nenhum processo novo encontrado. ${repetidos} ja estava${repetidos !== 1 ? "m" : ""} cadastrado${repetidos !== 1 ? "s" : ""}.`
      );
    } catch (err) {
      setImportStatus("erro");
      setImportMsg(
        err instanceof Error
          ? `Nao consegui importar: ${err.message}. Verifique se o Justio Sync Local esta rodando.`
          : "Nao consegui importar. Verifique se o Justio Sync Local esta rodando."
      );
    } finally {
      setImportando(false);
    }
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={handleImportarPorOab} disabled={importando}>
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Importar por OAB
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Processo
          </Button>
        </div>
      </div>

      {importMsg && (
        <div className={`mb-5 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
          importStatus === "ok"
            ? "bg-green-50 text-green-700"
            : importStatus === "erro"
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-600"
        }`}>
          {importStatus === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : null}
          {importStatus === "erro" ? <AlertCircle className="w-4 h-4 shrink-0" /> : null}
          {importando ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : null}
          {importMsg}
        </div>
      )}

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
