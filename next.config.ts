import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Justio antigo saiu de /dashboard para /antigo. Favoritos, atalhos e avisos antigos seguem valendo.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/antigo", permanent: false },
      { source: "/dashboard/:path*", destination: "/antigo/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
