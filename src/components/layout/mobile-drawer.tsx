"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { JustioLogo } from "@/components/ui/justio-logo";
import { navItems, useNavBadges } from "./nav-config";

// Botão de três listras (☰) + menu lateral (gaveta) para o mobile.
export function MobileMenuButton() {
  const pathname = usePathname();
  const getBadge = useNavBadges();
  const [aberto, setAberto] = useState(false);

  // Fecha ao trocar de página.
  useEffect(() => { setAberto(false); }, [pathname]);

  // Trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (aberto) {
      const anterior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = anterior; };
    }
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#171216]/60 backdrop-blur-sm" onClick={() => setAberto(false)} />

          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-[#21181d] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
              <Link href="/dashboard" aria-label="Ir para o Painel" onClick={() => setAberto(false)}>
                <JustioLogo size={64} dark layout="row" />
              </Link>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
              {navItems.map(({ href, label, icon: Icon, badge }) => {
                const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
                const count = getBadge(badge);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAberto(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all",
                      active ? "bg-white text-[#21181d]" : "text-slate-100 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[#21181d]" : "text-slate-100")} />
                    <span className="flex-1">{label}</span>
                    {count > 0 && (
                      <span className={cn(
                        "min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                        active ? "bg-[#21181d] text-white" : "bg-white/15 text-white"
                      )}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
