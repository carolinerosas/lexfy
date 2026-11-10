"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Archive, LogOut, BarChart3, BriefcaseBusiness, Calculator, CalendarDays, Clock, FileSignature, FileText, Gavel, Inbox, LayoutGrid,
  ListChecks, Menu, Newspaper, Plus, Scale, Search, Settings, Sparkles, Sun, UserRound, Users, Wallet, X, type LucideIcon,
} from "lucide-react";
import { alterarConfig, recarregar, useDB, useSituacao } from "@/novo/lib/store";
import { AtivarNotificacoes } from "@/components/layout/ativar-notificacoes";
import type { Perfil } from "@/novo/lib/types";
import { diasAte, semAcento } from "@/novo/lib/format";
import { NovoCaso } from "./novo-caso";

type Item = { href: string; rotulo: string; icone: LucideIcon; selo?: "prazos" | "publicacoes" | "andamentos" | "captacao" };
const GRUPOS: { nome: string; itens: Item[] }[] = [
  { nome: "Dia a dia", itens: [
    { href: "/", rotulo: "Hoje", icone: Sun },
    { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
    { href: "/prazos", rotulo: "Prazos", icone: Clock, selo: "prazos" },
    { href: "/audiencias", rotulo: "Audiências", icone: Gavel },
    { href: "/tarefas", rotulo: "Tarefas", icone: ListChecks },
  ] },
  { nome: "Casos", itens: [
    { href: "/processos", rotulo: "Processos", icone: Scale },
    { href: "/extrajudicial", rotulo: "Extrajudicial", icone: FileSignature },
    { href: "/areas", rotulo: "Áreas de atuação", icone: LayoutGrid },
    { href: "/clientes", rotulo: "Clientes", icone: UserRound },
    { href: "/atendimentos", rotulo: "Atendimentos", icone: BriefcaseBusiness },
    { href: "/captacao", rotulo: "Captação", icone: Inbox, selo: "captacao" },
    { href: "/importar", rotulo: "Triagem com IA", icone: Sparkles },
  ] },
  { nome: "Acompanhamento", itens: [
    { href: "/publicacoes", rotulo: "Publicações", icone: Newspaper, selo: "publicacoes" },
    { href: "/andamentos", rotulo: "Andamentos", icone: Activity, selo: "andamentos" },
  ] },
  { nome: "Escritório", itens: [
    { href: "/documentos", rotulo: "Documentos", icone: FileText },
    { href: "/financeiro", rotulo: "Financeiro", icone: Wallet },
    { href: "/pessoas", rotulo: "Pessoas", icone: Users },
    { href: "/gestao", rotulo: "Gestão", icone: BarChart3 },
    { href: "/ferramentas", rotulo: "Calculadoras", icone: Calculator },
  ] },
];
const RODAPE: Item[] = [
  { href: "/novidades", rotulo: "O que mudou", icone: Sparkles },
  { href: "/antigo", rotulo: "Justio antigo", icone: Archive },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

// O que cada perfil não enxerga no menu. No teste é só a navegação; na versão com login vira permissão de verdade.
const OCULTO: Record<Perfil, string[]> = {
  socio: [],
  advogado: ["/pessoas"],
  estagiario: ["/financeiro", "/pessoas", "/gestao", "/captacao"],
  financeiro: ["/prazos", "/audiencias", "/tarefas", "/processos", "/extrajudicial", "/areas", "/atendimentos", "/captacao", "/publicacoes", "/andamentos", "/ferramentas", "/documentos"],
};
const PERFIS: [Perfil, string][] = [["socio", "Sócia"], ["advogado", "Advogado"], ["estagiario", "Estagiário"], ["financeiro", "Financeiro"]];

async function sair() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/login";
}

function Gravando() {
  const s = useSituacao();
  return s.gravando > 0 ? <span className="tag max-md:hidden" role="status">Salvando…</span> : null;
}

function Avisos() {
  const s = useSituacao();
  if (!s.erro && !s.semExtras) return null;
  return (
    <div className="mb-4 space-y-2">
      {s.erro && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[12px] bg-perigo-f px-4 py-3 text-perigo">
          <p className="min-w-0 flex-1 font-semibold">{s.erro}</p>
          <button className="btn btn-g btn-sm" onClick={() => recarregar()}>Carregar de novo</button>
          <a className="btn btn-g btn-sm" href="/login">Entrar de novo</a>
        </div>
      )}
      {s.semExtras && (
        <div role="status" className="rounded-[12px] bg-ocre-f px-4 py-3 text-[#6f4b00]">
          <p className="font-semibold">Falta criar a tabela justio_novo no banco.</p>
          <p className="text-[13.5px]">Processos, prazos, audiências, clientes e honorários já gravam normalmente. Equipe, ponto, etapas da captação, ficha por área e documentos só ficam guardados depois de rodar, no Supabase, o comando do arquivo supabase/justio-novo.sql.</p>
        </div>
      )}
    </div>
  );
}

