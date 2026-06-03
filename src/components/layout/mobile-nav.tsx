"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  DollarSign,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  MoreHorizontal,
  Newspaper,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getMovimentacoesNaoLidas, getPublicacoes, getTarefas } from "@/lib/store";

const mainItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/prazos", label: "Prazos", icon: Clock },
  { href: "/dashboard/audiencias", label: "Audiências", icon: Calendar },
  { href: "/dashboard/tarefas", label: "Tarefas", icon: ListTodo, badge: "tarefas" },
];

const moreItems = [
  { href: "/dashboard/publicacoes", label: "Publicações", icon: Newspaper, badge: "publicacoes" },
  { href: "/dashboard/processos", label: "Processos", icon: FolderOpen, badge: "movimentacoes" },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [movNaoLidas, setMovNaoLidas] = useState(0);
  const [pubNaoLidas, setPubNaoLidas] = useState(0);
  const [tarefasPendentes, setTarefasPendentes] = useState(0);

  async function refreshBadges() {
    const [mov, pubs, tarefas] = await Promise.all([
      getMovimentacoesNaoLidas(),
      getPublicacoes(),
      getTarefas(),
    ]);
    setMovNaoLidas(mov);
    setPubNaoLidas(pubs.filter((p) => !p.lida).length);
    setTarefasPendentes(tarefas.filter((t) => !t.concluida).length);
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
    if (key === "movimentacoes") return movNaoLidas;
    if (key === "publicacoes") return pubNaoLidas;
    if (key === "tarefas") return tarefasPendentes;
    return 0;
  }

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));
  const totalMoreBadge = getBadge("publicacoes") + getBadge("movimentacoes");

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
          "fixed left-0 right-0 z-40 rounded-t-2xl border-t border-white/10 bg-[#21181d] transition-transform duration-300",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ bottom: "57px" }}
      >
        <div className="px-3 pb-2 pt-3">
          <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-white/20" />
          <div className="grid grid-cols-5 gap-1">
            {moreItems.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              const count = getBadge(badge);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-[11px] font-medium transition-colors",
                    active ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
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
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-white/10 bg-[#21181d]"
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
                active ? "text-white" : "text-slate-400"
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
            moreOpen || isMoreActive ? "text-white" : "text-slate-400"
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
