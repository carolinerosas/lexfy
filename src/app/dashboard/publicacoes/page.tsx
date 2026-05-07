"use client";

import { useEffect, useState, useCallback } from "react";
import { Newspaper, Plus, Eye, Search, ExternalLink, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPublicacoes, createPublicacao, marcarPublicacaoLida, getProcessos } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Publicacao, Processo } from "@/types";

const diarioOptions = [
  { value: "DOU", label: "Diário Oficial da União (DOU)" },
  { value: "TJERJ", label: "DJE/TJERJ — Rio de Janeiro" },
  { value: "TJSP", label: "DJE/TJSP — São Paulo" },
  { value: "TJMG", label: "DJE/TJMG — Minas Gerais" },
  { value: "TRF1", label: "TRF 1ª Região" },
  { value: "TRF2", label: "TRF 2ª Região" },
  { value: "TRF3", label: "TRF 3ª Região" },
  { value: "TRT", label: "TRT" },
  { value: "STJ", label: "STJ" },
  { value: "STF", label: "STF" },
  { value: "outro", label: "Outro" },
];

export default function PublicacoesPage() {
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "nao_lidas">("nao_lidas");

  const load = useCallback(() => {
    setPublicacoes(
      getPublicacoes().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = publicacoes.filter((p) => {
    const matchFilter = filter === "todas" || !p.lida;
    const matchSearch = !search || (p.titulo ?? "").toLowerCase().includes(search.toLowerCase()) || (p.conteudo ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const naoLidas = publicacoes.filter((p) => !p.lida).length;

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicações</h1>
          <p className="text-gray-500 text-sm mt-1">
            {naoLidas > 0 ? <span className="text-blue-600 font-medium">{naoLidas} não {naoLidas > 1 ? "lidas" : "lida"}</span> : "Todas lidas"}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Registrar Publicação
        </Button>
      </div>

      {/* Info box */}
      <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300">
          <p className="font-semibold mb-0.5 text-white">Integração com Diários Oficiais (em desenvolvimento)</p>
          <p>Futuramente esta seção buscará automaticamente publicações com seu número OAB nos principais DJEs estaduais e no DOU federal. Por enquanto, registre manualmente as publicações que encontrar.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar publicações..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["nao_lidas", "todas"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {f === "nao_lidas" ? "Não lidas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <Newspaper className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500">{filter === "nao_lidas" ? "Nenhuma publicação não lida" : "Nenhuma publicação registrada"}</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" /> Registrar publicação
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((pub) => (
            <Card key={pub.id} className={pub.lida ? "opacity-70" : "border-gray-400"}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!pub.lida && <span className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />}
                      <p className="text-sm font-semibold text-gray-900 truncate">{pub.titulo ?? "Publicação sem título"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      {pub.diario && <Badge variant="neutral">{pub.diario}</Badge>}
                      {pub.data_publicacao && <span>{formatDate(pub.data_publicacao)}</span>}
                    </div>
                    {pub.conteudo && (
                      <p className="text-sm text-gray-600 line-clamp-3">{pub.conteudo}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {pub.url && (
                      <a href={pub.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    {!pub.lida && (
                      <Button variant="secondary" size="sm" onClick={() => { marcarPublicacaoLida(pub.id); load(); }}>
                        <Eye className="w-3.5 h-3.5" /> Marcar lida
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegistrarPublicacaoModal open={showModal} onClose={() => setShowModal(false)} onCreated={() => { load(); setShowModal(false); }} />
    </div>
  );
}

function RegistrarPublicacaoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [diario, setDiario] = useState("");
  const [dataPub, setDataPub] = useState(new Date().toISOString().split("T")[0]);
  const [url, setUrl] = useState("");

  useEffect(() => { if (open) setProcessos(getProcessos()); }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    createPublicacao({
      processo_id: processoId || undefined,
      titulo: titulo || undefined,
      conteudo: conteudo || undefined,
      diario: diario || undefined,
      data_publicacao: dataPub || undefined,
      url: url || undefined,
      lida: false,
    });
    setTitulo(""); setConteudo(""); setDiario(""); setDataPub(new Date().toISOString().split("T")[0]); setUrl(""); setProcessoId("");
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar Publicação" size="md">
      <form onSubmit={submit} className="space-y-4">
        <Select label="Processo (opcional)" options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))} placeholder="Selecione se aplicável..." value={processoId} onChange={(e) => setProcessoId(e.target.value)} />
        <Input label="Título / Resumo" placeholder="Ex: Despacho — intimação para audiência" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Diário / Fonte" options={diarioOptions} placeholder="Selecione..." value={diario} onChange={(e) => setDiario(e.target.value)} />
          <Input label="Data de Publicação" type="date" value={dataPub} onChange={(e) => setDataPub(e.target.value)} />
        </div>
        <Textarea label="Conteúdo / Teor" placeholder="Cole aqui o teor da publicação ou intimação..." rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
        <Input label="URL (opcional)" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
}
