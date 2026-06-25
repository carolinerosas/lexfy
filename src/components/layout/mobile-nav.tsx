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
  type LucideIcon,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  Newspaper,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getPublicacoes, getTriagemNovosCount } from "@/lib/store";

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "triagem" | "publicacoes";
};

const mainItems: MobileNavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/prazos", label: "Prazos", icon: Clock },
  { href: "/dashboard/modelos", label: "Modelos", icon: FileText },
];

const moreItems: MobileNavItem[] = [
  { href: "/dashboard/triagem", label: "Triagem", icon: MessageSquare, badge: "triagem" },
  { href: "/dashboard/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/dashboard/audiencias", label: "Audiências", icon: Calendar },
  { href: "/dashboard/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
];

const mainHrefs = new Set(mainItems.map((item) => item.href));
const menuItems = moreItems.filter((item) => !mainHrefs.has(item.href));

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [triagemNovos, setTriagemNovos] = useState(0);

  async function refreshBadges() {
    const [pubs, triagem] = await Promise.all([
      getPublicacoes(),
      getTriagemNovosCount(),
    ]);
    setPubNaoLidas(pubs.filter((p) => !p.lida).length);
    setTriagemNovos(triagem);
  }

  useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  function getBadge(key?: string): number {
    if (key === "publicacoes") return pubNaoLidas;
    if (key === "triagem") return triagemNovos;
    return 0;
  }

  const isMoreActive = menuItems.some((item) => pathname.startsWith(item.href));
  const totalMoreBadge = getBadge("publicacoes");

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#171216]/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed left-2 right-2 z-40 rounded-2xl border border-white/10 bg-[#21181d] shadow-2xl shadow-black/30 transition-transform duration-300",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ bottom: "57px" }}
      >
        <div className="px-3 pb-2 pt-3">
          <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-white/20" />
          <div className="grid grid-cols-3 gap-1">
            {menuItems.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              const count = getBadge(badge);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-[11px] font-medium transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[8px] font-black text-[#21181d]">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-white/10 bg-[#21181d] shadow-[0_-10px_30px_rgba(33,24,29,0.18)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mainItems.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          const count = getBadge(badge);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-white" : "text-white/90"
              )}
            >
              {active && <span className="absolute left-1/4 right-1/4 top-0 h-0.5 rounded-full bg-white" />}
              <div className="relative">
                <Icon className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[8px] font-black text-[#21181d]">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
            moreOpen || isMoreActive ? "text-white" : "text-white/90"
          )}
        >
          {(moreOpen || isMoreActive) && <span className="absolute left-1/4 right-1/4 top-0 h-0.5 rounded-full bg-white" />}
          <div className="relative">
            {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            {!moreOpen && totalMoreBadge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[8px] font-black text-[#21181d]">
                {totalMoreBadge > 99 ? "99+" : totalMoreBadge}
              </span>
            )}
          </div>
          <span>{moreOpen ? "Fechar" : "Mais"}</span>
        </button>
      </nav>
    </>
  );
}
