import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lexfy — Legal Tech",
  description: "Sistema de gestão jurídica para escritórios de advocacia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
