"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, CheckCircle, X, Trash2, ChevronDown, Phone, Clock, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getTriagemLeads, updateTriagemLead, deleteTriagemLead,
  createCliente, createAtendimento,
} from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import type { TriagemLead } from "@/types";

const urgenciaVariant: Record<string, "danger" | "warning" | "neutral"> = {
  alta: "danger",
  media: "warning",
  baixa: "neutral",
};

export default function TriagemPage() {
  const [leads, setLeads] = useState<TriagemLead[]>([]);
  const [filter, setFilter] = useState<"novos" | "todos">("novos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLeads(await getTriagemLeads());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = leads.filter((l) => (filter === "novos" ? l.status === "novo" : true));
  const novos = leads.filter((l) => l.status === "novo").length;

  const linkTriagem = typeof window !== "undefined" ? `${window.location.origin}/triagem` : "/triagem";

  async function aprovar(l: TriagemLead) {
    setBusy(l.id);
    try {
      const contato = l.contato ?? l.telefone ?? "";
      const email = contato.includes("@") ? contato : undefined;
      const celular = !email ? contato : undefined;
      const cli = await createCliente({
        nome: l.nome?.trim() || "Cliente (triagem)",
        email,
        celular,
        observacoes: [l.area ? `Área: ${l.area}` : "", l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : ""].filter(Boolean).join("\n"),
      });
      await createAtendimento({
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        data_hora: new Date().toISOString(),
        tipo: "consulta_inicial",
        status: "agendado",
        notas: [l.resumo ? `Resumo: ${l.resumo}` : "", l.detalhes ? `Detalhes: ${l.detalhes}` : "", l.area ? `Área: ${l.area}` : "", "(Origem: triagem automática)"].filter(Boolean).join("\n"),
      });
      await updateTriagemLead(l.id, { status: "aprovado" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function descartar(l: TriagemLead) {
    setBusy(l.id);
    try { await updateTriagemLead(l.id, { status: "descartado" }); await load(); }
    finally { setBusy(null); }
  }

  async function excluir(l: TriagemLead) {
    if (!window.confirm("Excluir este lead da triagem?")) return;
    setBusy(l.id);
    try { await deleteTriagemLead(l.id); await load(); }
    finally { setBusy(null); }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Triagem</h1>
          <p className="text-gray-500 text-sm mt-1">
            {novos > 0 ? <span className="text-blue-600 font-medium">{novos} novo{novos !== 1 ? "s" : ""} para revisar</span> : "Leads do atendimento automático"}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["novos", "todos"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {f === "novos" ? "Novos" : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Link do atendimento */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Link do atendimento automático</p>
            <p className="text-xs text-gray-500 mt-0.5 break-all">{linkTriagem}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(linkTriagem); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {copiado ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copiado ? "Copiado!" : "Copiar"}
          </button>
          <a href={linkTriagem} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#21181d] px-3 text-xs font-semibold text-white hover:bg-[#2b2027]">
            <ExternalLink className="w-4 h-4" /> Abrir
          </a>
        </CardContent>
      </Card>

      {filtrados.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <MessageSquare className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">{filter === "novos" ? "Nenhum lead novo" : "Nenhum lead ainda"}</p>
            <p className="text-gray-400 text-sm mt-1">Compartilhe o link acima para começar a receber triagens.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((l) => {
            const expandido = aberto === l.id;
            return (
              <Card key={l.id} className={l.status !== "novo" ? "opacity-70" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{l.nome || "Sem nome"}</p>
                        {l.area && <Badge variant="neutral">{l.area}</Badge>}
                        {l.urgencia && <Badge variant={urgenciaVariant[l.urgencia] ?? "neutral"}>{l.urgencia}</Badge>}
                        {l.status === "aprovado" && <span className="text-[11px] font-semibold text-green-600">✓ aprovado</span>}
                        {l.status === "descartado" && <span className="text-[11px] font-semibold text-gray-400">descartado</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        {(l.contato || l.telefone) && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {l.contato || l.telefone}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(l.created_at)}</span>
                      </div>
                      {l.resumo && <p className="mt-2 text-sm text-gray-700 line-clamp-3">{l.resumo}</p>}
                      {l.detalhes && <p className="mt-1 text-xs text-gray-500">{l.detalhes}</p>}

                      {l.transcricao && (
                        <button onClick={() => setAberto(expandido ? null : l.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandido ? "rotate-180" : ""}`} />
                          {expandido ? "Ocultar conversa" : "Ver conversa completa"}
                        </button>
                      )}
                      {expandido && l.transcricao && (
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600 font-sans">{l.transcricao}</pre>
                      )}
                    </div>
                  </div>

                  {l.status === "novo" && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                      <Button variant="ghost" size="sm" onClick={() => excluir(l)} disabled={busy === l.id}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => descartar(l)} disabled={busy === l.id}>
                        <X className="w-3.5 h-3.5" /> Descartar
                      </Button>
                      <Button size="sm" onClick={() => aprovar(l)} disabled={busy === l.id}>
                        <CheckCircle className="w-3.5 h-3.5" /> {busy === l.id ? "Aprovando..." : "Aprovar (vira cliente)"}
                      </Button>
                    </div>
                  )}
                  {l.status !== "novo" && (
                    <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                      <Button variant="ghost" size="sm" onClick={() => excluir(l)} disabled={busy === l.id}>
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
