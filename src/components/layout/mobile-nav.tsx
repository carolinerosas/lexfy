"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderOpen, UserRound, Clock, MoreHorizontal,
  Calendar, DollarSign, Users, Newspaper, Settings, X,
} from "lucide-react";
import { getMovimentacoesNaoLidas, getPublicacoes } from "@/lib/store";

const mainItems = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen, badge: "movimentacoes" },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/prazos", label: "Prazos", icon: Clock },
];

const moreItems = [
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/audiencias", label: "Audiências", icon: Calendar },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/dashboard/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [movNaoLidas, setMovNaoLidas] = useState(0);
  const [pubNaoLidas, setPubNaoLidas] = useState(0);

  function refreshBadges() {
    setMovNaoLidas(getMovimentacoesNaoLidas());
    setPubNaoLidas(getPublicacoes().filter((p) => !p.lida).length);
  }

  useEffect(() => {
    refreshBadges();
    const id = setInterval(refreshBadges, 5000);
    return () => clearInterval(id);
  }, []);

  // Fecha o drawer ao navegar
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  function getBadge(key?: string): number {
    if (key === "movimentacoes") return movNaoLidas;
    if (key === "publicacoes") return pubNaoLidas;
    return 0;
  }

  const isMoreActive = moreItems.some((item) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
  );
  const totalMoreBadge = getBadge("publicacoes");

  return (
    <>
      {/* Drawer overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Drawer "Mais" */}
      <div className={cn(
        "fixed left-0 right-0 z-40 bg-[#0f0f0f] border-t border-white/10 rounded-t-2xl transition-transform duration-300",
        moreOpen ? "translate-y-0" : "translate-y-full"
      )} style={{ bottom: "57px" }}>
        <div className="px-3 pt-3 pb-2">
          <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-5 gap-1">
            {moreItems.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              const count = getBadge(badge);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center py-3 rounded-xl gap-1.5 text-[11px] font-medium transition-colors relative",
                    active ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black bg-white text-gray-900 rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
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

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f] border-t border-white/10 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mainItems.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          const count = getBadge(badge);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition-colors relative",
                active ? "text-white" : "text-gray-500"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black bg-white text-gray-900 rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Botão Mais */}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition-colors relative",
            (moreOpen || isMoreActive) ? "text-white" : "text-gray-500"
          )}
        >
          {(moreOpen || isMoreActive) && (
            <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full" />
          )}
          <div className="relative">
            {moreOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            {!moreOpen && totalMoreBadge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black bg-white text-gray-900 rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
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
