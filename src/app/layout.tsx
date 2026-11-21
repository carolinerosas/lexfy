import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Newsreader } from "next/font/google";
import "./globals.css";

// Identidade JUSTIO: Inter na interface, Newsreader nos títulos, Montserrat 600 na marca.
const corpo = Inter({ subsets: ["latin"], variable: "--font-corpo", display: "swap" });
const titulo = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-titulo", display: "swap" });
const marca = Montserrat({ subsets: ["latin"], weight: ["600"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "JUSTIO", template: "%s · JUSTIO" },
  description: "Sistema de gestão jurídica para escritórios de advocacia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JUSTIO",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/JustioFavicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0E1013",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${corpo.variable} ${titulo.variable} ${marca.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
