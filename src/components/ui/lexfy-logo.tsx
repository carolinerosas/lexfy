interface LexfyHexIconProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export function LexfyHexIcon({ size = 36, dark = true }: LexfyHexIconProps) {
  const fill = dark ? "#ffffff" : "#0f0f0f";
  const gap = dark ? "#0f0f0f" : "#ffffff";
  const bg = dark ? "#0f0f0f" : "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background (transparent) */}
      {/* r=45 — outer ring (fill) */}
      <polygon
        points="95,50 72.5,88.97 27.5,88.97 5,50 27.5,11.03 72.5,11.03"
        fill={fill}
      />
      {/* r=37 — gap */}
      <polygon
        points="87,50 68.5,82.04 31.5,82.04 13,50 31.5,17.96 68.5,17.96"
        fill={gap}
      />
      {/* r=29 — ring 2 */}
      <polygon
        points="79,50 64.5,75.11 35.5,75.11 21,50 35.5,24.89 64.5,24.89"
        fill={fill}
      />
      {/* r=21 — gap */}
      <polygon
        points="71,50 60.5,68.19 39.5,68.19 29,50 39.5,31.81 60.5,31.81"
        fill={gap}
      />
      {/* r=13 — ring 3 */}
      <polygon
        points="63,50 56.5,61.26 43.5,61.26 37,50 43.5,38.74 56.5,38.74"
        fill={fill}
      />
      {/* r=5 — hollow center */}
      <polygon
        points="55,50 52.5,54.33 47.5,54.33 45,50 47.5,45.67 52.5,45.67"
        fill={gap}
      />
    </svg>
  );
}

interface LexfyLogoProps {
  size?: number;
  showText?: boolean;
  dark?: boolean;
  layout?: "row" | "column";
}

export function LexfyLogo({ size = 36, showText = true, dark = true, layout = "row" }: LexfyLogoProps) {
  const textColor = dark ? "text-white" : "text-gray-900";
  const subColor = dark ? "text-gray-500" : "text-gray-400";

  if (layout === "column") {
    const fontSize = Math.max(10, Math.round(size * 0.2));
    const subSize = Math.max(7, Math.round(size * 0.105));
    return (
      <div className="flex flex-col items-center gap-3">
        <LexfyHexIcon size={size} dark={dark} />
        {showText && (
          <div className="text-center w-full px-2">
            <p
              className={`font-black tracking-[0.28em] uppercase leading-none ${textColor}`}
              style={{ fontSize }}
            >
              LEXFY
            </p>
            <div className={`flex items-center gap-2 mt-1.5 ${subColor}`}>
              <span className="flex-1 h-px bg-current opacity-30" />
              <span
                className="font-bold tracking-[0.2em] uppercase whitespace-nowrap"
                style={{ fontSize: subSize }}
              >
                LEGAL TECH
              </span>
              <span className="flex-1 h-px bg-current opacity-30" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const fontSize = Math.max(10, Math.round(size * 0.2));
  const subSize = Math.max(7, Math.round(size * 0.105));

  return (
    <div className="flex items-center gap-3">
      <LexfyHexIcon size={size} dark={dark} />
      {showText && (
        <div className="flex flex-col justify-center">
          <p
            className={`font-black tracking-[0.28em] uppercase leading-none ${textColor}`}
            style={{ fontSize }}
          >
            LEXFY
          </p>
          <div className={`flex items-center gap-2 mt-1.5 ${subColor}`}>
            <span className="flex-1 h-px bg-current opacity-30" />
            <span
              className="font-bold tracking-[0.2em] uppercase whitespace-nowrap"
              style={{ fontSize: subSize }}
            >
              LEGAL TECH
            </span>
            <span className="flex-1 h-px bg-current opacity-30" />
          </div>
        </div>
      )}
    </div>
  );
}
