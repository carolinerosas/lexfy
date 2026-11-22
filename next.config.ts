import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O JUSTIO antigo (/dashboard e depois /antigo) foi descontinuado em 22/11/2026.
  // Favoritos, atalhos, avisos e o aplicativo instalado que guardaram esses endereços abrem o novo.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/antigo", destination: "/", permanent: false },
      { source: "/:base(dashboard|antigo)/processos/:id", destination: "/casos/:id", permanent: false },
      { source: "/:base(dashboard|antigo)/configuracoes", destination: "/configuracoes", permanent: false },
      { source: "/:base(dashboard|antigo)/modelos", destination: "/modelos", permanent: false },
      { source: "/:base(dashboard|antigo)/briefing", destination: "/briefing", permanent: false },
      { source: "/:base(dashboard|antigo)/triagem", destination: "/importar", permanent: false },
      { source: "/:base(dashboard|antigo)/audiencias/:id/ao-vivo", destination: "/audiencias/:id/ao-vivo", permanent: false },
      { source: "/:base(dashboard|antigo)/:pagina(agenda|prazos|audiencias|tarefas|publicacoes|processos|clientes|atendimentos|financeiro)", destination: "/:pagina", permanent: false },
      { source: "/:base(dashboard|antigo)/:path*", destination: "/", permanent: false },
      { source: "/novidades", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
