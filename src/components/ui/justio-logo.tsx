interface JustioHexIconProps {
  size?: number;
  className?: string;
  dark?: boolean;
}

export function JustioHexIcon({ size = 36, dark = true }: JustioHexIconProps) {
  const fill = dark ? "#ffffff" : "#21181d";
  const gap = dark ? "#21181d" : "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon
        points="95,50 72.5,88.97 27.5,88.97 5,50 27.5,11.03 72.5,11.03"
        fill={fill}
      />
      <polygon
        points="87,50 68.5,82.04 31.5,82.04 13,50 31.5,17.96 68.5,17.96"
        fill={gap}
      />
      <polygon
        points="79,50 64.5,75.11 35.5,75.11 21,50 35.5,24.89 64.5,24.89"
        fill={fill}
      />
      <polygon
        points="71,50 60.5,68.19 39.5,68.19 29,50 39.5,31.81 60.5,31.81"
        fill={gap}
      />
      <polygon
        points="63,50 56.5,61.26 43.5,61.26 37,50 43.5,38.74 56.5,38.74"
        fill={fill}
      />
      <polygon
        points="55,50 52.5,54.33 47.5,54.33 45,50 47.5,45.67 52.5,45.67"
        fill={gap}
      />
    </svg>
  );
}

interface JustioLogoProps {
  size?: number;
  showText?: boolean;
  dark?: boolean;
  layout?: "row" | "column";
}

export function JustioLogo({ size = 36, showText = true, dark = true, layout = "row" }: JustioLogoProps) {
  const textColor = dark ? "text-white" : "text-gray-900";
  const subColor = dark ? "text-gray-500" : "text-gray-400";

  if (layout === "column") {
    const fontSize = Math.max(10, Math.round(size * 0.2));
    const subSize = Math.max(7, Math.round(size * 0.105));
    return (
      <div className="flex flex-col items-center gap-3">
        <JustioHexIcon size={size} dark={dark} />
        {showText && (
          <div className="text-center w-full px-2">
            <p
              className={`font-black tracking-[0.28em] uppercase leading-none ${textColor}`}
              style={{ fontSize }}
            >
              JUSTIO
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
      <JustioHexIcon size={size} dark={dark} />
      {showText && (
        <div className="flex flex-col justify-center">
          <p
            className={`font-black tracking-[0.28em] uppercase leading-none ${textColor}`}
            style={{ fontSize }}
          >
            JUSTIO
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
