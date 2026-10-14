import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área do Cliente · Caroline Fraga Advocacia",
  description: "Acompanhe o seu processo com a Dra. Caroline Fraga.",
  robots: { index: false, follow: false },
};

// Portal do Cliente: casca simples, com a identidade do escritório.
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#f7f5f3]">
      <header className="bg-[#21181d] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-base font-semibold tracking-wide">Caroline Fraga</p>
          <p className="text-xs text-white/60">Advocacia · OAB/RJ 165.955</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-gray-500">
        Dúvidas? Fale com o escritório pelo WhatsApp{" "}
        <a className="underline" href="https://wa.me/5524992791034" target="_blank" rel="noreferrer">
          (24) 99279-1034
        </a>{" "}
        ou pelo e-mail caroline@carolinefraga.com.br.
      </footer>
    </div>
  );
}