function ativo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/processos" && pathname.startsWith("/casos")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function Trilho({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();
  const db = useDB();
  const oculto = OCULTO[db.config.perfil ?? "socio"];
  const selos = useMemo(() => ({
    prazos: db.prazos.filter((p) => !p.concluido && diasAte(p.data) <= 0).length,
    publicacoes: db.publicacoes.filter((p) => !p.lida).length,
    andamentos: db.andamentos.filter((a) => !a.lido).length,
    captacao: db.leads.filter((l) => l.etapa === "novo").length,
  }), [db.prazos, db.publicacoes, db.andamentos, db.leads]);

  const linha = (i: Item) => {
    const on = ativo(pathname, i.href);
    const n = i.selo ? selos[i.selo] : 0;
    return (
      <li key={i.href}>
        <Link href={i.href} onClick={aoNavegar} aria-current={on ? "page" : undefined}
          className={`flex h-9 items-center gap-2.5 rounded-full px-3 text-[13.5px] font-medium transition-colors ${on ? "bg-ink font-semibold text-white" : "text-rail-ink hover:bg-rail-2"}`}>
          <i.icone className="size-[17px] shrink-0" strokeWidth={on ? 2.2 : 1.8} />
          <span className="flex-1 truncate">{i.rotulo}</span>
          {n > 0 && <span className={`min-w-5 rounded-full px-1.5 text-center text-[11.5px] font-bold ${i.selo === "prazos" ? "bg-perigo text-white" : on ? "bg-ocre-v text-ink" : "bg-cobalto-f text-ink"}`}>{n}</span>}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col border-r border-line bg-rail text-rail-ink">
      <Link href="/" onClick={aoNavegar} className="flex h-16 shrink-0 items-center gap-1 px-5">
        <span className="titulo text-[25px] text-ink">justio</span>
        <span aria-hidden className="mt-2.5 size-2 rounded-full bg-ocre-v" />
      </Link>
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2.5 pb-3">
        {GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => !oculto.includes(i.href)) })).filter((g) => g.itens.length > 0).map((g) => (
          <div key={g.nome} className="mt-5 first:mt-1">
            <p className="px-3 pb-1.5 text-[11.5px] font-semibold text-rail-mute">{g.nome}</p>
            <ul className="space-y-px">{g.itens.map(linha)}</ul>
          </div>
        ))}
      </nav>
      <ul className="space-y-px border-t border-line px-2.5 py-2.5">
        {RODAPE.map(linha)}
        <li><button onClick={sair} className="flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-left text-[13.5px] font-medium text-rail-ink transition-colors hover:bg-rail-2"><LogOut className="size-[17px] shrink-0" strokeWidth={1.8} />Sair</button></li>
      </ul>
    </div>
  );
}

