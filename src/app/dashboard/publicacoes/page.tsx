"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Newspaper, Plus, Eye, Search, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Settings, CalendarClock, FileText, FolderPlus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPublicacoes, createPublicacao, marcarPublicacaoLida, getProcessos, createPrazo, createProcesso, vincularPublicacoesAoProcesso } from "@/lib/store";
import { parseCNJ } from "@/lib/datajud";
import { getPerfilAdvogado, loadPerfilAdvogado } from "@/lib/perfil";
import { formatDate } from "@/lib/utils";
import type { Publicacao, Processo, PrazoTipo, Prioridade, ProcessoTipo } from "@/types";

const CNJ_REGEX = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;

function extractCNJ(text?: string): string | null {
  if (!text) return null;
  const m = CNJ_REGEX.exec(text);
  return m ? m[0] : null;
}

function onlyDigits(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

function findProcessoIdByCNJ(processos: Processo[], ...texts: (string | undefined)[]): string | undefined {
  for (const text of texts) {
    const cnj = extractCNJ(text);
    if (!cnj) continue;
    const digits = onlyDigits(cnj);
    const match = processos.find((p) => onlyDigits(p.numero) === digits);
    if (match) return match.id;
  }
  return undefined;
}

// Formata os 20 dígitos do CNJ na máscara padrão
function formatCNJ(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 20) return value;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

// Deriva UF a partir do código do tribunal estadual (tjrj -> RJ)
function ufFromTribunal(tribunal: string | null): string {
  if (tribunal && tribunal.startsWith("tj") && tribunal.length === 4) {
    return tribunal.slice(2).toUpperCase();
  }
  return "";
}

const CLASSE_TIPO_MAP: { rx: RegExp; tipo: ProcessoTipo }[] = [
  { rx: /(execu[çc][ãa]o penal|seeu)/i, tipo: "execucao_penal" },
  { rx: /(inqu[ée]rito policial)/i, tipo: "inquerito_policial" },
  { rx: /(boletim de ocorr[êe]ncia|bo pm)/i, tipo: "bo_pm" },
  { rx: /(fam[íi]lia|alimentos|guarda|div[óo]rcio)/i, tipo: "familia" },
  { rx: /(penal|pena|criminal|crime)/i, tipo: "criminal" },
  { rx: /(trabalh|reclama)/i, tipo: "trabalhista" },
  { rx: /(previdenc|benef[ií]cio|aposentad)/i, tipo: "previdenciario" },
  { rx: /(tribut|fiscal|execu[çc][ãa]o fiscal)/i, tipo: "tributario" },
];

function tipoFromClasse(classe?: string): ProcessoTipo {
  if (!classe) return "civel";
  for (const { rx, tipo } of CLASSE_TIPO_MAP) {
    if (rx.test(classe)) return tipo;
  }
  return "civel";
}

interface DadosProcessoDjen {
  numero: string;
  tribunal: string;
  uf: string;
  classe: string;
  orgao: string;
  tipo: ProcessoTipo;
  polosA: string[];
  polosP: string[];
}

// Busca dados do processo no DJEN/CNJ (pelo número) para preencher o cadastro
async function buscarDadosProcessoDjen(numeroCNJ: string): Promise<DadosProcessoDjen> {
  const digits = onlyDigits(numeroCNJ);
  const numeroFmt = formatCNJ(numeroCNJ);
  const { tribunal } = parseCNJ(numeroFmt);

  const base: DadosProcessoDjen = {
    numero: numeroFmt,
    tribunal: tribunal ? tribunal.toUpperCase() : "",
    uf: ufFromTribunal(tribunal),
    classe: "",
    orgao: "",
    tipo: "civel",
    polosA: [],
    polosP: [],
  };

  try {
    const params = new URLSearchParams({ numeroProcesso: digits, itensPorPagina: "5" });
    const res = await fetch(`${DIRECT_DJEN_API_URL}/comunicacao?${params.toString()}`);
    if (!res.ok) return base;
    const data = (await res.json()) as DjenResponse;
    const item = (data.items ?? [])[0];
    if (!item) return base;

    const destinatarios = item.destinatarios ?? [];
    const polosA = destinatarios.filter((d) => d.polo === "A").map((d) => d.nome ?? "").filter(Boolean);
    const polosP = destinatarios.filter((d) => d.polo === "P").map((d) => d.nome ?? "").filter(Boolean);

    return {
      ...base,
      tribunal: item.siglaTribunal ?? base.tribunal,
      classe: item.nomeClasse ?? "",
      orgao: item.nomeOrgao ?? "",
      tipo: tipoFromClasse(item.nomeClasse),
      polosA,
      polosP,
    };
  } catch {
    return base;
  }
}

const ULTIMA_BUSCA_KEY = "justio_ultima_busca_pub";
const HASHES_KEY = "justio_pub_hashes";
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

interface PublicacoesSyncStatus {
  last_run_at?: string | null;
  last_success_at?: string | null;
  last_found?: number | null;
  last_imported?: number | null;
  last_errors?: string[] | null;
}

interface PublicacoesStatusResponse {
  status?: PublicacoesSyncStatus | null;
}

type DjenAdvogado = {
  advogado?: {
    nome?: string;
    numero_oab?: string;
    uf_oab?: string;
  };
};

type DjenDestinatario = {
  polo?: string;
  nome?: string;
};

type DjenComunicacao = {
  id?: number;
  hash?: string;
  data_disponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  link?: string;
  tipoDocumento?: string;
  nomeClasse?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  meiocompleto?: string;
  destinatarios?: DjenDestinatario[];
  destinatarioadvogados?: DjenAdvogado[];
};

type DjenResponse = {
  count?: number;
  items?: DjenComunicacao[];
};

const DIRECT_DJEN_SEARCH_DAYS = 45;
const DIRECT_DJEN_API_URL = "https://comunicaapi.pje.jus.br/api/v1";

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

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function publicacaoKey(pub: Pick<Publicacao, "titulo" | "conteudo" | "data_publicacao" | "diario" | "url"> | PubEncontrada): string {
  return simpleHash([
    pub.diario ?? "",
    pub.data_publicacao ?? "",
    pub.titulo ?? "",
    (pub.conteudo ?? "").slice(0, 1000),
    pub.url ?? "",
  ].join("|"));
}

function publicacaoLooseKey(pub: Pick<Publicacao, "titulo" | "data_publicacao" | "diario"> | PubEncontrada): string {
  return simpleHash([
    pub.diario ?? "",
    pub.data_publicacao ?? "",
    pub.titulo ?? "",
  ].join("|"));
}

function newestIso(...values: (string | null | undefined)[]): string {
  let newest = "";
  let newestTime = 0;

  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) continue;
    if (time > newestTime) {
      newest = value;
      newestTime = time;
    }
  }

  return newest;
}

