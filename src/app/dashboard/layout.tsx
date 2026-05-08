import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — apenas no desktop */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Nav mobile — apenas no celular */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
