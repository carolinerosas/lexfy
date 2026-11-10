"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Newspaper,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getPublicacoesNaoLidasCount, getTriagemNovosCount, getBriefingsNaoLidos } from "@/lib/store";

export type NavBadge = "triagem" | "publicacoes" | "briefing";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: NavBadge };

export const navItems: NavItem[] = [
  { href: "/antigo", label: "Painel", icon: LayoutDashboard },
  { href: "/antigo/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/antigo/briefing", label: "Briefing", icon: Sparkles, badge: "briefing" },
  { href: "/antigo/triagem", label: "Triagem", icon: MessageSquare, badge: "triagem" },
  { href: "/antigo/prazos", label: "Prazos", icon: Clock },
  { href: "/antigo/audiencias", label: "Audiências", icon: Calendar },
  { href: "/antigo/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/antigo/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/antigo/processos", label: "Processos", icon: FolderOpen },
  { href: "/antigo/clientes", label: "Clientes", icon: UserRound },
  { href: "/antigo/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/antigo/modelos", label: "Modelos", icon: FileText },
  { href: "/antigo/financeiro", label: "Financeiro", icon: DollarSign },
];

// Contadores das badges (publicações não lidas, triagens novas, briefings não lidos).
export function useNavBadges() {
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [triagemNovos, setTriagemNovos] = useState(0);
  const [briefingNaoLidos, setBriefingNaoLidos] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function refresh() {
      // Só contagens (head: true): baixar as publicações inteiras aqui estourava a cota de egress do Supabase.
      if (document.visibilityState === "hidden") return;
      const [pubs, triagem, briefings] = await Promise.all([
        getPublicacoesNaoLidasCount(),
        getTriagemNovosCount(),
        getBriefingsNaoLidos(),
      ]);
      if (!ativo) return;
      setPubNaoLidas(pubs);
      setTriagemNovos(triagem);
      setBriefingNaoLidos(briefings);
    }
    refresh();
    const id = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { ativo = false; clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  return function getBadge(key?: NavBadge): number {
    if (key === "publicacoes") return pubNaoLidas;
    if (key === "triagem") return triagemNovos;
    if (key === "briefing") return briefingNaoLidos;
    return 0;
  };
}
