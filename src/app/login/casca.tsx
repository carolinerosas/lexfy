import { JustioMarca } from "@/components/ui/justio-logo";

// Moldura das telas de acesso (login, esqueci a senha, senha nova).
// Metade escura (tinta) com a logo branca e a frase da marca; metade clara com o formulário.
export function CascaAcesso({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      <section className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-tinta px-6 py-7 text-white sm:px-10 lg:min-h-dvh lg:w-1/2 lg:px-14 lg:py-12">
        <JustioMarca tom="branco" largura={150} className="lg:w-[176px]" />
        <div className="max-lg:hidden">
          <span aria-hidden className="mb-6 block h-px w-12 bg-ambar" />
          <p className="font-serifa max-w-[18ch] text-[42px] font-medium leading-[1.12] tracking-[-0.01em] xl:text-[48px]">
            Cada processo no seu lugar. Cada prazo no seu dia.
          </p>
        </div>
        <p className="font-marca text-[11px] font-semibold uppercase tracking-[0.24em] text-[#AEB4BE] max-lg:hidden">Gestão jurídica</p>
        <p className="font-serifa mt-5 text-[20px] font-medium leading-snug lg:hidden">Cada processo no seu lugar. Cada prazo no seu dia.</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <h1 className="font-serifa text-[30px] font-medium leading-tight text-tinta">{titulo}</h1>
          {subtitulo && <p className="mt-1.5 text-[14px] text-ardosia">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}

export const classeCampo =
  "w-full h-11 rounded-[10px] border border-[#DFE2E7] bg-white px-3.5 text-[14.5px] text-tinta placeholder:text-ardosia transition-[border-color,box-shadow] hover:border-[#B4BAC4] focus:border-tinta focus:outline-none focus:ring-[3px] focus:ring-tinta/10";
export const classeBotao =
  "w-full h-11 rounded-full bg-tinta text-[14.5px] font-semibold text-white transition-colors hover:bg-grafite active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40";
export const classeLink = "text-[13.5px] font-medium text-ambar-texto hover:underline underline-offset-[3px]";
export const classeErro = "text-[13px] font-medium text-[#B42318]";
