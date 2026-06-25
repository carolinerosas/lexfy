"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBriefings, marcarBriefingLido, deleteBriefing } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Briefing } from "@/types";

export default function BriefingPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBriefings(await getBriefings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function marcarLido(b: Briefing) {
    setBusy(b.id);
    try {
      await marcarBriefingLido(b.id);
      await load();
    } finally {
      setBusy("");
    }
  }

  async function excluir(b: Briefing) {
    if (!window.confirm("Excluir este briefing?")) return;
    setBusy(b.id);
    try {
      await deleteBriefing(b.id);
      await load();
    } finally {
      setBusy("");
    }
  }

  const naoLidos = briefings.filter((b) => !b.lida).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="w-5 h-5 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Briefing</h1>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          {naoLidos > 0
            ? <span className="text-blue-600 font-medium">{naoLidos} novo{naoLidos !== 1 ? "s" : ""} para ler</span>
            : "Resumos diários gerados pelo seu agente"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : briefings.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Sparkles className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">Nenhum briefing ainda</p>
            <p className="text-gray-400 text-sm mt-1">Quando o agente rodar, os resumos diários aparecem aqui.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <Card key={b.id} className={b.lida ? "opacity-75" : ""}>
              <CardContent className="py-4 px-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">
                      {b.data ? formatDate(b.data) : formatDateTime(b.created_at)}
                    </p>
                    {!b.lida && <Badge variant="info">novo</Badge>}
                    {b.origem && <span className="text-[11px] text-gray-400">{b.origem}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!b.lida && (
                      <Button variant="ghost" size="sm" onClick={() => marcarLido(b)} disabled={busy === b.id}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marcar lido
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => excluir(b)}
                      disabled={busy === b.id}
                      title="Excluir briefing"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{b.conteudo}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