function mapDjenItem(item: DjenComunicacao): PubEncontrada {
  const dataDisponibilizacao = item.data_disponibilizacao ?? "";
  const processo = item.numeroprocessocommascara ?? item.numero_processo ?? "";
  const orgao = item.nomeOrgao ?? item.siglaTribunal ?? "DJEN";
  const tipo = item.tipoComunicacao ?? item.tipoDocumento ?? "Publicacao";
  const classe = item.nomeClasse ?? "";
  const advogados = (item.destinatarioadvogados ?? [])
    .map((a) => {
      const adv = a.advogado;
      if (!adv?.nome) return "";
      const oab = adv.numero_oab && adv.uf_oab ? ` - OAB/${adv.uf_oab} ${adv.numero_oab}` : "";
      return `${adv.nome}${oab}`;
    })
    .filter(Boolean);

  const teor = item.texto ? item.texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

  const metaParts = [
    orgao,
    classe ? `Classe: ${classe}` : "",
    advogados.length ? `Adv.: ${advogados.join("; ")}` : "",
  ].filter(Boolean);
  const meta = metaParts.length ? `\n\n— ${metaParts.join(" · ")}` : "";

  const conteudo = (teor || metaParts.join(" · ")) + (teor ? meta : "");
  const hash = item.hash ?? String(item.id ?? simpleHash(`${dataDisponibilizacao}|${processo}|${teor}`));

  return {
    titulo: `${tipo}${processo ? ` · ${processo}` : ""}`,
    conteudo: conteudo.trim(),
    data_publicacao: dataDisponibilizacao || formatDateISO(new Date()),
    diario: item.meiocompleto ?? "Diario de Justica Eletronico Nacional",
    url: item.link || undefined,
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
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [selected, setSelected] = useState<Publicacao | null>(null);
  const [prazoSeed, setPrazoSeed] = useState<Publicacao | null>(null);
  const [addProcSeed, setAddProcSeed] = useState<Publicacao | null>(null);
  const autoSearched = useRef(false);

  const load = useCallback(async () => {
    try {
      const [todas, procs] = await Promise.all([getPublicacoes(), getProcessos()]);
      setPublicacoes(todas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setProcessos(procs);
    } catch { /* silently fail */ }

    try {
      const localUltima = localStorage.getItem(ULTIMA_BUSCA_KEY) ?? "";
      let cloudUltima = "";

      try {
        const res = await fetch("/api/publicacoes/status", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as PublicacoesStatusResponse;
          cloudUltima = data.status?.last_success_at ?? data.status?.last_run_at ?? "";
        }
      } catch {
        /* status remoto opcional */
      }

      const ultima = newestIso(localUltima, cloudUltima);
      setUltimaBusca(ultima);
      if (ultima && ultima !== localUltima) {
        localStorage.setItem(ULTIMA_BUSCA_KEY, ultima);
      }
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    load();

    setPerfil(getPerfilAdvogado());
    loadPerfilAdvogado()
      .then((perfilCloud) => setPerfil(perfilCloud))
      .catch(() => {
        /* perfil local ja foi carregado */
      });
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

  async function importarResultadosNoCliente(resultados: PubEncontrada[]): Promise<number> {
    if (resultados.length === 0) return 0;

    let hashesSet: Set<string>;
    try {
      hashesSet = new Set(JSON.parse(localStorage.getItem(HASHES_KEY) ?? "[]") as string[]);
    } catch {
      hashesSet = new Set();
    }

    const knownKeys = new Set(publicacoes.map((p) => publicacaoKey(p)));
    const knownLooseKeys = new Set(publicacoes.map((p) => publicacaoLooseKey(p)));
    const novas: PubEncontrada[] = [];

    for (const pub of resultados) {
      const key = publicacaoKey(pub);
      const looseKey = publicacaoLooseKey(pub);
      if (knownKeys.has(key) || knownLooseKeys.has(looseKey) || hashesSet.has(pub.hash)) continue;
      knownKeys.add(key);
      knownLooseKeys.add(looseKey);
      hashesSet.add(pub.hash);
      novas.push(pub);
    }

    for (const p of novas) {
      const processoId = findProcessoIdByCNJ(processos, p.titulo, p.conteudo);
      await createPublicacao({
        processo_id: processoId,
        titulo: p.titulo,
        conteudo: p.conteudo,
        data_publicacao: p.data_publicacao,
        diario: p.diario,
        url: p.url || undefined,
        lida: false,
      });
    }

    try {
      localStorage.setItem(HASHES_KEY, JSON.stringify([...hashesSet]));
    } catch { /* silently fail */ }

    return novas.length;
  }

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

      const data = await res.json() as {
        resultados?: PubEncontrada[];
        erros?: string[];
        buscadoEm?: string;
        saved?: boolean;
        imported?: number;
        total?: number;
      };
      let resultados = data.resultados ?? [];
      let erros = data.erros ?? [];
      const agora = data.buscadoEm ?? new Date().toISOString();

      if (data.saved) {
        const hasDjenServerError = erros.some((e) => e.startsWith("DJEN/CNJ"));
        let imported = data.imported ?? 0;

        if (hasDjenServerError && (perfil.oab_numero || perfil.nome)) {
          try {
            const diretas = await buscarDjenDireto(perfil);
            const saveRes = await fetch("/api/publicacoes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resultados: diretas, buscadoEm: agora }),
            });
            const saveData = await saveRes.json() as { imported?: number; error?: string };
            if (!saveRes.ok) throw new Error(saveData.error ?? "Nao foi possivel salvar DJEN/CNJ direto.");
            const importedDireto = saveData.imported ?? 0;
            imported += importedDireto;
            if (diretas.length > 0) {
              erros = erros.filter((e) => !e.startsWith("DJEN/CNJ"));
            }
          } catch (err) {
            erros = [...erros, err instanceof Error ? err.message : "DJEN/CNJ direto: erro desconhecido"];
          }
        }

        localStorage.setItem(ULTIMA_BUSCA_KEY, agora);
        setUltimaBusca(agora);
        await load();

        if (imported > 0) {
          setStatusTipo("ok");
          setStatusMsg(`${imported} nova${imported > 1 ? "s" : ""} publicaÃ§Ã£o${imported > 1 ? "Ãµes" : ""} importada${imported > 1 ? "s" : ""}!`);
        } else if (erros.length > 0) {
          setStatusTipo("erro");
          setStatusMsg(`Erros: ${erros.join(" | ")}`);
        } else {
          setStatusTipo("info");
          setStatusMsg("Nenhuma publicaÃ§Ã£o nova encontrada no perÃ­odo recente.");
        }
        return;
      }

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

      localStorage.setItem(ULTIMA_BUSCA_KEY, agora);
      setUltimaBusca(agora);

      const novasCount = await importarResultadosNoCliente(resultados);

      await load();

      if (novasCount > 0) {
        setStatusTipo("ok");
        setStatusMsg(`${novasCount} nova${novasCount > 1 ? "s" : ""} publicação${novasCount > 1 ? "ões" : ""} importada${novasCount > 1 ? "s" : ""}!`);
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
              <> · busca diária às 8h</>
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
          {filtered.map((pub) => {
            const proc = processos.find((p) => p.id === pub.processo_id)
              ?? processos.find((p) => onlyDigits(p.numero) === onlyDigits(extractCNJ(pub.titulo) ?? extractCNJ(pub.conteudo) ?? ""));
            const cnj = extractCNJ(pub.titulo) ?? extractCNJ(pub.conteudo);
            const teorUrl = pub.url && !pub.url.includes("/certidao") ? pub.url : undefined;
            return (
            <Card key={pub.id} className={pub.lida ? "opacity-60" : ""}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelected(pub)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!pub.lida && <span className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />}
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {pub.titulo ?? "Publicação sem título"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 flex-wrap">
                      {pub.diario && <Badge variant="neutral">{pub.diario}</Badge>}
                      {pub.data_publicacao && <span>{formatDate(pub.data_publicacao)}</span>}
                      {proc && (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <FileText className="w-3 h-3" /> {proc.cliente_nome}
                        </span>
                      )}
                    </div>
                    {pub.conteudo && (
                      <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-line">{pub.conteudo}</p>
                    )}
                    <span className="text-xs text-gray-400 mt-1 inline-block">Ler publicação completa →</span>
                  </button>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => setPrazoSeed(pub)}>
                      <CalendarClock className="w-3.5 h-3.5" /> Prazo
                    </Button>
                    {!proc && cnj && (
                      <Button variant="secondary" size="sm" onClick={() => setAddProcSeed(pub)}>
                        <FolderPlus className="w-3.5 h-3.5" /> Processo
                      </Button>
                    )}
                    {teorUrl && (
                      <a href={teorUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="w-full">
                          <ExternalLink className="w-3.5 h-3.5" /> Inteiro teor
                        </Button>
                      </a>
                    )}
                    {!pub.lida && (
                      <Button variant="ghost" size="sm" onClick={async () => { await marcarPublicacaoLida(pub.id); load(); }}>
                        <Eye className="w-3.5 h-3.5" /> Lida
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <RegistrarModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => { load(); setShowModal(false); }}
      />

      <DetalheModal
        publicacao={selected}
        processos={processos}
        onClose={() => setSelected(null)}
        onMarcarLida={async (id) => { await marcarPublicacaoLida(id); load(); setSelected(null); }}
        onCriarPrazo={(pub) => { setSelected(null); setPrazoSeed(pub); }}
        onAdicionarProcesso={(pub) => { setSelected(null); setAddProcSeed(pub); }}
      />

      <PrazoModal
        publicacao={prazoSeed}
        processos={processos}
        onClose={() => setPrazoSeed(null)}
        onCreated={() => { setPrazoSeed(null); setStatusTipo("ok"); setStatusMsg("Prazo criado com sucesso!"); }}
      />

      <AdicionarProcessoModal
        publicacao={addProcSeed}
        onClose={() => setAddProcSeed(null)}
        onCreated={(nome) => { setAddProcSeed(null); load(); setStatusTipo("ok"); setStatusMsg(`Processo de ${nome} adicionado!`); }}
      />
    </div>
  );
}

function DetalheModal({
  publicacao,
  processos,
  onClose,
  onMarcarLida,
  onCriarPrazo,
  onAdicionarProcesso,
}: {
  publicacao: Publicacao | null;
  processos: Processo[];
  onClose: () => void;
  onMarcarLida: (id: string) => void;
  onCriarPrazo: (pub: Publicacao) => void;
  onAdicionarProcesso: (pub: Publicacao) => void;
}) {
  if (!publicacao) return null;
  const cnj = extractCNJ(publicacao.titulo) ?? extractCNJ(publicacao.conteudo);
  const proc = processos.find((p) => p.id === publicacao.processo_id)
    ?? processos.find((p) => onlyDigits(p.numero) === onlyDigits(cnj ?? ""));

  return (
    <Modal open={!!publicacao} onClose={onClose} title="Publicação" size="lg">
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-gray-900">{publicacao.titulo ?? "Publicação"}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5 flex-wrap">
            {publicacao.diario && <Badge variant="neutral">{publicacao.diario}</Badge>}
            {publicacao.data_publicacao && <span>{formatDate(publicacao.data_publicacao)}</span>}
            {proc ? (
              <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                <FileText className="w-3 h-3" /> {proc.numero} — {proc.cliente_nome}
              </span>
            ) : cnj ? (
              <span className="text-amber-600">Processo não cadastrado</span>
            ) : null}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 max-h-[50vh] overflow-y-auto">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {publicacao.conteudo || "Sem teor disponível."}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {publicacao.url && !publicacao.url.includes("/certidao") && (
            <a href={publicacao.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" /> Inteiro teor
              </Button>
            </a>
          )}
          {!publicacao.lida && (
            <Button variant="ghost" size="sm" onClick={() => onMarcarLida(publicacao.id)}>
              <Eye className="w-4 h-4" /> Marcar como lida
            </Button>
          )}
          {!proc && cnj && (
            <Button variant="secondary" size="sm" onClick={() => onAdicionarProcesso(publicacao)}>
              <FolderPlus className="w-4 h-4" /> Adicionar processo
            </Button>
          )}
          <Button size="sm" onClick={() => onCriarPrazo(publicacao)}>
            <CalendarClock className="w-4 h-4" /> Criar prazo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const prazoTipoOptions: { value: PrazoTipo; label: string }[] = [
  { value: "recurso", label: "Recurso" },
  { value: "contestacao", label: "Contestação" },
  { value: "peticao", label: "Petição" },
  { value: "contrarrazoes", label: "Contrarrazões" },
  { value: "outro", label: "Outro" },
];

const prioridadeOptions: { value: Prioridade; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

function PrazoModal({
  publicacao,
  processos,
  onClose,
  onCreated,
}: {
  publicacao: Publicacao | null;
  processos: Processo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [processoId, setProcessoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataPrazo, setDataPrazo] = useState("");
  const [tipo, setTipo] = useState<PrazoTipo>("outro");
  const [prioridade, setPrioridade] = useState<Prioridade>("alta");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!publicacao) return;
    const matchId = findProcessoIdByCNJ(processos, publicacao.titulo, publicacao.conteudo) ?? publicacao.processo_id ?? "";
    setProcessoId(matchId);
    setTitulo(publicacao.titulo ?? "Prazo da publicação");
    setDataPrazo("");
    setTipo("outro");
    setPrioridade("alta");
  }, [publicacao, processos]);

  if (!publicacao) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!processoId || !dataPrazo) return;
    setSaving(true);
    try {
      await createPrazo({
        processo_id: processoId,
        titulo: titulo || "Prazo da publicação",
        descricao: publicacao!.conteudo?.slice(0, 500),
        data_prazo: dataPrazo,
        concluido: false,
        tipo,
        prioridade,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!publicacao} onClose={onClose} title="Criar prazo da publicação" size="md">
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Processo *"
          options={processos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.cliente_nome}` }))}
          placeholder="Selecione o processo..."
          value={processoId}
          onChange={(e) => setProcessoId(e.target.value)}
        />
        {!processoId && (
          <p className="text-xs text-amber-600 -mt-2">
            Nenhum processo vinculado automaticamente. Selecione o processo para salvar o prazo.
          </p>
        )}
        <Input label="Título do prazo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Data do prazo *" type="date" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} />
          <Select label="Prioridade" options={prioridadeOptions} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)} />
        </div>
        <Select label="Tipo" options={prazoTipoOptions} value={tipo} onChange={(e) => setTipo(e.target.value as PrazoTipo)} />
        <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-1 font-medium">Teor da publicação:</p>
          <p className="text-xs text-gray-600 whitespace-pre-line">{publicacao.conteudo?.slice(0, 400)}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!processoId || !dataPrazo || saving}>
            {saving ? "Salvando..." : "Salvar prazo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const processoTipoOptions: { value: ProcessoTipo; label: string }[] = [
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "criminal", label: "Criminal" },
  { value: "execucao_penal", label: "Execução penal" },
  { value: "inquerito_policial", label: "Inquérito policial" },
  { value: "bo_pm", label: "BO PM" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "federal", label: "Federal" },
  { value: "outro", label: "Outro" },
];

function AdicionarProcessoModal({
  publicacao,
  onClose,
  onCreated,
}: {
  publicacao: Publicacao | null;
  onClose: () => void;
  onCreated: (clienteNome: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [uf, setUf] = useState("");
  const [comarca, setComarca] = useState("");
  const [tipo, setTipo] = useState<ProcessoTipo>("civel");
  const [clienteNome, setClienteNome] = useState("");
  const [parteContraria, setParteContraria] = useState("");
  const [partesInfo, setPartesInfo] = useState("");

  useEffect(() => {
    if (!publicacao) return;
    const cnj = extractCNJ(publicacao.titulo) ?? extractCNJ(publicacao.conteudo);
    if (!cnj) return;

    setLoading(true);
    setNumero(formatCNJ(cnj));
    setTitulo("");
    setTribunal("");
    setUf("");
    setComarca("");
    setTipo("civel");
    setClienteNome("");
    setParteContraria("");
    setPartesInfo("");

    buscarDadosProcessoDjen(cnj)
      .then((dados) => {
        setNumero(dados.numero);
        setTribunal(dados.tribunal);
        setUf(dados.uf);
        setComarca(dados.orgao);
        setTipo(dados.tipo);
        setTitulo(dados.classe || "Processo");
        // Sugestão: polo ativo (autor) como cliente, polo passivo como parte contrária
        setClienteNome(dados.polosA.join(", "));
        setParteContraria(dados.polosP.join(", "));
        if (dados.polosA.length || dados.polosP.length) {
          setPartesInfo(
            `Polo ativo: ${dados.polosA.join("; ") || "—"} · Polo passivo: ${dados.polosP.join("; ") || "—"}`
          );
        }
      })
      .finally(() => setLoading(false));
  }, [publicacao]);

  if (!publicacao) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero || !clienteNome.trim()) return;
    setSaving(true);
    try {
      const novo = await createProcesso({
        numero,
        titulo: titulo || "Processo",
        status: "ativo",
        tribunal: tribunal || undefined,
        comarca: comarca || undefined,
        uf: uf || undefined,
        tipo,
        cliente_nome: clienteNome.trim(),
        parte_contraria: parteContraria.trim() || undefined,
        monitorar_datajud: true,
      });
      await vincularPublicacoesAoProcesso(novo.id, numero);
      onCreated(clienteNome.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!publicacao} onClose={onClose} title="Adicionar processo ao Justio" size="md">
      <form onSubmit={submit} className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Carregando dados do processo no DJEN/CNJ...
          </div>
        )}
        <Input label="Número do processo *" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <Input label="Título / Classe" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Tribunal" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
          <Select label="Tipo" options={processoTipoOptions} value={tipo} onChange={(e) => setTipo(e.target.value as ProcessoTipo)} />
        </div>
        <Input label="Órgão / Comarca / Vara" value={comarca} onChange={(e) => setComarca(e.target.value)} />
        {partesInfo && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{partesInfo}</p>
        )}
        <Input label="Cliente (parte que você representa) *" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Confirme qual parte é seu cliente" />
        <Input label="Parte contrária" value={parteContraria} onChange={(e) => setParteContraria(e.target.value)} />
        <p className="text-xs text-gray-400">
          Os dados foram preenchidos automaticamente pelo DJEN/CNJ. Confira o cliente e a parte contrária — em processos em segredo de justiça os nomes podem não aparecer.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!numero || !clienteNome.trim() || saving || loading}>
            {saving ? "Salvando..." : "Adicionar processo"}
          </Button>
        </div>
      </form>
    </Modal>
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
