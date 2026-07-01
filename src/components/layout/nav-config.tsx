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
import { getPublicacoes, getTriagemNovosCount, getBriefingsNaoLidos } from "@/lib/store";

export type NavBadge = "triagem" | "publicacoes" | "briefing";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: NavBadge };

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/briefing", label: "Briefing", icon: Sparkles, badge: "briefing" },
  { href: "/dashboard/triagem", label: "Triagem", icon: MessageSquare, badge: "triagem" },
  { href: "/dashboard/prazos", label: "Prazos", icon: Clock },
  { href: "/dashboard/audiencias", label: "Audiências", icon: Calendar },
  { href: "/dashboard/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/dashboard/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/modelos", label: "Modelos", icon: FileText },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
];

// Contadores das badges (publicações não lidas, triagens novas, briefings não lidos).
export function useNavBadges() {
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [triagemNovos, setTriagemNovos] = useState(0);
  const [briefingNaoLidos, setBriefingNaoLidos] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function refresh() {
      const [pubs, triagem, briefings] = await Promise.all([
        getPublicacoes(),
        getTriagemNovosCount(),
        getBriefingsNaoLidos(),
      ]);
      if (!ativo) return;
      setPubNaoLidas(pubs.filter((p) => !p.lida).length);
      setTriagemNovos(triagem);
      setBriefingNaoLidos(briefings);
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => { ativo = false; clearInterval(id); };
  }, []);

  return function getBadge(key?: NavBadge): number {
    if (key === "publicacoes") return pubNaoLidas;
    if (key === "triagem") return triagemNovos;
    if (key === "briefing") return briefingNaoLidos;
    return 0;
  };
}
