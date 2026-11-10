import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import "./globals.css";

const corpo = Onest({ subsets: ["latin"], variable: "--font-corpo", display: "swap" });
const titulo = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-titulo", display: "swap" });

export const metadata: Metadata = {
  title: "Justio",
  description: "Sistema de gestão jurídica para escritórios de advocacia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Justio",
  },
  icons: {
    apple: "/icon.svg",
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${corpo.variable} ${titulo.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
