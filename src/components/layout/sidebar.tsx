"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Clock,
  Calendar,
  DollarSign,
  Newspaper,
  Users,
  UserRound,
  Settings,
  Search,
} from "lucide-react";
import { JustioLogo } from "@/components/ui/justio-logo";
import { getMovimentacoesNaoLidas, getPublicacoes } from "@/lib/store";
import { useDatajudSync } from "@/hooks/useDatajudSync";
import { SearchModal } from "@/components/ui/search-modal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen, badge: "movimentacoes" },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/prazos", label: "Prazos", icon: Clock },
  { href: "/dashboard/audiencias", label: "Audiências", icon: Calendar },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/dashboard/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [movNaoLidas, setMovNaoLidas] = useState(0);
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function refreshBadges() {
    const [mov, pubs] = await Promise.all([getMovimentacoesNaoLidas(), getPublicacoes()]);
    setMovNaoLidas(mov);
    setPubNaoLidas(pubs.filter((p) => !p.lida).length);
  }

  useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 5000);
    return () => clearInterval(id);
  }, []);

  useDatajudSync(() => refreshBadges());

  function getBadge(key?: string): number {
    if (key === "movimentacoes") return movNaoLidas;
    if (key === "publicacoes") return pubNaoLidas;
    return 0;
  }

  return (
    <aside className="w-60 bg-[#0f0f0f] flex flex-col h-full border-r border-white/5">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center py-8 border-b border-white/5">
        <JustioLogo size={80} dark={true} layout="row" />
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white hover:text-white text-sm"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-xs">Buscar…</span>
          <kbd className="text-[9px] bg-white/10 text-gray-500 px-1.5 py-0.5 rounded font-mono">Ctrl K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          const count = getBadge(badge);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-white text-gray-900"
                  : "text-white hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-gray-900" : "text-white")} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  active ? "bg-gray-900 text-white" : "bg-white/10 text-white"
                )}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">CR</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold truncate leading-tight">Caroline Rosas Advocacia</p>
          <p className="text-gray-500 text-[10px] mt-0.5">OAB/RJ</p>
        </div>
      </div>
    </aside>
  );
}
