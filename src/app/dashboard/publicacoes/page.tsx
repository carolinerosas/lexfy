"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Newspaper, Plus, Eye, Search, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPublicacoes, createPublicacao, marcarPublicacaoLida, getProcessos } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Publicacao, Processo } from "@/types";

const ULTIMA_BUSCA_KEY = "justio_ultima_busca_pub";
const HASHES_KEY = "justio_pub_hashes";
const PERFIL_KEY = "justio_perfil_advogado";

const diarioOptions = [
  { value: "DOU", label: "Diário Oficial da União (DOU)" },
  { value: "Diario de Justica Eletronico Nacional", label: "DJEN/CNJ" },
  { value: "DJE/TJERJ", label: "DJE/TJERJ — Rio de Janeiro" },
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

interface PubEncontrada {
  titulo: string;
  conteudo?: string;
  data_publicacao: string;
  diario: string;
  url?: string;
  hash: string;
}

interface Perfil {
  nome?: string;
  oab_numero?: string;
  oab_uf?: string;
}

type DjenAdvogado = {
  advogado?: {
    nome?: string;
    numero_oab?: string;
    uf_oab?: string;
  };
};

type DjenComunicacao = {
  id?: number;
  hash?: string;
  data_disponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  tipoDocumento?: string;
  nomeClasse?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  meiocompleto?: string;
  destinatarioadvogados?: DjenAdvogado[];
};

type DjenResponse = {
  count?: number;
  items?: DjenComunicacao[];
};

const DIRECT_DJEN_SEARCH_DAYS = 45;
const DIRECT_DJEN_API_URL = "https://comunicaapi.pje.jus.br/api/v1";
const DIRECT_DJEN_WEB_URL = "https://comunica.pje.jus.br/consulta";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateISO(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateBRFromISO(dateISO: string): string {
  const [yyyy, mm, dd] = dateISO.split("-");
  if (!yyyy || !mm || !dd) return dateISO;
  return `${dd}/${mm}/${yyyy}`;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function mapDjenItem(item: DjenComunicacao): PubEncontrada {
  const dataDisponibilizacao = item.data_disponibilizacao ?? "";
  const processo = item.numeroprocessocommascara ?? item.numero_processo ?? "";
  const orgao = item.nomeOrgao ?? item.siglaTribunal ?? "DJEN";
  const tipo = item.tipoComunicacao ?? item.tipoDocumento ?? "Publicacao";
  const classe = item.nomeClasse ? `Classe: ${item.nomeClasse}. ` : "";
  const dataBR = dataDisponibilizacao ? `Disponibilizacao: ${formatDateBRFromISO(dataDisponibilizacao)}. ` : "";
  const advogados = (item.destinatarioadvogados ?? [])
    .map((a) => {
      const adv = a.advogado;
      if (!adv?.nome) return "";
      const oab = adv.numero_oab && adv.uf_oab ? ` - OAB/${adv.uf_oab} ${adv.numero_oab}` : "";
      return `${adv.nome}${oab}`;
    })
    .filter(Boolean);
  const advogadosText = advogados.length ? `Advogado(s): ${advogados.join("; ")}. ` : "";
  const teor = item.texto ? `Teor: ${item.texto.replace(/\s+/g, " ").trim()}` : "";
  const hash = item.hash ?? String(item.id ?? simpleHash(`${dataDisponibilizacao}|${processo}|${teor}`));

  return {
    titulo: `${tipo}${processo ? ` - processo ${processo}` : ""}`,
    conteudo: `${dataBR}${orgao}. ${classe}${advogadosText}${teor}`.trim(),
    data_publicacao: dataDisponibilizacao || formatDateISO(new Date()),
    diario: item.meiocompleto ?? "Diario de Justica Eletronico Nacional",
    url: item.hash ? `${DIRECT_DJEN_WEB_URL}/comunicacao/${item.hash}/certidao` : undefined,
    hash: `djen-${hash}`,
  };
}

async function buscarDjenDireto(perfil: Perfil): Promise<PubEncontrada[]> {
  const hoje = new Date();
  const inicio = addDays(hoje, -(DIRECT_DJEN_SEARCH_DAYS - 1));
  const numero = perfil.oab_numero?.replace(/\D/g, "");
  const uf = (perfil.oab_uf ?? "RJ").trim().toUpperCase() || "RJ";
  const filtros: URLSearchParams[] = [];

  if (numero) {
    filtros.push(new URLSearchParams({ numeroOab: numero, ufOab: uf }));
  }

  if (perfil.nome?.trim()) {
    filtros.push(new URLSearchParams({ nomeAdvogado: perfil.nome.trim() }));
  }

  const porHash = new Map<string, PubEncontrada>();

  for (const filtro of filtros) {
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const params = new URLSearchParams({
        pagina: String(pagina),
        itensPorPagina: "100",
        dataDisponibilizacaoInicio: formatDateISO(inicio),
        dataDisponibilizacaoFim: formatDateISO(hoje),
        ...Object.fromEntries(filtro.entries()),
      });
      const res = await fetch(`${DIRECT_DJEN_API_URL}/comunicacao?${params.toString()}`);
      if (!res.ok) throw new Error(`DJEN/CNJ direto: HTTP ${res.status}`);

      const data = (await res.json()) as DjenResponse;
      const items = data.items ?? [];
      totalPaginas = Math.max(1, Math.ceil((data.count ?? items.length) / 100));

      for (const item of items) {
        const pub = mapDjenItem(item);
        if (!porHash.has(pub.hash)) porHash.set(pub.hash, pub);
      }

      pagina += 1;
    } while (pagina <= totalPaginas && pagina <= 10);
  }

  return [...porHash.values()];
}

export default function PublicacoesPage() {
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "nao_lidas">("nao_lidas");
  const [buscando, setBuscando] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusTipo, setStatusTipo] = useState<"ok" | "erro" | "info" | "">("");
  const [ultimaBusca, setUltimaBusca] = useState("");
  const [perfil, setPerfil] = useState<Perfil>({});
  const autoSearched = useRef(false);

  const load = useCallback(async () => {
    try {
      const todas = await getPublicacoes();
      setPublicacoes(todas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch { /* silently fail */ }

    try {
      setUltimaBusca(localStorage.getItem(ULTIMA_BUSCA_KEY) ?? "");
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    load();

    try {
      const raw = localStorage.getItem(PERFIL_KEY);
      if (raw) setPerfil(JSON.parse(raw) as Perfil);
    } catch { /* silently fail */ }
  }, [load]);

  useEffect(() => {
    if (autoSearched.current) return;
    if (!perfil.nome) return;
    autoSearched.current = true;

    try {
      const ultima = localStorage.getItem(ULTIMA_BUSCA_KEY);
      if (ultima) {
        const diff = Date.now() - new Date(ultima).getTime();
        if (diff < 23 * 60 * 60 * 1000) return;
      }
      buscarAgora();
    } catch { /* silently fail */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.nome]);

  async function buscarAgora() {
    if (!perfil.nome) {
      setStatusTipo("erro");
      setStatusMsg("Configure seu nome e OAB em Configurações antes de buscar.");
      return;
    }

    setBuscando(true);
    setStatusTipo("");
    setStatusMsg("");

    try {
      const res = await fetch("/api/publicacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: perfil.nome,
          oabNumero: perfil.oab_numero ?? "",
          oabUF: perfil.oab_uf ?? "RJ",
        }),
      });

      const data = await res.json() as { resultados?: PubEncontrada[]; erros?: string[]; buscadoEm?: string };
      let resultados = data.resultados ?? [];
      let erros = data.erros ?? [];

      if (!resultados.some((p) => p.hash?.startsWith("djen-")) && (perfil.oab_numero || perfil.nome)) {
        try {
          const diretas = await buscarDjenDireto(perfil);
          const porHash = new Map(resultados.map((p) => [p.hash, p]));
          for (const pub of diretas) {
            if (!porHash.has(pub.hash)) porHash.set(pub.hash, pub);
          }
          resultados = [...porHash.values()];
          if (diretas.length > 0) erros = erros.filter((e) => !e.startsWith("DJEN/CNJ:"));
        } catch (err) {
          erros = [...erros, err instanceof Error ? err.message : "DJEN/CNJ direto: erro desconhecido"];
        }
      }

      const agora = data.buscadoEm ?? new Date().toISOString();
      localStorage.setItem(ULTIMA_BUSCA_KEY, agora);
      setUltimaBusca(agora);

      let hashesSet: Set<string>;
      try {
        hashesSet = new Set(JSON.parse(localStorage.getItem(HASHES_KEY) ?? "[]") as string[]);
      } catch {
        hashesSet = new Set();
      }

      const novas = resultados.filter((p) => !hashesSet.has(p.hash));

      for (const p of novas) {
        await createPublicacao({
          titulo: p.titulo,
          conteudo: p.conteudo,
          data_publicacao: p.data_publicacao,
          diario: p.diario,
          url: p.url || undefined,
          lida: false,
        });
        hashesSet.add(p.hash);
      }

      try {
        localStorage.setItem(HASHES_KEY, JSON.stringify([...hashesSet]));
      } catch { /* silently fail */ }

      load();

      if (novas.length > 0) {
        setStatusTipo("ok");
        setStatusMsg(`${novas.length} nova${novas.length > 1 ? "s" : ""} publicação${novas.length > 1 ? "ões" : ""} importada${novas.length > 1 ? "s" : ""}!`);
      } else if (erros.length > 0) {
        setStatusTipo("erro");
        setStatusMsg(`Erros: ${erros.join(" | ")}`);
      } else {
        setStatusTipo("info");
        setStatusMsg("Nenhuma publicação nova encontrada no período recente.");
      }
    } catch (err) {
      setStatusTipo("erro");
      setStatusMsg(`Falha: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setBuscando(false);
    }
  }

  const filtered = publicacoes.filter((p) => {
    if (filter === "nao_lidas" && p.lida) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.titulo ?? "").toLowerCase().includes(s) || (p.conteudo ?? "").toLowerCase().includes(s);
  });

  const naoLidas = publicacoes.filter((p) => !p.lida).length;
  const temPerfil = !!perfil.nome;

  const ultimaBuscaLabel = ultimaBusca
    ? new Date(ultimaBusca).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicações</h1>
          <p className="text-gray-500 text-sm mt-1">
            {naoLidas > 0
              ? <span className="text-blue-600 font-medium">{naoLidas} não {naoLidas > 1 ? "lidas" : "lida"}</span>
              : "Todas lidas"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" onClick={buscarAgora} disabled={buscando}>
            <RefreshCw className={`w-4 h-4 ${buscando ? "animate-spin" : ""}`} />
            {buscando ? "Buscando..." : "Buscar agora"}
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        </div>
      </div>

      {!temPerfil ? (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 mb-0.5">Configure seu perfil para busca automática</p>
            <p className="text-amber-700">
              Acesse{" "}
              <Link href="/dashboard/configuracoes" className="underline font-medium">Configurações</Link>
              {" "}e preencha seu nome e OAB para buscar publicações automaticamente no DOU, DJEN/CNJ e DJE-TJERJ.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 items-center">
          <RefreshCw className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-white">Busca automática ativa</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {perfil.nome} · OAB/{perfil.oab_uf ?? "RJ"} {perfil.oab_numero}
              {ultimaBuscaLabel && <> · última busca: {ultimaBuscaLabel}</>}
            </p>
          </div>
          <Link href="/dashboard/configuracoes" className="text-gray-500 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      )}

      {statusMsg && (
        <div className={`mb-4 flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-3 border ${
          statusTipo === "ok" ? "bg-green-50 text-green-700 border-green-200" :
          statusTipo === "erro" ? "bg-red-50 text-red-600 border-red-200" :
          "bg-gray-50 text-gray-600 border-gray-200"
        }`}>
          {statusTipo === "ok" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {statusTipo === "erro" && <AlertCircle className="w-4 h-4 shrink-0" />}
          {statusMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar publicações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["nao_lidas", "todas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "nao_lidas" ? "Não lidas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Newspaper className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {filter === "nao_lidas" ? "Nenhuma publicação não lida" : "Nenhuma publicação registrada"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((pub) => (
            <Card key={pub.id} className={pub.lida ? "opacity-60" : ""}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!pub.lida && <span className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />}
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {pub.titulo ?? "Publicação sem título"}
                      </p>
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
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    {!pub.lida && (
                      <Button variant="secondary" size="sm" onClick={async () => { await marcarPublicacaoLida(pub.id); load(); }}>
                        <Eye className="w-3.5 h-3.5" /> Lida
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegistrarModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { load(); setShowModal(false); }}
      />
    </div>
  );
}

function RegistrarModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [diario, setDiario] = useState("");
  const [dataPub, setDataPub] = useState(new Date().toISOString().split("T")[0]);
  const [url, setUrl] = useState("");

  useEffect(() => { if (open) getProcessos().then(setProcessos); }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await createPublicacao({
      processo_id: processoId || undefined,
      titulo: titulo || undefined,
      conteudo: conteudo || undefined,
      diario: diario || undefined,
      data_publicacao: dataPub || undefined,
      url: url || undefined,
      lida: false,
    });
    setTitulo(""); setConteudo(""); setDiario(""); setUrl(""); setProcessoId("");
    setDataPub(new Date().toISOString().split("T")[0]);
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
        <Textarea label="Conteúdo / Teor" placeholder="Cole aqui o teor da publicação..." rows={4} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
        <Input label="URL (opcional)" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