function Busca({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const db = useDB();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) { setQ(""); setSel(0); d.showModal(); }
    if (!aberta && d.open) d.close();
  }, [aberta]);

  const resultados = useMemo(() => {
    const t = semAcento(q.trim());
    const paginas = [...GRUPOS.flatMap((g) => g.itens), ...RODAPE].map((i) => ({ tipo: "Página", titulo: i.rotulo, sub: "", href: i.href }));
    if (!t) return paginas.slice(0, 7);
    const bate = (s?: string) => !!s && semAcento(s).includes(t);
    return [
      ...db.casos.filter((c) => bate(c.titulo) || bate(c.numero) || bate(c.cliente_nome) || bate(c.parte_contraria)).slice(0, 7).map((c) => ({ tipo: c.natureza === "judicial" ? "Processo" : "Extrajudicial", titulo: c.titulo, sub: `${c.cliente_nome}${c.numero ? " · " + c.numero : ""}`, href: `/casos/${c.id}` })),
      ...db.clientes.filter((c) => bate(c.nome) || bate(c.documento)).slice(0, 5).map((c) => ({ tipo: "Cliente", titulo: c.nome, sub: c.documento ?? "", href: `/clientes/${c.id}` })),
      ...paginas.filter((p) => bate(p.titulo)),
    ].slice(0, 12);
  }, [q, db.casos, db.clientes]);

  const ir = (href: string) => { aoFechar(); router.push(href); };
  return (
    <dialog ref={ref} className="dlg" style={{ marginTop: "12vh" }} onClose={aoFechar} onClick={(e) => { if (e.target === ref.current) aoFechar(); }}>
      <div className="flex items-center gap-2.5 border-b border-line-2 px-4">
        <Search className="size-[18px] text-ink-3" />
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Buscar caso, número, cliente ou página"
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" aria-label="Buscar"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && resultados[sel]) ir(resultados[sel].href);
          }} />
        <span className="tag">Esc</span>
      </div>
      <ul className="max-h-[52vh] overflow-y-auto p-1.5">
        {resultados.length === 0 && <li className="px-3 py-6 text-center text-ink-2">Nada encontrado para “{q}”. Confira a grafia ou busque pelo número do processo.</li>}
        {resultados.map((r, i) => (
          <li key={r.href + i}>
            <button onClick={() => ir(r.href)} onMouseEnter={() => setSel(i)} className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left ${i === sel ? "bg-cobalto-f" : ""}`}>
              <span className="tag w-[92px] justify-center">{r.tipo}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.titulo}</span>{r.sub && <span className="block truncate text-[12.5px] text-ink-3">{r.sub}</span>}</span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const db = useDB();
  const pathname = usePathname();
  const [gaveta, setGaveta] = useState(false);
  const [busca, setBusca] = useState(false);
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBusca(true); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => { setGaveta(false); }, [pathname]);

  // portal do cliente e relatório abrem sem o menu do escritório
  if (pathname.startsWith("/portal") || pathname.startsWith("/relatorio")) return <>{db.versao === 0 ? null : children}</>;

  return (
    <div className="min-h-dvh lg:pl-[244px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] lg:block"><Trilho /></aside>
      {gaveta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/45" aria-label="Fechar menu" onClick={() => setGaveta(false)} />
          <div className="relative h-full w-[260px] shadow-flutua"><Trilho aoNavegar={() => setGaveta(false)} /></div>
          <button className="btn btn-g btn-icone absolute left-[268px] top-3" onClick={() => setGaveta(false)} aria-label="Fechar menu"><X /></button>
        </div>
      )}

      <div className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-white/90 px-3 backdrop-blur-md sm:px-8">
        <button className="btn btn-g btn-icone lg:hidden" onClick={() => setGaveta(true)} aria-label="Abrir menu"><Menu /></button>
        <button onClick={() => setBusca(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-cobalto-f px-4 text-left text-ink-3 transition-colors hover:bg-[#e6e6e6] sm:max-w-[420px]">
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">Buscar caso, número ou cliente</span>
          <span className="tag hidden bg-white sm:inline-flex">Ctrl K</span>
        </button>
        <div className="flex-1 max-sm:hidden" />
        {db.versao > 0 && (
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-3 max-md:hidden">Ver como
            <select className="inp h-9 w-auto rounded-full pr-2 text-[13px]" value={db.config.perfil ?? "socio"} onChange={(e) => alterarConfig({ perfil: e.target.value as Perfil })}>{PERFIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
          </label>
        )}
        <Gravando />
        <button className="btn btn-p" onClick={() => setNovo(true)}><Plus /><span className="max-sm:hidden">Novo caso</span></button>
      </div>

      <AtivarNotificacoes />
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-4 sm:px-8">
        <Avisos />
        {db.versao === 0 ? <div className="h-[60vh] animate-pulse rounded-[16px] bg-porcelana" aria-busy="true" aria-label="Carregando" /> : children}
      </main>

      <Busca aberta={busca} aoFechar={() => setBusca(false)} />
      <NovoCaso aberto={novo} aoFechar={() => setNovo(false)} />
    </div>
  );
}
