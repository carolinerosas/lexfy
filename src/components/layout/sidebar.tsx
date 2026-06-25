"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Calendar,
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
} from "lucide-react";
import { JustioLogo } from "@/components/ui/justio-logo";
import { getPublicacoes, getTriagemNovosCount, getBriefingsNaoLidos } from "@/lib/store";
import { useDatajudSync } from "@/hooks/useDatajudSync";

const navItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
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

export function Sidebar() {
  const pathname = usePathname();
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [triagemNovos, setTriagemNovos] = useState(0);
  const [briefingNaoLidos, setBriefingNaoLidos] = useState(0);

  async function refreshBadges() {
    const [pubs, triagem, briefings] = await Promise.all([
      getPublicacoes(),
      getTriagemNovosCount(),
      getBriefingsNaoLidos(),
    ]);
    setPubNaoLidas(pubs.filter((p) => !p.lida).length);
    setTriagemNovos(triagem);
    setBriefingNaoLidos(briefings);
  }

  useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 5000);
    return () => clearInterval(id);
  }, []);

  useDatajudSync(() => refreshBadges());

  function getBadge(key?: string): number {
    if (key === "publicacoes") return pubNaoLidas;
    if (key === "triagem") return triagemNovos;
    if (key === "briefing") return briefingNaoLidos;
    return 0;
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-white/10 bg-[#21181d]">
      <Link
        href="/dashboard"
        aria-label="Ir para o Painel"
        className="flex flex-col items-center justify-center border-b border-white/10 py-8 transition-colors hover:bg-white/5"
      >
        <JustioLogo size={80} dark={true} layout="row" />
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          const count = getBadge(badge);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active ? "bg-white text-[#21181d]" : "text-slate-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#21181d]" : "text-slate-100")} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                    active ? "bg-[#21181d] text-white" : "bg-white/15 text-white"
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
