import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden overflow-x-hidden bg-gray-50">
      <div className="hidden shrink-0 md:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <TopBar />
        <main className="max-w-full flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
