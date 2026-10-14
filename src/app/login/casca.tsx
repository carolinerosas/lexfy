import { JustioHexIcon } from "@/components/ui/justio-logo";

// Moldura das telas de acesso (redefinir senha etc.), no mesmo visual da tela de login.
export function CascaAcesso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#21181d] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5">
            <JustioHexIcon size={56} dark={true} />
          </div>
          <h1 className="text-white text-xl font-black tracking-[0.28em] uppercase">JUSTIO</h1>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <p className="text-white text-sm font-semibold leading-tight">{titulo}</p>
          <p className="text-gray-500 text-xs mt-1 mb-6">{subtitulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export const classeCampo =
  "w-full bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all";
export const classeBotao =
  "w-full bg-white text-gray-900 font-semibold rounded-xl py-3 text-sm transition-all hover:bg-gray-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
