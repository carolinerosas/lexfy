"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Search, Settings } from "lucide-react";
import { SearchModal } from "@/components/ui/search-modal";
import { MobileMenuButton } from "@/components/layout/mobile-drawer";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const showBack = pathname !== "/dashboard";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleBack() {
    if (typeof window !== "undefined") {
      const sameOriginReferrer = document.referrer.startsWith(window.location.origin);
      if (sameOriginReferrer && window.history.length > 1) {
        router.back();
        return;
      }
    }

    router.push("/dashboard");
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/95 px-4 backdrop-blur md:px-6">
        <MobileMenuButton />

        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            title="Voltar"
            aria-label="Voltar para a página anterior"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-500 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-700 md:max-w-md"
        >
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">Buscar processos, clientes, prazos...</span>
          <kbd className="ml-auto hidden rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 sm:inline">
            Ctrl K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/configuracoes"
            aria-label="Abrir configurações"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            <Settings className="h-4 w-4" />
          </Link>

          <a
            href="https://mail.zoho.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir e-mail"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900 sm:flex"
          >
            <Mail className="h-4 w-4" />
          </a>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#21181d] text-xs font-bold text-white">
              CR
            </div>
            <div className="hidden min-w-0 leading-tight lg:block">
              <p className="truncate text-xs font-semibold text-gray-900">Caroline Rosas Advocacia</p>
              <p className="truncate text-[11px] text-gray-500">caroline@justio.com.br · OAB/RJ</p>
            </div>
          </div>
        </div>
      </header>

      {searchOpen && <SearchModal open onClose={() => setSearchOpen(false)} />}
    </>
  );
}
