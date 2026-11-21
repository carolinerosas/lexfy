/* eslint-disable @next/next/no-img-element */
// Marca JUSTIO: símbolo de três hexágonos (cheio, vazado, cheio) e o nome em Montserrat 600.
// Os arquivos com o nome em contornos ficam em public/brand. Nunca recolorir o símbolo com o âmbar.

type Tom = "tinta" | "branco";

/** Símbolo compacto (dois em cima, um embaixo). Herda a cor do texto (currentColor). */
export function JustioSimbolo({ size = 24, className, titulo }: { size?: number; className?: string; titulo?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 73.28 73.46"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <g fill="currentColor">
        <path transform="translate(17.32,20)" d="M0,-20 L17.32,-10 L17.32,10 L0,20 L-17.32,10 L-17.32,-10Z" />
        <path transform="translate(55.96,20)" d="M0,-18.5 L16.02,-9.25 L16.02,9.25 L0,18.5 L-16.02,9.25 L-16.02,-9.25Z" fill="none" stroke="currentColor" strokeWidth="3" />
        <path transform="translate(36.64,53.46)" d="M0,-20 L17.32,-10 L17.32,10 L0,20 L-17.32,10 L-17.32,-10Z" />
      </g>
    </svg>
  );
}

/** Logo completa (símbolo em linha + nome). Largura mínima de 110 px. */
export function JustioMarca({
  variante = "horizontal",
  tom = "tinta",
  largura = 150,
  className,
}: {
  variante?: "horizontal" | "vertical";
  tom?: Tom;
  largura?: number;
  className?: string;
}) {
  const arquivo = variante === "vertical" ? "Vertical" : "Horizontal";
  const cor = tom === "branco" ? "Branco" : "Tinta";
  const w = Math.max(110, largura);
  return <img src={`/brand/Justio${arquivo}${cor}.svg`} alt="JUSTIO" width={w} className={className} style={{ height: "auto" }} />;
}

// ── Compatibilidade com as telas antigas ──

interface JustioHexIconProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

/** Usado pelas telas antigas: símbolo branco em fundo escuro (dark) ou tinta em fundo claro. */
export function JustioHexIcon({ size = 36, dark = true, className }: JustioHexIconProps) {
  return <JustioSimbolo size={size} className={`${dark ? "text-white" : "text-[var(--justio-tinta)]"} ${className ?? ""}`} />;
}

interface JustioLogoProps {
  size?: number;
  showText?: boolean;
  dark?: boolean;
  layout?: "row" | "column";
}

export function JustioLogo({ size = 36, showText = true, dark = true, layout = "row" }: JustioLogoProps) {
  if (!showText) return <JustioHexIcon size={size} dark={dark} />;
  const tom: Tom = dark ? "branco" : "tinta";
  return layout === "column"
    ? <JustioMarca variante="vertical" tom={tom} largura={Math.round(size * 1.6)} />
    : <JustioMarca tom={tom} largura={Math.round(size * 2)} />;
}
